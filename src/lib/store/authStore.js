import { create } from "zustand";
import { mockStore } from "@/lib/store/mockStore";
import { roleCan } from "@/lib/domain/roles";
import { useRolesStore } from "@/lib/store/rolesStore";

const STORAGE_KEY = "timber-erp-auth-v1";

const loadInitial = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persist = (user) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
};

export const useAuthStore = create((set, get) => ({
  user: loadInitial(),

  login: ({ id, name, email, role }) => {
    const user = { id, name, email, role, loginAt: new Date().toISOString() };
    persist(user);
    set({ user });
    return user;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },

  /*
   * Keeps the saved session in step with the Users list:
   *  - user deleted or disabled  -> signed out
   *  - role / name / email changed -> session updated straight away
   *  - old demo session (no user id) -> signed out, must sign in again
   * Returns false when the session was ended.
   */
  validateSession: () => {
    const { user } = get();
    if (!user) return true;

    const record = user.id
      ? mockStore.all("users").find((item) => item.id === user.id)
      : null;

    if (!record || record.isActive === false) {
      get().logout();
      return false;
    }

    if (
      record.role !== user.role ||
      record.name !== user.name ||
      record.email !== user.email
    ) {
      const next = {
        ...user,
        name: record.name,
        email: record.email,
        role: record.role,
      };
      persist(next);
      set({ user: next });
    }

    return true;
  },

  hasRole: (roles) => {
    const state = useAuthStore.getState();
    if (!state.user) return false;
    if (!roles || roles.length === 0) return true;
    return roles.includes(state.user.role);
  },
}));

/** Convenience hook */
export function usePermission(permission) {
  const user = useAuthStore((s) => s.user);

  /* re-check when an admin edits a role */
  useRolesStore((s) => s.version);

  return roleCan(user?.role, permission);
}

/** Same check for event handlers / non-React code */
export function can(permission) {
  return roleCan(useAuthStore.getState().user?.role, permission);
}