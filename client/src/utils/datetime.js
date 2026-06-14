// The server stores all timestamps in UTC (the DB session is pinned to UTC).
// MySQL/TiDB return DATETIME as "YYYY-MM-DD HH:MM:SS" (a space, no "T" and no
// zone) which (a) Safari/iOS reject -> "Invalid Date", and (b) every browser
// would otherwise parse as *local* time. We normalize the separator and tag the
// value as UTC so it parses everywhere and renders as the same instant for all
// viewers; formatting then converts to Vietnam local time for display.
const DISPLAY_TZ = 'Asia/Ho_Chi_Minh';

export function parseDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const normalized = String(value).replace(' ', 'T');
  // Only append the UTC marker if the string doesn't already carry a zone.
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized);
  const d = new Date(hasZone ? normalized : `${normalized}Z`);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a UTC DB datetime as Vietnam local time, falling back to the raw value. */
export function formatDbDateTime(value, locale = 'vi-VN') {
  const d = parseDbDate(value);
  return d ? d.toLocaleString(locale, { timeZone: DISPLAY_TZ }) : (value ?? '');
}
