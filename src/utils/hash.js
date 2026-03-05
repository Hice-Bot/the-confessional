const crypto = require('crypto');

/**
 * Compute SHA-256 hash of input string.
 * Used to hash session IDs before storing — ensures confessions cannot be traced back to sessions.
 */
function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

module.exports = { sha256 };
