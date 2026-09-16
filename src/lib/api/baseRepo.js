import { mockStore } from "@/lib/store/mockStore";
import { newId } from "@/lib/utils/id";
import { nowIso } from "@/lib/utils/date";
import { simulate } from "@/lib/store/simulate";

export function createRepo(collection, { softDelete = false } = {}) {
  return {
    list(filter = {}) {
      const rows = mockStore.all(collection).filter(match(filter));
      return simulate(rows);
    },
    get(id) {
      return simulate(mockStore.all(collection).find((r) => r.id === id) || null);
    },
    create(dto) {
      const row = { id: newId(), ...dto, createdAt: nowIso(), updatedAt: nowIso() };
      mockStore.insert(collection, row);
      return simulate(row);
    },
    update(id, patch) {
      return simulate(mockStore.update(collection, id, { ...patch, updatedAt: nowIso() }));
    },
    remove(id) {
      if (softDelete) mockStore.update(collection, id, { isActive: false, updatedAt: nowIso() });
      else mockStore.remove(collection, id);
      return simulate(true);
    },
  };
}

function match(filter) {
  const entries = Object.entries(filter)
    .filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return () => true;
  return (r) => entries.every(([k, v]) => r[k] === v);
}