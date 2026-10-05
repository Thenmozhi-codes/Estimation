import { PERMISSION_GROUPS, PERMISSION_LABELS, findRole } from "@/lib/domain/roles";
import { cn } from "@/lib/utils/cn";

/* Coloured pill with the role name */
export function RoleBadge({ role, className }) {
  const value = typeof role === "string" ? role : role?.value;
  const found = typeof role === "object" && role?.label ? role : findRole(value);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap",
        found?.badge || "bg-slate-500/10 text-slate-500",
        className,
      )}
    >
      {found?.label || value || "—"}
    </span>
  );
}

/* The responsibilities of a role, grouped (Documents, Reports …) */
export function PermissionSummary({ permissions = [], compact = false }) {
  const granted = new Set(permissions);

  if (!granted.size) {
    return <div className="text-xs text-muted">No responsibilities selected</div>;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {PERMISSION_LABELS.filter((item) => granted.has(item.key)).map((item) => (
          <span
            key={item.key}
            className="rounded-md border border-line bg-bg/60 px-1.5 py-0.5 text-2xs font-medium text-ink"
          >
            {item.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {PERMISSION_GROUPS.map((group) => {
        const rows = PERMISSION_LABELS.filter(
          (item) => item.group === group && granted.has(item.key),
        );
        if (!rows.length) return null;

        return (
          <div key={group}>
            <div className="mb-1 text-2xs font-bold uppercase tracking-wide text-muted">
              {group}
            </div>
            <div className="flex flex-wrap gap-1">
              {rows.map((item) => (
                <span
                  key={item.key}
                  className="rounded-md border border-line bg-bg/60 px-1.5 py-0.5 text-2xs font-medium text-ink"
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
