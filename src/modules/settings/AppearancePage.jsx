import { Moon, Sun } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Card, CardBody } from "@/components/ui/Card";
import { useThemeStore } from "@/lib/store/themeStore";
import { cn } from "@/lib/utils/cn";
import { MODULE_TABS } from "@/app/moduleNav";

export function AppearancePage() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const options = [
    { value: "light", label: "Light", icon: Sun, desc: "Clean, bright workspace" },
    { value: "dark",  label: "Dark",  icon: Moon, desc: "Dim, easy on the eyes" },
  ];

  const swatches = [
    { name: "Primary 500", hex: "#6366f1" },
    { name: "Primary 700", hex: "#4338ca" },
    { name: "Accent 500",  hex: "#8b5cf6" },
    { name: "Wood 500",    hex: "#f97d0a" },
    { name: "Success",     hex: "#10b981" },
    { name: "Warning",     hex: "#f59e0b" },
    { name: "Danger",      hex: "#ef4444" },
    { name: "Info",        hex: "#3b82f6" },
  ];

  return (
    <>
      <PageHeader title="Appearance" description="Theme and visual preferences" />
      <ModuleTabs tabs={MODULE_TABS.settings} />

      <div className="p-4 md:p-6 max-w-3xl space-y-4">
        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-ink mb-3">Theme</div>
            <div className="grid grid-cols-2 gap-3">
              {options.map((o) => {
                const Icon = o.icon;
                const active = mode === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setMode(o.value)}
                    className={cn(
                      "text-left p-4 rounded-xl border-2 transition-all duration-150",
                      active
                        ? "border-primary-500 bg-primary-50/40 dark:bg-primary-950/20"
                        : "border-line hover:border-primary-300 bg-bg",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 mb-2",
                        active ? "text-primary-500" : "text-muted",
                      )}
                    />
                    <div className="text-sm font-semibold text-ink">{o.label}</div>
                    <div className="text-2xs text-muted mt-0.5">{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="text-sm font-semibold text-ink mb-3">Color system</div>
            <div className="grid grid-cols-4 gap-2">
              {swatches.map((s) => (
                <div key={s.name} className="text-center">
                  <div
                    className="h-16 rounded-lg border border-line shadow-xs"
                    style={{ background: s.hex }}
                  />
                  <div className="text-2xs text-muted mt-1.5 font-medium">
                    {s.name}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}