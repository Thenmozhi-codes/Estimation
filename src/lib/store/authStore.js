import { create } from "zustand";

const STORAGE_KEY = "timber-erp-auth-v1";

const loadInitial = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set) => ({
  user: loadInitial(),

  login: ({ name, email, role }) => {
    const user = { name, email, role, loginAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    set({ user });
    return user;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
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
  const role = user?.role;

  const PERMS = {
    canOverridePrice: ["admin", "manager"],
    canDeleteDocuments: ["admin", "manager"],
    canManageMasters: ["admin", "manager"],
    canViewReports: ["admin", "manager", "sales", "viewer"],
    canManageUsers: ["admin"],
    canEditCompany: ["admin"],
  };

  return PERMS[permission]?.includes(role) ?? false;
}