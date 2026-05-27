import { verifyTelegramSignature } from './telegramSignature.middleware.js';

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

const fakeBotToken = '12345:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.TELEGRAM_BOT_TOKEN = fakeBotToken;

const expectedToken = fakeBotToken.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 256);

let passed = 0;
let nextCalled = false;

// Test 1: Valid Signature
console.log("Test 1: Valid Secret Token");
const req1 = {
  headers: { 'x-telegram-bot-api-secret-token': expectedToken }
};
verifyTelegramSignature(req1, mockRes, () => { nextCalled = true; });
if (nextCalled) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed");
}

// Test 2: Invalid Signature
console.log("\nTest 2: Invalid Secret Token");
nextCalled = false;
const req2 = {
  headers: { 'x-telegram-bot-api-secret-token': 'wrongToken' }
};
verifyTelegramSignature(req2, mockRes, () => { nextCalled = true; });
if (!nextCalled && mockRes.statusCode === 401) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed", mockRes);
}

// Test 3: Missing Signature
console.log("\nTest 3: Missing Secret Token");
nextCalled = false;
const req3 = {
  headers: {}
};
verifyTelegramSignature(req3, mockRes, () => { nextCalled = true; });
if (!nextCalled && mockRes.statusCode === 401) {
  console.log("✅ Passed");
  passed++;
} else {
  console.log("❌ Failed", mockRes);
}

console.log(`\nResults: ${passed}/3 passed.`);
