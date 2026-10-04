import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Minus, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toolbar } from "@/components/ui/Toolbar";
import { Sheet } from "@/components/ui/Sheet";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { userRepo } from "@/lib/api/repos";
import {
  createUser,
  updateUser,
  removeUser,
  MIN_PASSWORD_LENGTH,
} from "@/lib/services/userService";
import { useAuthStore } from "@/lib/store/authStore";
import { ROLES, PERMISSION_LABELS, roleCan } from "@/lib/domain/roles";
import { toast } from "@/lib/toast";
import { fmtDate, fmtDateTime } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { MODULE_TABS } from "@/app/moduleNav";

const EMPTY_FORM = {
  name: "",
  email: "",
  role: "sales",
  password: "",
  isActive: true,
};

function RoleBadge({ role }) {
  const info = ROLES.find((item) => item.value === role);

  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold capitalize",
        info?.badge || "bg-slate-500/10 text-slate-500",
      )}
    >
      {info?.label || role}
    </span>
  );
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => userRepo.list(),
  });

  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState({ open: false, user: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isEdit = Boolean(sheet.user);
  const editingSelf = isEdit && sheet.user?.id === me?.id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter(
      (user) =>
        String(user.name || "").toLowerCase().includes(q) ||
        String(user.email || "").toLowerCase().includes(q) ||
        String(user.role || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["users"] });
    /* if the signed-in user was edited, apply it right away */
    useAuthStore.getState().validateSession();
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setSheet({ open: true, user: null });
  };

  const openEdit = (user) => {
    setForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "sales",
      password: "",
      isActive: user.isActive !== false,
    });
    setSheet({ open: true, user });
  };

  const closeSheet = () => setSheet({ open: false, user: null });

  const setField = (field, value) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const handleSave = async () => {
    setSaving(true);

    try {
      if (isEdit) {
        await updateUser(sheet.user.id, form);
        toast.success("User updated");
      } else {
        await createUser(form);
        toast.success("User added");
      }

      await refresh();
      closeSheet();
    } catch (error) {
      toast.error(error?.message || "Could not save user");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await updateUser(user.id, { isActive: user.isActive === false });
      toast.success(user.isActive === false ? "User enabled" : "User disabled");
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Could not update user");
    }
  };

  const handleDelete = async () => {
    if (!confirm?.id) return;

    setDeleting(true);

    try {
      await removeUser(confirm.id);
      toast.success("User deleted");
      setConfirm(null);
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Could not delete user");
    } finally {
      setDeleting(false);
    }
  };

  const selectedRole = ROLES.find((role) => role.value === form.role);

  return (
    <>
      <PageHeader
        title="Users"
        description="Team members and their roles"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add User</span>
            <span className="sm:hidden">Add</span>
          </Button>
        }
      />
      <ModuleTabs tabs={MODULE_TABS.settings} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name, email or role…"
      />

      <div className="p-3 md:p-6 pb-24 max-w-5xl space-y-4">
        <Card>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{r.name}</span>
                    {r.id === me?.id && (
                      <span className="rounded bg-primary-500/10 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">
                        You
                      </span>
                    )}
                  </div>
                ),
              },
              { key: "email", header: "Email", hideOnMobile: true },
              {
                key: "role",
                header: "Role",
                render: (r) => <RoleBadge role={r.role} />,
              },
              {
                key: "isActive",
                header: "Status",
                align: "right",
                render: (r) => (
                  <StatusBadge status={r.isActive !== false ? "active" : "inactive"} />
                ),
              },
              {
                key: "lastLoginAt",
                header: "Last login",
                align: "right",
                hideOnMobile: true,
                render: (r) => (r.lastLoginAt ? fmtDateTime(r.lastLoginAt) : "Never"),
              },
              {
                key: "createdAt",
                header: "Added",
                align: "right",
                hideOnMobile: true,
                render: (r) => fmtDate(r.createdAt),
              },
              {
                key: "__actions",
                header: "",
                width: 210,
                align: "right",
                render: (row) => (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(row);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-bold text-primary-600 transition hover:bg-primary-500/10"
                      title="Edit user"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>

                    {row.id !== me?.id && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleActive(row);
                          }}
                          className="rounded-md px-2 py-1 text-xs font-bold text-amber-600 transition hover:bg-amber-500/10"
                        >
                          {row.isActive === false ? "Enable" : "Disable"}
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setConfirm(row);
                          }}
                          className="rounded-md px-2 py-1 text-xs font-bold text-red-500 transition hover:bg-red-500/10"
                        >
                          Del
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
            rows={filtered}
            loading={isLoading}
            onRowClick={openEdit}
            emptyTitle="No users"
            emptyDescription="Add a team member and choose their role."
            emptyAction={
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Add User
              </Button>
            }
          />
        </Card>

        {/* ROLE PERMISSIONS */}
        <Card className="overflow-hidden">
          <CardHeader title="Role permissions" />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-line text-[10px] font-bold uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 text-left">Permission</th>
                    {ROLES.map((role) => (
                      <th key={role.value} className="px-2 py-2 text-center">
                        {role.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {PERMISSION_LABELS.map((permission) => (
                    <tr key={permission.key}>
                      <td className="py-2 pr-3 text-ink">{permission.label}</td>
                      {ROLES.map((role) => (
                        <td key={role.value} className="px-2 py-2 text-center">
                          {roleCan(role.value, permission.key) ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-500" />
                          ) : (
                            <Minus className="mx-auto h-4 w-4 text-muted/50" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ADD / EDIT */}
      <Sheet
        open={sheet.open}
        onClose={closeSheet}
        title={isEdit ? "Edit User" : "Add User"}
        subtitle={
          isEdit
            ? "Change name, role, status or set a new password."
            : "Create a team member and choose their role."
        }
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={closeSheet} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add User"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <Input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="e.g. Ravi Kumar"
              autoFocus
            />
          </Field>

          <Field label="Email" required hint="Used to sign in">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="name@company.com"
            />
          </Field>

          <Field
            label="Role"
            required
            hint={
              editingSelf
                ? "You cannot change your own role"
                : selectedRole?.description
            }
          >
            <Select
              value={form.role}
              onChange={(event) => setField("role", event.target.value)}
              disabled={editingSelf}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={isEdit ? "New password" : "Password"}
            required={!isEdit}
            hint={
              isEdit
                ? "Leave blank to keep the current password"
                : `At least ${MIN_PASSWORD_LENGTH} characters`
            }
          >
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              autoComplete="new-password"
            />
          </Field>

          <Field
            label="Status"
            hint={
              editingSelf
                ? "You cannot disable your own account"
                : "Disabled users cannot sign in"
            }
          >
            <Select
              value={form.isActive ? "active" : "inactive"}
              onChange={(event) =>
                setField("isActive", event.target.value === "active")
              }
              disabled={editingSelf}
            >
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </Select>
          </Field>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Delete user?"
        description={`"${confirm?.name}" will no longer be able to sign in.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </>
  );
}

export default UsersPage;