const rateLimit = require('express-rate-limit');

// 20 POST requests per minute per IP — prevents log flooding
const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

module.exports = { postLimiter };
