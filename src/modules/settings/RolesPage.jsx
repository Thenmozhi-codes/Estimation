import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, Eye, Pencil, Plus, Trash2, Users } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PermissionSummary, RoleBadge } from "@/components/settings/RoleBadge";
import { RoleSheet } from "./RoleSheet";

import { toast } from "@/lib/toast";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/lib/domain/roles";
import { useDeleteRole, useRoles, useUsers } from "@/hooks/useUsers";
import { MODULE_TABS } from "@/app/moduleNav";

export function RolesPage() {
  const navigate = useNavigate();

  const roles = useRoles();
  const { data: users = [] } = useUsers();
  const deleteMut = useDeleteRole();

  const [sheet, setSheet] = useState({ open: false, role: null, copyFrom: null });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const userCount = useMemo(() => {
    const counts = {};
    users.forEach((user) => {
      counts[user.role] = (counts[user.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const openNew = () => setSheet({ open: true, role: null, copyFrom: null });
  const openRole = (role) => setSheet({ open: true, role, copyFrom: null });
  const openCopy = (role) => setSheet({ open: true, role: null, copyFrom: role });
  const closeSheet = () => setSheet((prev) => ({ ...prev, open: false }));

  const onDelete = async () => {
    if (!confirmDelete) return;

    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success("Role deleted");
    } catch (error) {
      toast.error(error?.message || "Could not delete the role");
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Roles & Responsibilities"
        description="Decide what each role is allowed to do, then assign roles to users"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate("/settings/users")}>
              <Users className="h-4 w-4" />
              Users
            </Button>

            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              New Role
            </Button>
          </>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.settings} />

      <div className="w-full space-y-6 p-3 md:p-6">
        {/* ROLE CARDS */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((role) => {
            const count = userCount[role.value] || 0;

            return (
              <Card key={role.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={role} className="text-xs" />
                      <span className="text-2xs font-semibold uppercase tracking-wide text-muted">
                        {role.isSystem ? "Built-in" : "Custom"}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 min-h-[2rem] text-xs text-muted">
                      {role.description || "No description"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-2xs font-semibold text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {count} user{count === 1 ? "" : "s"}
                  </span>
                  <span>
                    {role.permissions.length} / {PERMISSION_LABELS.length} responsibilities
                  </span>
                </div>

                <div className="mt-3 flex-1">
                  <PermissionSummary permissions={role.permissions.slice(0, 6)} compact />
                  {role.permissions.length > 6 && (
                    <button
                      type="button"
                      onClick={() => openRole(role)}
                      className="mt-1.5 text-2xs font-bold text-primary-600 hover:underline"
                    >
                      +{role.permissions.length - 6} more
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-end gap-1 border-t border-line pt-3">
                  <Button size="xs" variant="ghost" onClick={() => openCopy(role)}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>

                  {role.isSystem ? (
                    <Button size="xs" variant="ghost" onClick={() => openRole(role)}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  ) : (
                    <>
                      <Button size="xs" variant="ghost" onClick={() => openRole(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => setConfirmDelete(role)}
                        className="text-danger hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}

          {/* add card */}
          <button
            type="button"
            onClick={openNew}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-primary-500/50 hover:text-primary-600"
          >
            <Plus className="h-5 w-5" />
            Create a new role
          </button>
        </div>

        {/* COMPARISON TABLE */}
        <Card>
          <div className="border-b border-line px-4 py-3">
            <div className="text-sm font-bold text-ink">Who can do what</div>
            <div className="text-2xs text-muted">All roles side by side</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/60">
                  <th className="sticky left-0 bg-bg/90 px-4 py-2.5 text-left text-2xs font-bold uppercase tracking-wide text-muted">
                    Responsibility
                  </th>
                  {roles.map((role) => (
                    <th key={role.id} className="px-3 py-2.5 text-center">
                      <RoleBadge role={role} />
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <GroupRows key={group} group={group} roles={roles} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <RoleSheet
        open={sheet.open}
        onClose={closeSheet}
        role={sheet.role}
        copyFrom={sheet.copyFrom}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={onDelete}
        title="Delete role?"
        description={`“${confirmDelete?.label}” will be removed. A role that still has users cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}

function GroupRows({ group, roles }) {
  return (
    <>
      <tr className="bg-bg/30">
        <td
          colSpan={roles.length + 1}
          className="px-4 py-1.5 text-2xs font-bold uppercase tracking-wide text-muted"
        >
          {group}
        </td>
      </tr>

      {PERMISSION_LABELS.filter((item) => item.group === group).map((item) => (
        <tr key={item.key} className="border-b border-line last:border-0">
          <td className="sticky left-0 bg-surface px-4 py-2 text-xs font-medium text-ink">
            {item.label}
          </td>

          {roles.map((role) => (
            <td key={role.id} className="px-3 py-2 text-center">
              {role.permissions.includes(item.key) ? (
                <Check className="mx-auto h-4 w-4 text-emerald-600" strokeWidth={3} />
              ) : (
                <span className="text-muted/40">—</span>
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default RolesPage;
