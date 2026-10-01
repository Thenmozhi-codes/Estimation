/*
 * Preview of the next document number (quotation / invoice).
 *
 * Reads the numbers that already exist, finds the highest trailing counter,
 * adds 1, and keeps the same prefix and zero-padding:
 *
 *   QT-0007  →  QT-0008
 *   INV-2026-0042  →  INV-2026-0043
 *
 * When nothing exists yet it starts at `${fallbackPrefix}0001`.
 *
 * This is only a preview shown while filling the form.
 * The real number is still assigned by the backend when the document is saved.
 */
export function getNextDocumentNumber(documents, fallbackPrefix = "DOC-") {
  const list = Array.isArray(documents)
    ? documents
    : Array.isArray(documents?.data)
      ? documents.data
      : [];

  let best = null;

  for (const document of list) {
    const match = String(document?.number ?? "").match(/^(.*?)(\d+)$/);

    if (!match) continue;

    const counter = Number(match[2]);

    if (!best || counter > best.counter) {
      best = {
        prefix: match[1],
        digits: match[2].length,
        counter,
      };
    }
  }

  if (!best) return `${fallbackPrefix}0001`;

  return `${best.prefix}${String(best.counter + 1).padStart(best.digits, "0")}`;
}