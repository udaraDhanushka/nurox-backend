const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const chatController = {
  // Send message
  sendMessage: async (req, res) => {
    try {
      const {
        receiverId,
        message,
        attachments = [],
        metadata = {}
      } = req.body;

      // Verify receiver exists
      const receiver = await prisma.user.findUnique({
        where: { id: receiverId }
      });

      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        });
      }

      const chatMessage = await prisma.chatMessage.create({
        data: {
          senderId: req.user.id,
          receiverId,
          message,
          attachments,
          metadata
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
              role: true
            }
          }
        }
      });

      // Send real-time message via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${receiverId}`).emit('new_message', {
          id: chatMessage.id,
          senderId: req.user.id,
          senderName: `${req.user.firstName} ${req.user.lastName}`,
          senderImage: req.user.profileImage,
          message: chatMessage.message,
          attachments: chatMessage.attachments,
          createdAt: chatMessage.createdAt
        });
      }

      // Create notification for receiver
      await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'CHAT_MESSAGE',
          title: 'New Message',
          message: `New message from ${req.user.firstName} ${req.user.lastName}`,
          data: {
            chatMessageId: chatMessage.id,
            senderId: req.user.id
          }
        }
      });

      logger.info(`Message sent from ${req.user.email} to ${receiver.email}`);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: chatMessage
      });
    } catch (error) {
      logger.error('Send message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message'
      });
    }
  },

  // Get chat messages between two users
  getMessages: async (req, res) => {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (page - 1) * limit;

      // Verify the other user exists
      const otherUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true,
          role: true
        }
      });

      if (!otherUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const [messages, total] = await Promise.all([
        prisma.chatMessage.findMany({
          where: {
            OR: [
              {
                senderId: req.user.id,
                receiverId: userId
              },
              {
                senderId: userId,
                receiverId: req.user.id
              }
            ]
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.chatMessage.count({
          where: {
            OR: [
              {
                senderId: req.user.id,
                receiverId: userId
              },
              {
                senderId: userId,
                receiverId: req.user.id
              }
            ]
          }
        })
      ]);

      // Mark messages from the other user as read
      await prisma.chatMessage.updateMany({
        where: {
          senderId: userId,
          receiverId: req.user.id,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({
        success: true,
        data: {
          messages: messages.reverse(), // Reverse to show oldest first
          otherUser,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get messages'
      });
    }
  },

  // Get chat conversations list
  getConversations: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      // Get latest message for each conversation
      const conversations = await prisma.$queryRaw`
        SELECT DISTINCT 
          CASE 
            WHEN sender_id = ${req.user.id} THEN receiver_id 
            ELSE sender_id 
          END as other_user_id,
          MAX(created_at) as last_message_time
        FROM chat_messages 
        WHERE sender_id = ${req.user.id} OR receiver_id = ${req.user.id}
        GROUP BY other_user_id
        ORDER BY last_message_time DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(skip)}
      `;

      // Get user details and latest message for each conversation
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          const [otherUser, latestMessage, unreadCount] = await Promise.all([
            prisma.user.findUnique({
              where: { id: conv.other_user_id },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                role: true,
                isActive: true
              }
            }),
            prisma.chatMessage.findFirst({
              where: {
                OR: [
                  {
                    senderId: req.user.id,
                    receiverId: conv.other_user_id
                  },
                  {
                    senderId: conv.other_user_id,
                    receiverId: req.user.id
                  }
                ]
              },
              orderBy: { createdAt: 'desc' }
            }),
            prisma.chatMessage.count({
              where: {
                senderId: conv.other_user_id,
                receiverId: req.user.id,
                isRead: false
              }
            })
          ]);

          return {
            otherUser,
            latestMessage,
            unreadCount,
            lastMessageTime: conv.last_message_time
          };
        })
      );

      const total = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT 
          CASE 
            WHEN sender_id = ${req.user.id} THEN receiver_id 
            ELSE sender_id 
          END
        ) as count
        FROM chat_messages 
        WHERE sender_id = ${req.user.id} OR receiver_id = ${req.user.id}
      `;

      res.json({
        success: true,
        data: {
          conversations: conversationsWithDetails.filter(conv => conv.otherUser),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total[0].count),
            pages: Math.ceil(parseInt(total[0].count) / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get conversations'
      });
    }
  },

  // Mark message as read
  markAsRead: async (req, res) => {
    try {
      const { messageId } = req.params;

      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Only the receiver can mark message as read
      if (message.receiverId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await prisma.chatMessage.update({
        where: { id: messageId },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Message marked as read'
      });
    } catch (error) {
      logger.error('Mark message as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark message as read'
      });
    }
  },

  // Get chat participants (doctors/pharmacists available for chat)
  getChatParticipants: async (req, res) => {
    try {
      const { role, search } = req.query;

      const where = {
        isActive: true,
        id: { not: req.user.id } // Exclude current user
      };

      // Filter by role if specified
      if (role) {
        where.role = role.toUpperCase();
      } else {
        // Only show doctors and pharmacists for patients
        if (req.user.role === 'PATIENT') {
          where.role = { in: ['DOCTOR', 'PHARMACIST'] };
        }
      }

      // Search functionality
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const participants = await prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImage: true,
          role: true,
          doctorProfile: {
            select: {
              specialization: true,
              hospitalAffiliation: true
            }
          },
          pharmacistProfile: {
            select: {
              pharmacyAffiliation: true
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      });

      res.json({
        success: true,
        data: participants
      });
    } catch (error) {
      logger.error('Get chat participants error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get chat participants'
      });
    }
  },

  // Delete message
  deleteMessage: async (req, res) => {
    try {
      const { messageId } = req.params;

      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId }
      });

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      // Only the sender can delete the message
      if (message.senderId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only the sender can delete this message.'
        });
      }

      await prisma.chatMessage.delete({
        where: { id: messageId }
      });

      logger.info(`Message deleted: ${messageId} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      logger.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete message'
      });
    }
  }
};

module.exports = chatController;