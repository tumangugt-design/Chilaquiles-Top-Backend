import crypto from 'crypto';
import { verifyMetaSignature } from './metaSignature.middleware.js';

// Mock request and response
const mockRes = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  send: function(msg) {
    this.message = msg;
    return this;
  }
};

const appSecret = 'test_secret_123';
process.env.META_APP_SECRET = appSecret;

const payloadString = JSON.stringify({ object: 'instagram', entry: [{}] });
const rawBodyBuffer = Buffer.from(payloadString);

// Valid signature
const validHash = crypto.createHmac('sha256', appSecret).update(rawBodyBuffer).digest('hex');
const validSignature = `sha256=${validHash}`;

// Invalid signature
const invalidSignature = `sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`;

let passed = 0;
let nextCalled = false;

// Test 1: Valid Signature
console.log("Test 1: Valid Signature");
const req1 = {
  headers: { 'x-hub-signature-256': validSignature },
  rawBody: rawBodyBuffer
};
verifyMetaSignature(req1, mockRes, () => { nextCalled = true; });
if (nextCalled) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed");
}

// Test 2: Invalid Signature
console.log("\nTest 2: Invalid Signature");
nextCalled = false;
const req2 = {
  headers: { 'x-hub-signature-256': invalidSignature },
  rawBody: rawBodyBuffer
};
verifyMetaSignature(req2, mockRes, () => { nextCalled = true; });
if (!nextCalled && mockRes.statusCode === 401) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed", mockRes);
}

// Test 3: Missing Signature
console.log("\nTest 3: Missing Signature");
nextCalled = false;
const req3 = {
  headers: {},
  rawBody: rawBodyBuffer
};
verifyMetaSignature(req3, mockRes, () => { nextCalled = true; });
if (!nextCalled && mockRes.statusCode === 401) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed", mockRes);
}

console.log(`\nResults: ${passed}/3 passed.`);
