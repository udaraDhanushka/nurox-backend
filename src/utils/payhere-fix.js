/**
 * FIXED PayHere Service - Corrected hash generation to match PayHere specification
 *
 * This file contains the corrected implementation that needs to replace the current
 * hash generation methods in /home/udara/Documents/CCCU/nurox-backend/src/utils/payhere.js
 */

const crypto = require('crypto');

class PayHereService {
  constructor() {
    this.merchantId = process.env.PAYHERE_MERCHANT_ID;
    this.merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
    this.sandbox = process.env.PAYHERE_SANDBOX === 'true';
    this.baseUrl = process.env.BASE_URL;

    // Validate required environment variables
    if (!this.merchantId || !this.merchantSecret) {
      throw new Error('PayHere merchant credentials are required');
    }
  }

  /**
   * CORRECTED: Generate PayHere payment hash according to official specification
   * hash = MD5(merchant_id + order_id + amount + currency + MD5(merchant_secret).toUpperCase()).toUpperCase()
   */
  generatePaymentHash(
    orderId,
    amount,
    currency = 'LKR',
    recurrence = null,
    duration = null,
    startupFee = 0
  ) {
    try {
      // Format amounts to 2 decimal places without commas
      const formattedAmount = parseFloat(amount).toFixed(2);
      const formattedStartupFee = parseFloat(startupFee).toFixed(2);

      // STEP 1: Hash the merchant secret and convert to uppercase (CRITICAL FIX)
      const hashedSecret = crypto
        .createHash('md5')
        .update(this.merchantSecret)
        .digest('hex')
        .toUpperCase();

      let hashString;
      if (recurrence && duration) {
        // For recurring payments
        hashString = `${this.merchantId}${orderId}${formattedAmount}${currency}${recurrence}${duration}${formattedStartupFee}${hashedSecret}`;
      } else {
        // For one-time payments
        hashString = `${this.merchantId}${orderId}${formattedAmount}${currency}${hashedSecret}`;
      }

      // STEP 2: Hash the complete string and convert to uppercase
      const hash = crypto
        .createHash('md5')
        .update(hashString)
        .digest('hex')
        .toUpperCase();

      console.log('PayHere Hash Generation (CORRECTED):', {
        merchantId: this.merchantId,
        orderId,
        formattedAmount,
        currency,
        hashedSecretPrefix: hashedSecret.substring(0, 8) + '...',
        finalHash: hash,
      });

      return hash;
    } catch (error) {
      console.error('PayHere hash generation error:', error);
      throw new Error('Failed to generate PayHere hash');
    }
  }

  /**
   * CORRECTED: Verify PayHere webhook notification hash
   * md5sig = MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(merchant_secret).toUpperCase()).toUpperCase()
   */
  verifyNotificationHash(
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig
  ) {
    try {
      // STEP 1: Hash the merchant secret and convert to uppercase (CRITICAL FIX)
      const hashedSecret = crypto
        .createHash('md5')
        .update(this.merchantSecret)
        .digest('hex')
        .toUpperCase();

      // STEP 2: Create verification hash string
      const hashString = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`;

      // STEP 3: Generate verification hash
      const calculatedHash = crypto
        .createHash('md5')
        .update(hashString)
        .digest('hex')
        .toUpperCase();

      const isValid = calculatedHash === md5sig;

      console.log('PayHere Webhook Verification (CORRECTED):', {
        merchant_id,
        order_id,
        payhere_amount,
        payhere_currency,
        status_code,
        hashedSecretPrefix: hashedSecret.substring(0, 8) + '...',
        calculatedHash,
        receivedHash: md5sig,
        isValid,
      });

      return { isValid, calculatedHash, receivedHash: md5sig };
    } catch (error) {
      console.error('PayHere verification error:', error);
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Generate complete PayHere form data for frontend
   */
  generatePaymentFormData(paymentData) {
    try {
      const {
        orderId,
        amount,
        currency = 'LKR',
        customerInfo,
        description,
        recurrence,
        duration,
        startupFee = 0,
      } = paymentData;

      // Generate hash using corrected algorithm
      const hash = this.generatePaymentHash(
        orderId,
        amount,
        currency,
        recurrence,
        duration,
        startupFee
      );

      // Generate return/cancel/notify URLs
      const returnUrl = `${this.baseUrl}/payments/success`;
      const cancelUrl = `${this.baseUrl}/payments/cancel`;
      const notifyUrl = `${this.baseUrl}/api/payments/payhere-webhook`;

      const formData = {
        merchant_id: this.merchantId,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        notify_url: notifyUrl,
        order_id: orderId,
        items: description || 'Payment',
        currency: currency,
        amount: parseFloat(amount).toFixed(2),
        first_name: customerInfo.firstName,
        last_name: customerInfo.lastName,
        email: customerInfo.email,
        phone: customerInfo.phone,
        address: customerInfo.address,
        city: customerInfo.city,
        country: customerInfo.country || 'LK',
        hash: hash,
      };

      // Add recurring payment fields if present
      if (recurrence && duration) {
        formData.recurrence = recurrence;
        formData.duration = duration;
        if (startupFee > 0) {
          formData.startup_fee = parseFloat(startupFee).toFixed(2);
        }
      }

      return formData;
    } catch (error) {
      console.error('PayHere form data generation error:', error);
      throw new Error('Failed to generate PayHere form data');
    }
  }
}

module.exports = new PayHereService();

/**
 * INSTRUCTIONS FOR IMPLEMENTATION:
 *
 * 1. Replace the generatePaymentHash method in your current payhere.js file with the corrected version above
 * 2. Replace the verifyNotificationHash method with the corrected version above
 * 3. The key changes are:
 *    - Hash the merchant secret with MD5 BEFORE using it in the hash string
 *    - Use the hashed secret instead of the raw secret in hash generation
 *
 * BEFORE (Incorrect):
 * hashString = merchantId + orderId + amount + currency + merchantSecret
 *
 * AFTER (Correct):
 * hashedSecret = MD5(merchantSecret).toUpperCase()
 * hashString = merchantId + orderId + amount + currency + hashedSecret
 *
 * This will make your backend generate the same hashes as PayHere expects.
 */
