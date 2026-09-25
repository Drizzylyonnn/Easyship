const state = globalThis.__easyshipState || (globalThis.__easyshipState = { shipments: {} });

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

module.exports = (req, res) => {
  const code = normalizeCode(req.query && req.query.code ? req.query.code : req.query && req.query['0']);
  const shipment = state.shipments[code] || null;

  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }

  if (req.method === 'GET') {
    return res.status(200).json(shipment);
  }

  if (req.method === 'PATCH') {
    const payload = req.body || {};
    const updated = {
      ...shipment,
      status: payload.status || shipment.status || 'Booked',
      timeline: Array.isArray(payload.timeline) && payload.timeline.length ? payload.timeline : shipment.timeline || []
    };

    state.shipments[code] = updated;
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
