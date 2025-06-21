const app = require('./app');
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ["http://localhost:8081"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  
  // Join user to their own room for notifications
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`User ${userId} joined their room`);
  });
  
  // Handle chat messages
  socket.on('send_message', (data) => {
    // Broadcast to receiver
    socket.to(`user_${data.receiverId}`).emit('new_message', data);
  });
  
  // Handle prescription updates
  socket.on('prescription_update', (data) => {
    socket.to(`user_${data.userId}`).emit('prescription_updated', data);
  });
  
  // Handle notification events
  socket.on('send_notification', (data) => {
    socket.to(`user_${data.userId}`).emit('new_notification', data);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible to other modules
app.set('io', io);

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

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/api/docs`);
});

module.exports = { server, io };