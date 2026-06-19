/**
 * FR15: session-based parking fee.
 *
 * Vietnam is permanently UTC+7 (no DST). Vercel runs in UTC, so all VN local
 * time is derived by adding the fixed offset then reading UTC components.
 *
 * Rules:
 *   Same VN calendar day, exit before 18:00 VN  →  4,000 VND
 *   Same VN calendar day, exit at/after 18:00 VN →  6,000 VND
 *   Exit on a later VN calendar day              →  100,000 VND × nights
 *     where nights = (VN exit date) − (VN entry date) in calendar days
 */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY   = 24 * 60 * 60 * 1000;

function vnDayIndex(date) {
  return Math.floor((date.getTime() + VN_OFFSET_MS) / MS_PER_DAY);
}

function vnHour(date) {
  return Math.floor(((date.getTime() + VN_OFFSET_MS) % MS_PER_DAY) / (60 * 60 * 1000));
}

export function calculateFee(entryAt, exitAt = new Date()) {
  const entryDay = vnDayIndex(entryAt);
  const exitDay  = vnDayIndex(exitAt);

  if (entryDay === exitDay) {
    return vnHour(exitAt) < 18 ? 4000 : 6000;
  }

  const nights = exitDay - entryDay; // always ≥ 1
  return nights * 100_000;
}
