export function round2(n) {
  if (n == null || Number.isNaN(Number(n))) return 0;
  return Math.round(Number(n) * 100) / 100;
}
export function formatMoney(n, currency = "₹") {
  const v = round2(n);
  return `${currency}${v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}