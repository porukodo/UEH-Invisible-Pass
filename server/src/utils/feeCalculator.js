/** FR15: simple time-based parking fee. */
export function calculateFee(date = new Date()) {
  const hour = date.getHours();
  return hour < 18 ? 4000 : 6000;
}
