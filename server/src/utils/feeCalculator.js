/**
 * FR15: simple time-based parking fee (day rate before 18:00, night rate after).
 *
 * Vercel's serverless runtime is UTC, so `date.getHours()` would read the UTC
 * hour and shift the day/night boundary 7 hours off real local time. Vietnam
 * has no DST and is permanently UTC+7, so we add the fixed offset and read the
 * UTC hour of the shifted instant to get the true Ho Chi Minh City hour.
 */
export function calculateFee(date = new Date()) {
  const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
  const vnHour = new Date(date.getTime() + VN_OFFSET_MS).getUTCHours();
  return vnHour < 18 ? 4000 : 6000;
}
