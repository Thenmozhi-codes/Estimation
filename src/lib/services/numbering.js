import { mockStore } from "@/lib/store/mockStore";

export function nextDocumentNumber(prefix, year = new Date().getFullYear()) {
  const seq = mockStore.nextNumber(prefix);
  const padded = String(seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}