require('dotenv').config();
const app = require('./app');
const logger = require('./logger');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ event: 'server_started', port: PORT });
  console.log(`Server running on http://localhost:${PORT}`);
});