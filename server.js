require('dotenv').config();
const express = require('express');
const https = require('https');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
const DOMAIN = process.env.DOMAIN || 'easyshipp.com';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'shipments.json');
const CERT_PATH = path.join(__dirname, 'easyshipp.com.crt');
const KEY_PATH = path.join(__dirname, 'easyshipp.com.key');
const OPENSSL_PATH = 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aerogram123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'aerogram-admin-secret';

function ensureLocalCertificate() {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    return;
  }

  try {
    const sslBin = fs.existsSync(OPENSSL_PATH) ? OPENSSL_PATH : 'openssl';
    execFileSync(sslBin, [
      'req', '-x509', '-nodes', '-newkey', 'rsa:2048',
      '-keyout', KEY_PATH,
      '-out', CERT_PATH,
      '-days', '365',
      '-subj', `/CN=${DOMAIN}`,
      '-addext', `subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1,IP:::1`
    ], { stdio: 'inherit' });
    console.log(`Generated local HTTPS certificate for ${DOMAIN}.`);
  } catch (error) {
    console.warn('Could not generate a local HTTPS certificate automatically. Please install OpenSSL or configure SSL_CERT_PATH and SSL_KEY_PATH.');
    console.warn(error.message);
  }
}

ensureLocalCertificate();

const sslOptions = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)
  ? {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    }
  : null;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get(['/Aerogram.html', '/Easyship.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'Easyship.html'));
});

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: 1000 * 60 * 60 * 12
  },
  store: MONGODB_URI
    ? MongoStore.create({
        mongoUrl: MONGODB_URI,
        dbName: 'aerogram',
        collectionName: 'sessions'
      })
    : undefined
}));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}

function readLocalShipments() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeLocalShipments(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function buildDefaultTimeline(mode = 'ship') {
  const base = mode === 'ship'
    ? [
        { label: 'Booked', detail: 'Cargo reserved', done: true },
        { label: 'Loaded', detail: 'Container staged', done: false },
        { label: 'In transit', detail: 'Ocean route in progress', done: false },
        { label: 'Delivered', detail: 'Port arrival complete', done: false }
      ]
    : [
        { label: 'Booked', detail: 'Reservation confirmed', done: true },
        { label: 'Checked in', detail: 'Baggage and docs secured', done: false },
        { label: 'In flight', detail: 'Cruising en route', done: false },
        { label: 'Arrived', detail: 'Destination reached', done: false }
      ];
  return base;
}

const shipmentSchema = new mongoose.Schema({
  track: { type: String, required: true, unique: true },
  pnr: String,
  from: String,
  fromName: String,
  to: String,
  toName: String,
  name: String,
  date: String,
  gate: String,
  seat: String,
  boarding: String,
  mode: String,
  vessel: String,
  container: String,
  cargo: String,
  status: String,
  timeline: [{ label: String, detail: String, done: Boolean }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'shipments' });

let ShipmentModel = null;
let databaseMode = 'local';

if (MONGODB_URI) {
  mongoose.set('strictQuery', true);
  ShipmentModel = mongoose.model('Shipment', shipmentSchema);
  mongoose.connect(MONGODB_URI)
    .then(() => {
      databaseMode = 'mongodb';
      console.log('Connected to MongoDB');
    })
    .catch((error) => {
      console.warn('MongoDB not available, using local JSON storage instead:', error.message);
      ShipmentModel = null;
      databaseMode = 'local';
    });
}

async function getShipmentsList() {
  if (ShipmentModel) {
    return await ShipmentModel.find({}).lean();
  }
  const shipments = readLocalShipments();
  return Object.values(shipments);
}

async function getShipmentByCode(code) {
  const normalizedCode = (code || '').toUpperCase();
  if (ShipmentModel) {
    return await ShipmentModel.findOne({ track: normalizedCode }).lean();
  }
  const shipments = readLocalShipments();
  return shipments[normalizedCode] || null;
}

async function saveShipment(shipment) {
  const normalizedShipment = {
    ...shipment,
    track: (shipment.track || '').toUpperCase(),
    status: shipment.status || 'Booked',
    mode: shipment.mode || 'ship',
    timeline: Array.isArray(shipment.timeline) && shipment.timeline.length
      ? shipment.timeline
      : buildDefaultTimeline(shipment.mode || 'ship')
  };

  if (ShipmentModel) {
    await ShipmentModel.findOneAndUpdate(
      { track: normalizedShipment.track },
      { $set: normalizedShipment },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return normalizedShipment;
  }
  const shipments = readLocalShipments();
  shipments[normalizedShipment.track] = normalizedShipment;
  writeLocalShipments(shipments);
  return normalizedShipment;
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.username === ADMIN_USERNAME) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aerogram-api', database: databaseMode });
});

app.get('/api/admin/session', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  return res.json({ authenticated: false });
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.user = { username: ADMIN_USERNAME };
    return res.json({ ok: true, user: req.session.user });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/admin/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => res.json({ ok: true }));
    return;
  }
  return res.json({ ok: true });
});

app.options('/api/shipments', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

app.get('/api/shipments', async (req, res) => {
  try {
    const shipments = await getShipmentsList();
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch shipments' });
  }
});

app.post('/api/shipments', async (req, res) => {
  try {
    const shipment = req.body;
    if (!shipment || !shipment.track) {
      return res.status(400).json({ error: 'Tracking code is required' });
    }
    const saved = await saveShipment(shipment);
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid shipment payload' });
  }
});

app.get('/api/shipments/status/:code', async (req, res) => {
  try {
    const code = decodeURIComponent(req.params.code).toUpperCase();
    const shipment = await getShipmentByCode(code);
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    res.json({
      track: shipment.track,
      status: shipment.status || 'Booked',
      mode: shipment.mode || 'ship',
      from: shipment.from,
      to: shipment.to,
      name: shipment.name
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch status' });
  }
});

app.get('/api/admin/shipments', requireAdmin, async (req, res) => {
  try {
    const shipments = await getShipmentsList();
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch shipments' });
  }
});

app.patch('/api/admin/shipments/:code', requireAdmin, async (req, res) => {
  try {
    const code = decodeURIComponent(req.params.code).toUpperCase();
    const status = req.body && req.body.status;
    const shipment = await getShipmentByCode(code);
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const timeline = Array.isArray(req.body && req.body.timeline) && req.body.timeline.length
      ? req.body.timeline
      : buildDefaultTimeline(shipment.mode || 'ship');

    const updated = {
      ...shipment,
      status: status || shipment.status || 'Booked',
      timeline
    };

    const saved = await saveShipment(updated);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Unable to update shipment' });
  }
});

app.get('/api/shipments/:code', async (req, res) => {
  try {
    const code = decodeURIComponent(req.params.code).toUpperCase();
    const shipment = await getShipmentByCode(code);
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch shipment' });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (!sslOptions) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API server running on http://0.0.0.0:${PORT}`);
    console.log(`Admin dashboard: http://0.0.0.0:${PORT}/admin`);
    console.log(`Default admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    if (!MONGODB_URI) {
      console.log('No MONGODB_URI provided — running in local JSON mode.');
    }
  });
} else {
  https.createServer(sslOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Secure API server running on https://${DOMAIN}:${PORT}`);
    console.log(`Admin dashboard: https://${DOMAIN}:${PORT}/admin`);
    console.log(`Local fallback URL: https://localhost:${PORT}/Easyship.html`);
    console.log(`Default admin credentials: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
    if (!MONGODB_URI) {
      console.log('No MONGODB_URI provided — running in local JSON mode.');
    }
  });
}
