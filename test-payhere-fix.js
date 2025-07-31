/**
 * Test script to verify PayHere hash generation fix
 * Run this to confirm backend generates the same hashes as mobile app
 */

require('dotenv').config();
const crypto = require('crypto');

// Test data that matches mobile app test
const testData = {
  merchantId: process.env.PAYHERE_MERCHANT_ID || '1231130',
  merchantSecret:
    process.env.PAYHERE_MERCHANT_SECRET ||
    'MTQ3NDkyMzE0MjcyODc3MjQ3MzE1OTAyMDMzOTk1MDg1MTEyODY=',
  orderId: 'ORDER_001',
  amount: '1000.00',
  currency: 'LKR',
};

console.log('=== PayHere Hash Generation Test ===');
console.log('Test Data:', {
  merchantId: testData.merchantId,
  orderId: testData.orderId,
  amount: testData.amount,
  currency: testData.currency,
  merchantSecretLength: testData.merchantSecret.length,
});

// OLD METHOD (what was wrong)
function generateOldHash(data) {
  const hashString = `${data.merchantId}${data.orderId}${data.amount}${data.currency}${data.merchantSecret}`;
  return crypto
    .createHash('md5')
    .update(hashString)
    .digest('hex')
    .toUpperCase();
}

// NEW METHOD (corrected)
function generateNewHash(data) {
  // Step 1: Hash merchant secret
  const hashedSecret = crypto
    .createHash('md5')
    .update(data.merchantSecret)
    .digest('hex')
    .toUpperCase();

  // Step 2: Create hash string with hashed secret
  const hashString = `${data.merchantId}${data.orderId}${data.amount}${data.currency}${hashedSecret}`;

  // Step 3: Generate final hash
  return crypto
    .createHash('md5')
    .update(hashString)
    .digest('hex')
    .toUpperCase();
}

const oldHash = generateOldHash(testData);
const newHash = generateNewHash(testData);

console.log('\n=== Hash Comparison ===');
console.log('OLD Hash (Wrong):', oldHash);
console.log('NEW Hash (Fixed):', newHash);
console.log('Are they same?:', oldHash === newHash);

// Test with PayHere service (if available)
try {
  const payHereService = require('./src/utils/payhere.js');
  const serviceHash = payHereService.generateHash({
    orderId: testData.orderId,
    amount: parseFloat(testData.amount),
    currency: testData.currency,
  });

  console.log('\n=== Service Test ===');
  console.log('Service Hash:', serviceHash);
  console.log('Matches NEW Hash?:', serviceHash === newHash);
  console.log('Matches OLD Hash?:', serviceHash === oldHash);

  if (serviceHash === newHash) {
    console.log(
      '✅ SUCCESS: Backend service is now generating correct hashes!'
    );
  } else if (serviceHash === oldHash) {
    console.log('❌ ERROR: Backend service is still using old hash method!');
  } else {
    console.log('⚠️  WARNING: Backend service generating unexpected hash!');
  }
} catch (error) {
  console.log('\n❌ Could not test service:', error.message);
}

console.log('\n=== Expected Mobile App Hash ===');
console.log('Mobile app should generate:', newHash);
console.log('\n=== Test Complete ===');
