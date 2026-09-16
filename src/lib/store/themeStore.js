import { create } from "zustand";

const KEY = "timber-erp-theme-v1";

const load = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    mode: window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    accent: "amber",
  };
};

function applyTheme({ mode }) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  setTimeout(() => root.classList.remove("theme-transition"), 250);
}

export const useThemeStore = create((set, get) => {
  const initial = load();
  if (typeof document !== "undefined") applyTheme(initial);

  return {
    mode: initial.mode,
    accent: initial.accent,

    setMode: (mode) => {
      const next = { ...get(), mode };
      localStorage.setItem(KEY, JSON.stringify(next));
      applyTheme(next);
      set({ mode });
    },

    toggleMode: () => {
      const nextMode = get().mode === "dark" ? "light" : "dark";
      get().setMode(nextMode);
    },

    setAccent: (accent) => {
      const next = { ...get(), accent };
      localStorage.setItem(KEY, JSON.stringify(next));
      set({ accent });
    },
  };
});