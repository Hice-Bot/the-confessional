/**
 * PII scrubbing module.
 * Detects and replaces personally identifiable information with [redacted].
 * Original text with PII is never stored — only the scrubbed version persists.
 */

// Email addresses: user@domain.tld
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Phone numbers: various formats (US-centric plus international)
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g;

// IPv4 addresses: 0.0.0.0 to 255.255.255.255
const IPV4_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// IPv6 addresses (simplified — catches common forms)
const IPV6_REGEX = /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}/g;

// Cryptocurrency wallet addresses (Bitcoin, Ethereum)
const CRYPTO_WALLET_REGEX = /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,39})\b/g;

/**
 * Scrub all PII patterns from text, replacing with [redacted].
 * Order matters: more specific patterns first to avoid partial matches.
 */
function scrubPii(text) {
  let result = text;
  result = result.replace(EMAIL_REGEX, '[redacted]');
  result = result.replace(CRYPTO_WALLET_REGEX, '[redacted]');
  result = result.replace(IPV6_REGEX, '[redacted]');
  result = result.replace(IPV4_REGEX, '[redacted]');
  result = result.replace(PHONE_REGEX, '[redacted]');
  return result;
}

module.exports = { scrubPii };
