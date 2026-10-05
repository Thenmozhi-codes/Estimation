import { create } from "zustand";

/*
 * Bumped whenever a role is created / changed / deleted, so menus and
 * permission checks on screen refresh straight away.
 */
export const useRolesStore = create((set) => ({
  version: 0,
  bump: () => set((state) => ({ version: state.version + 1 })),
}));

export const useRolesVersion = () => useRolesStore((state) => state.version);
