const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const SCRIPT_RE = /<script[\s>][\s\S]*?<\/script>/gi;
const EVENT_HANDLER_RE = /\bon\w+\s*=\s*(['"]?)[\s\S]*?\1/gi;
const DANGEROUS_ENTITY_RE = /&#(?:x0*(?:6a|4a|61|41|76|56|73|53)|0*(?:106|74|97|65|118|86|115|83));/gi;

export function stripHtml(str: string): string;
export function stripHtml(str: unknown): unknown;
export function stripHtml(str: unknown): unknown {
  if (typeof str !== 'string') return str;
  return str
    .replace(SCRIPT_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(DANGEROUS_ENTITY_RE, '')
    .trim();
}

export function deepStripHtml<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return stripHtml(obj) as T;
  if (Array.isArray(obj)) return obj.map(deepStripHtml) as T;
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      out[key] = deepStripHtml(val);
    }
    return out as T;
  }
  return obj;
}

const SAFE_URL_RE = /^https?:\/\//i;

export function sanitizeUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  const trimmed = url.trim();
  return SAFE_URL_RE.test(trimmed) ? trimmed : null;
}