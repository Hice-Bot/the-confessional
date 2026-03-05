/**
 * Text sanitization module.
 * - HTML entity escaping (angle brackets, ampersands, quotes)
 * - Strip script tags and event handler attributes
 * - Strip control characters (except newlines and tabs)
 * - Prevent XSS via comprehensive escaping
 */

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip script tags and their contents.
 */
function stripScripts(text) {
  return text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

/**
 * Strip event handler attributes (onclick, onload, onerror, etc.).
 */
function stripEventHandlers(text) {
  return text.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Strip control characters except newlines (\n) and tabs (\t).
 */
function stripControlChars(text) {
  // Remove control chars (0x00-0x1F) except \t (0x09) and \n (0x0A)
  // Also remove 0x7F (DEL) and other control ranges
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Full sanitization pipeline: strip scripts → strip event handlers → strip control chars → escape HTML.
 */
function sanitize(text) {
  let result = text;
  result = stripScripts(result);
  result = stripEventHandlers(result);
  result = stripControlChars(result);
  result = escapeHtml(result);
  return result;
}

module.exports = { sanitize, escapeHtml, stripScripts, stripEventHandlers, stripControlChars };
