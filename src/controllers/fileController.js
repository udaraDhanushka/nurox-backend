const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'));
    }
  }
});

const fileController = {
  // Upload middleware
  uploadMiddleware: upload.single('file'),

  // Upload file
  uploadFile: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const {
        type = 'OTHER',
        title,
        description,
        prescriptionId,
        isPublic = false
      } = req.body;

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname);
      const filename = `${uuidv4()}${fileExtension}`;
      const uploadsDir = path.join(__dirname, '../uploads');
      const filepath = path.join(uploadsDir, filename);

      // Ensure uploads directory exists
      await fs.mkdir(uploadsDir, { recursive: true });

      let processedBuffer = req.file.buffer;

      // Process images
      if (req.file.mimetype.startsWith('image/')) {
        // Resize and optimize image
        processedBuffer = await sharp(req.file.buffer)
          .resize(2000, 2000, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 85 })
          .toBuffer();
      }

      // Save file
      await fs.writeFile(filepath, processedBuffer);

      // Create document record
      const document = await prisma.document.create({
        data: {
          userId: req.user.id,
          prescriptionId: prescriptionId || null,
          type,
          title: title || req.file.originalname,
          description,
          fileName: filename,
          filePath: filepath,
          fileSize: processedBuffer.length,
          mimeType: req.file.mimetype,
          isPublic: isPublic === 'true',
          metadata: {
            originalName: req.file.originalname,
            uploadedBy: req.user.id,
            processed: req.file.mimetype.startsWith('image/')
          }
        }
      });

      logger.info(`File uploaded: ${filename} by ${req.user.email}`);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          id: document.id,
          filename: document.fileName,
          originalName: req.file.originalname,
          size: document.fileSize,
          type: document.type,
          url: `/api/files/${document.id}/download`
        }
      });
    } catch (error) {
      logger.error('Upload file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  },

  // Get user files
  getFiles: async (req, res) => {
    try {
      const {
        type,
        prescriptionId,
        page = 1,
        limit = 20
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { userId: req.user.id };

      if (type) where.type = type;
      if (prescriptionId) where.prescriptionId = prescriptionId;

      const [files, total] = await Promise.all([
        prisma.document.findMany({
          where,
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            isPublic: true,
            metadata: true,
            prescriptionId: true
          },
          orderBy: { uploadedAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.document.count({ where })
      ]);

      // Add download URLs
      const filesWithUrls = files.map(file => ({
        ...file,
        downloadUrl: `/api/files/${file.id}/download`,
        thumbnailUrl: file.mimeType.startsWith('image/') ? `/api/files/${file.id}/thumbnail` : null
      }));

      res.json({
        success: true,
        data: {
          files: filesWithUrls,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get files error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get files'
      });
    }
  },

  // Download file
  downloadFile: async (req, res) => {
    try {
      const { id } = req.params;

      const document = await prisma.document.findUnique({
        where: { id }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check access permissions
      if (document.userId !== req.user.id && !document.isPublic) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check if file exists
      try {
        await fs.access(document.filePath);
      } catch (error) {
        return res.status(404).json({
          success: false,
          message: 'File not found on server'
        });
      }

      // Set appropriate headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.setHeader('Content-Length', document.fileSize);

      // Stream file
      const fileStream = require('fs').createReadStream(document.filePath);
      fileStream.pipe(res);

      logger.info(`File downloaded: ${document.fileName} by ${req.user.email}`);
    } catch (error) {
      logger.error('Download file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download file'
      });
    }
  },

  // Generate thumbnail for images
  getThumbnail: async (req, res) => {
    try {
      const { id } = req.params;
      const { width = 200, height = 200 } = req.query;

      const document = await prisma.document.findUnique({
        where: { id }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check access permissions
      if (document.userId !== req.user.id && !document.isPublic) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Only generate thumbnails for images
      if (!document.mimeType.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Thumbnails are only available for images'
        });
      }

      // Generate thumbnail
      const thumbnail = await sharp(document.filePath)
        .resize(parseInt(width), parseInt(height), {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.send(thumbnail);
    } catch (error) {
      logger.error('Get thumbnail error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate thumbnail'
      });
    }
  },

  // Delete file
  deleteFile: async (req, res) => {
    try {
      const { id } = req.params;

      const document = await prisma.document.findUnique({
        where: { id }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check ownership
      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Delete file from filesystem
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        logger.warn(`File not found on filesystem: ${document.filePath}`);
      }

      // Delete document record
      await prisma.document.delete({
        where: { id }
      });

      logger.info(`File deleted: ${document.fileName} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      logger.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file'
      });
    }
  },

  // Update file metadata
  updateFile: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, type, isPublic } = req.body;

      const document = await prisma.document.findUnique({
        where: { id }
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check ownership
      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (isPublic !== undefined) updateData.isPublic = isPublic;

      const updatedDocument = await prisma.document.update({
        where: { id },
        data: updateData
      });

      logger.info(`File metadata updated: ${id} by ${req.user.email}`);

      res.json({
        success: true,
        message: 'File updated successfully',
        data: updatedDocument
      });
    } catch (error) {
      logger.error('Update file error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update file'
      });
    }
  },

  // Get file analytics
  getFileAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const where = { userId: req.user.id };

      if (startDate || endDate) {
        where.uploadedAt = {};
        if (startDate) where.uploadedAt.gte = new Date(startDate);
        if (endDate) where.uploadedAt.lte = new Date(endDate);
      }

      const [
        totalFiles,
        totalSize,
        filesByType,
        recentUploads
      ] = await Promise.all([
        prisma.document.count({ where }),
        prisma.document.aggregate({
          where,
          _sum: { fileSize: true }
        }),
        prisma.document.groupBy({
          by: ['type'],
          where,
          _count: { type: true },
          _sum: { fileSize: true }
        }),
        prisma.document.findMany({
          where,
          select: {
            id: true,
            title: true,
            type: true,
            fileSize: true,
            uploadedAt: true
          },
          orderBy: { uploadedAt: 'desc' },
          take: 10
        })
      ]);

      res.json({
        success: true,
        data: {
          totalFiles,
          totalSize: totalSize._sum.fileSize || 0,
          filesByType: filesByType.map(item => ({
            type: item.type,
            count: item._count.type,
            totalSize: item._sum.fileSize || 0
          })),
          recentUploads
        }
      });
    } catch (error) {
      logger.error('Get file analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get file analytics'
      });
    }
  }
};

module.exports = fileController;