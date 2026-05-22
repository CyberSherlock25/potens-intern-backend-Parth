// API key auth via x-api-key header
// In production: use a secrets manager, add key rotation
const authenticate = (req, res, next) => {
  const key = req.headers['x-api-key'];

  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Pass a valid x-api-key header.' });
  }

  next();
};

module.exports = authenticate;