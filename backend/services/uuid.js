const crypto = require('crypto');

function generateUuidV4() {
  return crypto.randomUUID(); // built-in in Node.js 14+
}

module.exports = { generateUuidV4 };