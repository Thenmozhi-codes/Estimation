import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Sheet } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";

import { toast } from "@/lib/toast";
import {
  NEEDS_SETTINGS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
} from "@/lib/domain/roles";
import { useRoles, useSaveRole } from "@/hooks/useUsers";

/*
 * Create / edit / view a role and choose its responsibilities.
 *
 *  role = null           -> new role (optionally pre-filled from `copyFrom`)
 *  role.isSystem === true -> built-in role, shown read-only
 */
export function RoleSheet({ open, onClose, role = null, copyFrom = null }) {
  const roles = useRoles();
  const saveMut = useSaveRole();

  const isEdit = Boolean(role);
  const readOnly = Boolean(role?.isSystem);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");

    if (role) {
      setLabel(role.label);
      setDescription(role.description || "");
      setPermissions(role.permissions || []);
    } else if (copyFrom) {
      setLabel(`${copyFrom.label} copy`);
      setDescription(copyFrom.description || "");
      setPermissions(copyFrom.permissions || []);
    } else {
      setLabel("");
      setDescription("");
      setPermissions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role?.id, copyFrom?.value]);

  const granted = useMemo(() => new Set(permissions), [permissions]);

  const toggle = (key) => {
    if (readOnly) return;

    setPermissions((prev) => {
      const set = new Set(prev);

      if (set.has(key)) {
        set.delete(key);
        /* no settings access -> nothing inside settings either */
        if (key === "canViewSettings") NEEDS_SETTINGS.forEach((k) => set.delete(k));
      } else {
        set.add(key);
        if (NEEDS_SETTINGS.includes(key)) set.add("canViewSettings");
      }

      return [...set];
    });

    setError("");
  };

  const setGroup = (group, on) => {
    if (readOnly) return;

    const keys = PERMISSION_LABELS.filter((item) => item.group === group).map((item) => item.key);

    setPermissions((prev) => {
      const set = new Set(prev);

      keys.forEach((key) => (on ? set.add(key) : set.delete(key)));

      if (on && keys.some((key) => NEEDS_SETTINGS.includes(key))) set.add("canViewSettings");
      if (!on && keys.includes("canViewSettings")) NEEDS_SETTINGS.forEach((k) => set.delete(k));

      return [...set];
    });
  };

  /* "Start from" — copy the responsibilities of an existing role */
  const startFrom = (value) => {
    const source = roles.find((item) => item.value === value);
    if (source) setPermissions(source.permissions || []);
  };

  const submit = async () => {
    setError("");

    try {
      await saveMut.mutateAsync({
        id: role?.id || null,
        values: { label, description, permissions },
      });

      toast.success(isEdit ? "Role updated" : "Role created");
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not save the role");
    }
  };

  const title = readOnly ? role.label : isEdit ? "Edit Role" : "New Role";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      width="lg"
      title={title}
      subtitle={
        readOnly
          ? "Built-in role — copy it to make your own version"
          : "Choose what people with this role are responsible for"
      }
      footer={
        readOnly ? (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={saveMut.isPending}>
              {isEdit ? "Save Changes" : "Create Role"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {!readOnly && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Role name" required className="sm:col-span-2">
              <Input
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Store keeper, Accountant"
                maxLength={40}
                autoFocus
              />
            </Field>

            <Field label="Description" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this role responsible for? (optional)"
              />
            </Field>

            {!isEdit && (
              <Field
                label="Start from an existing role"
                hint="Copies its responsibilities, then you can add or remove"
                className="sm:col-span-2"
              >
                <Select defaultValue="" onChange={(event) => startFrom(event.target.value)}>
                  <option value="">Blank — choose everything myself</option>
                  {roles.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {readOnly && role.description && (
          <p className="text-sm text-muted">{role.description}</p>
        )}

        {/* RESPONSIBILITIES */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-ink">Responsibilities</div>
            <div className="text-xs text-muted">
              {granted.size} of {PERMISSION_LABELS.length} selected
            </div>
          </div>

          {PERMISSION_GROUPS.map((group) => {
            const items = PERMISSION_LABELS.filter((item) => item.group === group);
            const allOn = items.every((item) => granted.has(item.key));

            return (
              <div key={group} className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-bg/60 px-3 py-2">
                  <div className="text-2xs font-bold uppercase tracking-wide text-muted">
                    {group}
                  </div>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setGroup(group, !allOn)}
                      className="text-2xs font-bold text-primary-600 hover:underline"
                    >
                      {allOn ? "Clear" : "Select all"}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-line">
                  {items.map((item) => {
                    const on = granted.has(item.key);

                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggle(item.key)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-bg/40 disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="mt-0.5 pointer-events-none">
                          <Checkbox checked={on} />
                        </span>

                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink">
                            {item.label}
                            {item.sensitive && (
                              <span className="ml-2 rounded bg-amber-500/10 px-1.5 py-0.5 text-2xs font-bold text-amber-600">
                                Sensitive
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted">{item.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-xs font-semibold text-danger dark:bg-red-950/30">
            {error}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export default RoleSheet;
