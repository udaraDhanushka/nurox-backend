const crypto = require('crypto');
const logger = require('./logger');

class PayHereService {
  constructor() {
    this.merchantId = process.env.PAYHERE_MERCHANT_ID;
    this.merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    this.baseURL = process.env.PAYHERE_SANDBOX === 'true' 
      ? 'https://sandbox.payhere.lk' 
      : 'https://www.payhere.lk';
    this.currency = 'LKR';
    this.notifyURL = `${process.env.BASE_URL}/api/payments/payhere-webhook`;
    this.returnURL = 'nurox://payments/success';
    this.cancelURL = 'nurox://payments/cancel';
    
    // Validate required environment variables
    if (!this.merchantId || !this.merchantSecret) {
      throw new Error('PayHere merchant ID and secret are required');
    }
  }

  /**
   * Generate MD5 hash for PayHere payment
   * @param {Object} paymentData - Payment data object
   * @returns {string} - Generated hash
   */
  generateHash(paymentData) {
    try {
      const {
        orderId,
        amount,
        currency = this.currency,
        recurrence = '',
        duration = '',
        startupFee = ''
      } = paymentData;

      // Format amount to 2 decimal places
      const formattedAmount = parseFloat(amount).toFixed(2);
      const formattedStartupFee = startupFee ? parseFloat(startupFee).toFixed(2) : '';

      // Create hash string according to PayHere documentation
      let hashString = '';
      
      if (recurrence && duration) {
        // For recurring payments
        hashString = `${this.merchantId}${orderId}${formattedAmount}${currency}${recurrence}${duration}${formattedStartupFee}${this.merchantSecret}`;
      } else {
        // For one-time payments
        hashString = `${this.merchantId}${orderId}${formattedAmount}${currency}${this.merchantSecret}`;
      }

      // Generate MD5 hash and convert to uppercase
      const hash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();
      
      logger.info(`PayHere hash generated for order: ${orderId}`);
      return hash;
    } catch (error) {
      logger.error('PayHere hash generation error:', error);
      throw new Error('Failed to generate payment hash');
    }
  }

  /**
   * Verify PayHere notification hash
   * @param {Object} notificationData - Notification data from PayHere
   * @returns {boolean} - Hash verification result
   */
  verifyNotificationHash(notificationData) {
    try {
      const {
        merchant_id,
        order_id,
        payment_id,
        payhere_amount,
        payhere_currency,
        status_code,
        md5sig
      } = notificationData;

      // Create verification hash string
      const hashString = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${this.merchantSecret}`;
      const calculatedHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase();

      const isValid = calculatedHash === md5sig;
      
      if (isValid) {
        logger.info(`PayHere notification hash verified for order: ${order_id}, payment: ${payment_id}`);
      } else {
        logger.warn(`PayHere notification hash verification failed for order: ${order_id}`);
      }

      return isValid;
    } catch (error) {
      logger.error('PayHere notification hash verification error:', error);
      return false;
    }
  }

  /**
   * Generate payment form data for PayHere
   * @param {Object} paymentData - Payment data object
   * @returns {Object} - Complete payment form data
   */
  generatePaymentFormData(paymentData) {
    try {
      const {
        orderId,
        amount,
        items = 'Medical Services',
        firstName,
        lastName,
        email,
        phone,
        address,
        city,
        country = 'Sri Lanka',
        recurrence = '',
        duration = '',
        startupFee = 0
      } = paymentData;

      // Generate hash
      const hash = this.generateHash({
        orderId,
        amount,
        currency: this.currency,
        recurrence,
        duration,
        startupFee
      });

      const formData = {
        merchant_id: this.merchantId,
        return_url: this.returnURL,
        cancel_url: this.cancelURL,
        notify_url: this.notifyURL,
        order_id: orderId,
        items,
        currency: this.currency,
        amount: parseFloat(amount).toFixed(2),
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        address,
        city,
        country,
        hash
      };

      // Add recurring payment fields if applicable
      if (recurrence && duration) {
        formData.recurrence = recurrence;
        formData.duration = duration;
        if (startupFee > 0) {
          formData.startup_fee = parseFloat(startupFee).toFixed(2);
        }
      }

      logger.info(`PayHere payment form data generated for order: ${orderId}`);
      return formData;
    } catch (error) {
      logger.error('PayHere payment form data generation error:', error);
      throw new Error('Failed to generate payment form data');
    }
  }

  /**
   * Process PayHere status codes
   * @param {string} statusCode - PayHere status code
   * @returns {Object} - Status information
   */
  getPaymentStatus(statusCode) {
    const statusMap = {
      '2': { status: 'COMPLETED', message: 'Success' },
      '0': { status: 'PENDING', message: 'Pending' },
      '-1': { status: 'CANCELLED', message: 'Canceled' },
      '-2': { status: 'FAILED', message: 'Failed' },
      '-3': { status: 'FAILED', message: 'Chargedback' },
      '-4': { status: 'FAILED', message: 'Processing failed' },
      '-5': { status: 'FAILED', message: 'Invalid merchant' },
      '-6': { status: 'FAILED', message: 'Invalid parameters' },
      '-7': { status: 'FAILED', message: 'Invalid hash' },
      '-8': { status: 'FAILED', message: 'Duplicate order ID' }
    };

    return statusMap[statusCode] || { status: 'FAILED', message: 'Unknown status' };
  }

  /**
   * Validate PayHere configuration
   * @returns {boolean} - Configuration validity
   */
  isConfigurationValid() {
    const requiredFields = [
      'PAYHERE_MERCHANT_ID',
      'PAYHERE_MERCHANT_SECRET',
      'BASE_URL'
    ];

    const missingFields = requiredFields.filter(field => !process.env[field]);
    
    if (missingFields.length > 0) {
      logger.error(`PayHere configuration missing fields: ${missingFields.join(', ')}`);
      return false;
    }

    return true;
  }
}

module.exports = new PayHereService();