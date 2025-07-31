const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const prisma = new PrismaClient();

const ocrController = {
  // Process prescription image with OCR
  processPrescriptionImage: async (req, res) => {
    try {
      const { imageBase64, enhanceImage = true } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          success: false,
          message: 'Image data is required',
        });
      }

      // Generate unique filename
      const filename = `prescription_${uuidv4()}.jpg`;
      const uploadsDir = path.join(__dirname, '../uploads');
      const filepath = path.join(uploadsDir, filename);

      // Ensure uploads directory exists
      await fs.mkdir(uploadsDir, { recursive: true });

      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      let processedImageBuffer = imageBuffer;

      // Enhance image if requested
      if (enhanceImage) {
        processedImageBuffer = await sharp(imageBuffer)
          .resize(2000, null, {
            withoutEnlargement: true,
            fit: 'inside',
          })
          .sharpen()
          .normalize()
          .jpeg({ quality: 95 })
          .toBuffer();
      }

      // Save processed image
      await fs.writeFile(filepath, processedImageBuffer);

      // Perform OCR
      const ocrResult = await Tesseract.recognize(processedImageBuffer, 'eng', {
        logger: (m) => console.log(m),
      });

      // Extract text and confidence
      const extractedText = ocrResult.data.text;
      const confidence = ocrResult.data.confidence / 100;

      // Parse medicines from OCR text (basic implementation)
      const detectedMedicines = await parseMedicinesFromText(extractedText);

      // Save OCR result to database
      const ocrRecord = await prisma.document.create({
        data: {
          userId: req.user.id,
          type: 'PRESCRIPTION',
          title: 'OCR Processed Prescription',
          description: 'Prescription processed via OCR',
          fileName: filename,
          filePath: filepath,
          fileSize: processedImageBuffer.length,
          mimeType: 'image/jpeg',
          metadata: {
            ocrText: extractedText,
            ocrConfidence: confidence,
            detectedMedicines: detectedMedicines.length,
            enhancementApplied: enhanceImage,
          },
        },
      });

      logger.info(`OCR processing completed for user: ${req.user.email}`);

      res.json({
        success: true,
        message: 'Image processed successfully',
        data: {
          documentId: ocrRecord.id,
          extractedText,
          confidence,
          detectedMedicines,
          processingTime: ocrResult.data.psm,
          imageUrl: `/uploads/${filename}`,
        },
      });
    } catch (error) {
      logger.error('OCR processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process image',
      });
    }
  },

  // Validate OCR results
  validateOCRResults: async (req, res) => {
    try {
      const { documentId, corrections } = req.body;

      const document = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found',
        });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Update document with corrections
      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          metadata: {
            ...document.metadata,
            corrections,
            validatedAt: new Date().toISOString(),
            validatedBy: req.user.id,
          },
        },
      });

      logger.info(`OCR validation completed for document: ${documentId}`);

      res.json({
        success: true,
        message: 'OCR results validated successfully',
        data: updatedDocument,
      });
    } catch (error) {
      logger.error('OCR validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate OCR results',
      });
    }
  },

  // Get OCR history
  getOCRHistory: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const skip = (page - 1) * limit;

      const [documents, total] = await Promise.all([
        prisma.document.findMany({
          where: {
            userId: req.user.id,
            type: 'PRESCRIPTION',
          },
          orderBy: { uploadedAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit),
        }),
        prisma.document.count({
          where: {
            userId: req.user.id,
            type: 'PRESCRIPTION',
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          documents,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Get OCR history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get OCR history',
      });
    }
  },

  // Enhance image quality
  enhanceImage: async (req, res) => {
    try {
      const { imageBase64, options = {} } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          success: false,
          message: 'Image data is required',
        });
      }

      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Apply enhancements
      let enhancedImage = sharp(imageBuffer);

      // Resize if too large
      if (options.resize !== false) {
        enhancedImage = enhancedImage.resize(2000, null, {
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      // Apply sharpening
      if (options.sharpen !== false) {
        enhancedImage = enhancedImage.sharpen();
      }

      // Normalize contrast
      if (options.normalize !== false) {
        enhancedImage = enhancedImage.normalize();
      }

      // Apply noise reduction
      if (options.denoise) {
        enhancedImage = enhancedImage.median(3);
      }

      // Convert to grayscale if requested
      if (options.grayscale) {
        enhancedImage = enhancedImage.grayscale();
      }

      // Adjust brightness/contrast if specified
      if (options.brightness || options.contrast) {
        enhancedImage = enhancedImage.modulate({
          brightness: options.brightness || 1,
          saturation: options.contrast || 1,
        });
      }

      const enhancedBuffer = await enhancedImage
        .jpeg({ quality: 95 })
        .toBuffer();

      // Convert back to base64
      const enhancedBase64 = `data:image/jpeg;base64,${enhancedBuffer.toString('base64')}`;

      res.json({
        success: true,
        message: 'Image enhanced successfully',
        data: {
          enhancedImage: enhancedBase64,
          originalSize: imageBuffer.length,
          enhancedSize: enhancedBuffer.length,
          compressionRatio: (
            imageBuffer.length / enhancedBuffer.length
          ).toFixed(2),
        },
      });
    } catch (error) {
      logger.error('Image enhancement error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enhance image',
      });
    }
  },

  // Get OCR analytics
  getOCRAnalytics: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const where = {
        userId: req.user.id,
        type: 'PRESCRIPTION',
      };

      if (startDate || endDate) {
        where.uploadedAt = {};
        if (startDate) where.uploadedAt.gte = new Date(startDate);
        if (endDate) where.uploadedAt.lte = new Date(endDate);
      }

      const documents = await prisma.document.findMany({
        where,
        select: {
          metadata: true,
          uploadedAt: true,
        },
      });

      const analytics = {
        totalProcessed: documents.length,
        averageConfidence: 0,
        highConfidenceCount: 0,
        lowConfidenceCount: 0,
        enhancedImages: 0,
        totalMedicinesDetected: 0,
      };

      if (documents.length > 0) {
        let totalConfidence = 0;
        let confidenceCount = 0;

        documents.forEach((doc) => {
          const metadata = doc.metadata || {};

          if (metadata.ocrConfidence) {
            totalConfidence += metadata.ocrConfidence;
            confidenceCount++;

            if (metadata.ocrConfidence >= 0.8) {
              analytics.highConfidenceCount++;
            } else if (metadata.ocrConfidence < 0.6) {
              analytics.lowConfidenceCount++;
            }
          }

          if (metadata.enhancementApplied) {
            analytics.enhancedImages++;
          }

          if (metadata.detectedMedicines) {
            analytics.totalMedicinesDetected += metadata.detectedMedicines;
          }
        });

        analytics.averageConfidence =
          confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
      }

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      logger.error('Get OCR analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get OCR analytics',
      });
    }
  },
};

// Helper function to parse medicines from OCR text
async function parseMedicinesFromText(text) {
  const detectedMedicines = [];

  try {
    // Get all medicines from database for matching
    const medicines = await prisma.medicine.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        genericName: true,
        brand: true,
      },
    });

    // Simple text parsing - look for medicine names
    const words = text.toLowerCase().split(/\s+/);

    medicines.forEach((medicine) => {
      const names = [
        medicine.name?.toLowerCase(),
        medicine.genericName?.toLowerCase(),
        medicine.brand?.toLowerCase(),
      ].filter(Boolean);

      names.forEach((name) => {
        if (words.some((word) => word.includes(name) || name.includes(word))) {
          // Check if already detected
          if (!detectedMedicines.find((m) => m.id === medicine.id)) {
            detectedMedicines.push({
              id: medicine.id,
              name: medicine.name,
              genericName: medicine.genericName,
              brand: medicine.brand,
              confidence: 0.7, // Basic confidence score
              detected: true,
              source: 'ocr',
            });
          }
        }
      });
    });

    return detectedMedicines;
  } catch (error) {
    logger.error('Medicine parsing error:', error);
    return [];
  }
}

module.exports = ocrController;
