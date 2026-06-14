// MySQL/TiDB return DATETIME as "YYYY-MM-DD HH:MM:SS" (a space, no "T").
// Safari/iOS reject that form and `new Date(...)` yields "Invalid Date", which
// then renders literally in the UI. Normalizing the separator makes the string
// parse consistently across browsers (important for this mobile-first PWA).
export function parseDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a DB datetime for display, falling back to the raw value if unparseable. */
export function formatDbDateTime(value, locale = 'vi-VN') {
  const d = parseDbDate(value);
  return d ? d.toLocaleString(locale) : (value ?? '');
}
