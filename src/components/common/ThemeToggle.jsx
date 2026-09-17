import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/lib/store/themeStore";

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggleMode);

  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="
        h-9
        w-9
        rounded-lg
        flex
        items-center
        justify-center
        text-muted
        hover:text-ink
        hover:bg-bg
        transition-colors
      "
    >
      {isDark ? (
        <Sun className="h-[17px] w-[17px]" />
      ) : (
        <Moon className="h-[17px] w-[17px]" />
      )}
    </button>
  );
}