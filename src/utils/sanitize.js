/**
 * Input sanitization utilities.
 * Defence-in-depth: strips HTML/script content from user-supplied strings
 * before they reach the database.
 */

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const SCRIPT_RE = /<script[\s>][\s\S]*?<\/script>/gi;
const EVENT_HANDLER_RE = /\bon\w+\s*=\s*(['"]?)[\s\S]*?\1/gi;
const DANGEROUS_ENTITY_RE = /&#(?:x0*(?:6a|4a|61|41|76|56|73|53)|0*(?:106|74|97|65|118|86|115|83));/gi;

/**
 * Strip HTML tags and event handlers from a string.
 * Designed for plain-text fields (lyrics, titles, filenames) — not for rich HTML.
 */
export function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(SCRIPT_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(DANGEROUS_ENTITY_RE, '')
    .trim();
}

/**
 * Recursively strip HTML from all string values in an object.
 * Leaves numbers, booleans, and nulls untouched.
 */
export function deepStripHtml(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return stripHtml(obj);
  if (Array.isArray(obj)) return obj.map(deepStripHtml);
  if (typeof obj === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(obj)) {
      out[key] = deepStripHtml(val);
    }
    return out;
  }
  return obj;
}

const SAFE_URL_RE = /^https?:\/\//i;

/**
 * Validate that a URL uses http or https protocol.
 * Returns null for invalid/dangerous URLs (javascript:, data:, etc.)
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  const trimmed = url.trim();
  return SAFE_URL_RE.test(trimmed) ? trimmed : null;
}
