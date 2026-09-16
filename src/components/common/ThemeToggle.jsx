import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/lib/store/themeStore";

export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggleMode);

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title={mode === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {mode === "dark" ? (
        <Sun className="h-4.5 w-4.5 text-ink" strokeWidth={1.75} />
      ) : (
        <Moon className="h-4.5 w-4.5 text-ink" strokeWidth={1.75} />
      )}
    </button>
  );
}