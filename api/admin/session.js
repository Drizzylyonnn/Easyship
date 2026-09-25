const state = globalThis.__easyshipState || (globalThis.__easyshipState = { shipments: {}, adminUser: null });

module.exports = (req, res) => {
  if (state.adminUser) {
    return res.status(200).json({ authenticated: true, user: state.adminUser });
  }
  return res.status(200).json({ authenticated: false });
};
