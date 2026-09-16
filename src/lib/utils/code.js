export function toCode(str) {
  return String(str || "").trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}