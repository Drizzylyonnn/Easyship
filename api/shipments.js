const state = globalThis.__easyshipState || (globalThis.__easyshipState = { shipments: {} });

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function defaultTimeline(mode = 'ship') {
  if (mode === 'ship') {
    return [
      { label: 'Booked', detail: 'Cargo reserved', done: true },
      { label: 'Loaded', detail: 'Container staged', done: false },
      { label: 'In transit', detail: 'Ocean route in progress', done: false },
      { label: 'Delivered', detail: 'Port arrival complete', done: false }
    ];
  }

  return [
    { label: 'Booked', detail: 'Reservation confirmed', done: true },
    { label: 'Checked in', detail: 'Baggage and docs secured', done: false },
    { label: 'In flight', detail: 'Cruising en route', done: false },
    { label: 'Arrived', detail: 'Destination reached', done: false }
  ];
}

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const requestedCode = normalizeCode(req.query && req.query.code);

  if (req.method === 'GET') {
    if (requestedCode) {
      const shipment = state.shipments[requestedCode] || null;
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      return res.status(200).json(shipment);
    }

    return res.status(200).json(Object.values(state.shipments));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const track = normalizeCode(body.track);

    if (!track) {
      return res.status(400).json({ error: 'Tracking code is required' });
    }

    const shipment = {
      ...body,
      track,
      status: body.status || 'Booked',
      mode: body.mode || 'ship',
      timeline: Array.isArray(body.timeline) && body.timeline.length ? body.timeline : defaultTimeline(body.mode || 'ship')
    };

    state.shipments[track] = shipment;
    return res.status(201).json(shipment);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
