const pino = require('pino');

// Pretty-print in dev, structured JSON in production
const logger = pino(
  process.env.NODE_ENV === 'production'
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }
);

module.exports = logger;