require('dotenv').config();
const express = require('express');
const logger = require('./logger');

const app = express();
app.use(express.json());

app.use('/', require('./routes/log'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ event: 'unhandled_error', message: err.message });
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
