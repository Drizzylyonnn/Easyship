module.exports = (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'easyship-api',
    database: 'vercel-memory'
  });
};
