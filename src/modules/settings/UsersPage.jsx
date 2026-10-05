import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";

import { PageHeader } from "@/components/common/PageHeader";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toolbar } from "@/components/ui/Toolbar";
import { RoleBadge } from "@/components/settings/RoleBadge";
import { UserFormSheet } from "./UserFormSheet";

import { toast } from "@/lib/toast";
import { fmtDate } from "@/lib/utils/date";
import { useAuthStore } from "@/lib/store/authStore";
import { useDeleteUser, useRoles, useSaveUser, useUsers } from "@/hooks/useUsers";
import { MODULE_TABS } from "@/app/moduleNav";

export function UsersPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const { data: users = [], isLoading } = useUsers();
  const roles = useRoles();

  const saveMut = useSaveUser();
  const deleteMut = useDeleteUser();

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((user) => {
      const roleName = roles.find((role) => role.value === user.role)?.label || user.role;
      return [user.name, user.email, roleName].some((value) =>
        String(value || "").toLowerCase().includes(q),
      );
    });
  }, [users, roles, search]);

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setSheetOpen(true);
  };

  const toggleActive = async (user) => {
    const next = user.isActive === false;

    try {
      await saveMut.mutateAsync({ id: user.id, values: { isActive: next } });
      toast.success(next ? `${user.name} enabled` : `${user.name} disabled`);
    } catch (error) {
      toast.error(error?.message || "Could not update the user");
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;

    try {
      await deleteMut.mutateAsync(confirmDelete.id);
      toast.success("User deleted");
      setConfirmDelete(null);
    } catch (error) {
      toast.error(error?.message || "Could not delete the user");
      setConfirmDelete(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Add team members and give each one a role"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate("/settings/roles")}>
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Manage Roles</span>
              <span className="sm:hidden">Roles</span>
            </Button>

            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </>
        }
      />

      <ModuleTabs tabs={MODULE_TABS.settings} />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search by name, email or role…"
      />

      <div className="p-3 md:p-6 w-full">
        <Card>
          <DataTable
            columns={[
              {
                key: "name",
                header: "Name",
                sortable: true,
                render: (row) => (
                  <div className="min-w-0">
                    <div className="font-semibold text-ink truncate">
                      {row.name}
                      {row.id === currentUserId && (
                        <span className="ml-1.5 text-2xs font-medium text-muted">(you)</span>
                      )}
                    </div>
                    <div className="text-2xs text-muted truncate md:hidden">{row.email}</div>
                  </div>
                ),
              },
              { key: "email", header: "Email", hideOnMobile: true },
              {
                key: "role",
                header: "Role",
                render: (row) => <RoleBadge role={row.role} />,
              },
              {
                key: "isActive",
                header: "Status",
                render: (row) => (
                  <StatusBadge status={row.isActive === false ? "inactive" : "active"} />
                ),
              },
              {
                key: "lastLoginAt",
                header: "Last login",
                hideOnMobile: true,
                render: (row) => (row.lastLoginAt ? fmtDate(row.lastLoginAt) : "Never"),
              },
              {
                key: "createdAt",
                header: "Added",
                hideOnMobile: true,
                render: (row) => fmtDate(row.createdAt),
              },
              {
                key: "__actions",
                header: "",
                align: "right",
                width: 150,
                render: (row) => {
                  const isSelf = row.id === currentUserId;
                  const inactive = row.isActive === false;

                  return (
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        title="Edit user"
                        aria-label="Edit user"
                        className="rounded-md p-1.5 text-muted transition hover:bg-primary-500/10 hover:text-primary-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(row)}
                        disabled={isSelf}
                        title={isSelf ? "You cannot disable yourself" : inactive ? "Enable user" : "Disable user"}
                        aria-label={inactive ? "Enable user" : "Disable user"}
                        className="rounded-md p-1.5 text-muted transition hover:bg-amber-500/10 hover:text-amber-600 disabled:pointer-events-none disabled:opacity-30"
                      >
                        {inactive ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDelete(row)}
                        disabled={isSelf}
                        title={isSelf ? "You cannot delete yourself" : "Delete user"}
                        aria-label="Delete user"
                        className="rounded-md p-1.5 text-muted transition hover:bg-red-500/10 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                },
              },
            ]}
            rows={rows}
            loading={isLoading}
            emptyTitle={search ? "No users match your search" : "No users yet"}
            emptyDescription="Add your first team member and choose their role."
            emptyAction={
              !search && (
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4" /> Add User
                </Button>
              )
            }
          />
        </Card>
      </div>

      <UserFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        user={editing}
        isSelf={Boolean(editing) && editing.id === currentUserId}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={onDelete}
        title="Delete user?"
        description={`“${confirmDelete?.name}” will be removed and can no longer sign in.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
      />
    </>
  );
}

export default UsersPage;
