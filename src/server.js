const app = require('./app');
const { createServer } = require('http');
const logger = require('./utils/logger');
const realtimeService = require('./services/realtimeService');

const PORT = process.env.PORT || 3000;

const server = createServer(app);

// Initialize real-time service
realtimeService.initialize(server);

// Make realtime service accessible to other modules
app.set('realtimeService', realtimeService);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/api/docs`);
  logger.info(`🌐 Server also accessible at http://192.168.0.102:${PORT}`);
});

module.exports = { server, realtimeService };