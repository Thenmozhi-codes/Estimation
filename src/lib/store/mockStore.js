const KEY = "timber-erp-db-v1";

const EMPTY = () => ({
  companies: [], users: [],
  units: [], brands: [], taxes: [],
  attributes: [], attributeValues: [],
  categories: [], categoryAttributes: [],
  products: [], variants: [], variantAttributes: [],
  prices: [], stock: [], stockMovements: [],
  parties: [],
  quotations: [], quotationItems: [],
  invoices: [], invoiceItems: [],
  purchases: [], purchaseItems: [],
  payments: [],
  counters: {},
});

let db = null;

function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || EMPTY(); }
  catch { db = EMPTY(); }
  return db;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} }

export const mockStore = {
  get: () => load(),
  set(next) { db = next; save(); },
  reset() { db = EMPTY(); save(); },
  all: (col) => load()[col] || [],
  insert(col, row) { const d = load(); d[col].push(row); save(); return row; },
  update(col, id, patch) {
    const d = load();
    const i = d[col].findIndex((r) => r.id === id);
    if (i < 0) return null;
    d[col][i] = { ...d[col][i], ...patch };
    save(); return d[col][i];
  },
  remove(col, id) {
    const d = load();
    const n = d[col].length;
    d[col] = d[col].filter((r) => r.id !== id);
    save(); return n !== d[col].length;
  },
  nextNumber(prefix) {
    const d = load();
    d.counters[prefix] = (d.counters[prefix] || 0) + 1;
    save(); return d.counters[prefix];
  },
};