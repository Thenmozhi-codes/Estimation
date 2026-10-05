import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Field } from "@/components/ui/Field";
import { FormGrid } from "@/components/ui/FormGrid";
import { Sheet } from "@/components/ui/Sheet";
import { PermissionSummary } from "@/components/settings/RoleBadge";

import { toast } from "@/lib/toast";
import { MIN_PASSWORD_LENGTH } from "@/lib/services/userService";
import { useRoles, useSaveUser } from "@/hooks/useUsers";

const emptyForm = (role = "sales") => ({
  name: "",
  email: "",
  role,
  password: "",
  isActive: true,
});

/*
 * Add / edit a user. The role picker shows what that role is responsible
 * for, so the admin sees the effect of the choice before saving.
 */
export function UserFormSheet({ open, onClose, user = null, isSelf = false }) {
  const isEdit = Boolean(user);

  const roles = useRoles();
  const saveMut = useSaveUser();

  const [form, setForm] = useState(emptyForm());
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  /* fresh form every time the sheet opens */
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setShowPassword(false);

    setForm(
      user
        ? {
            name: user.name || "",
            email: user.email || "",
            role: user.role || "sales",
            password: "",
            isActive: user.isActive !== false,
          }
        : emptyForm(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.id]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const selectedRole = useMemo(
    () => roles.find((role) => role.value === form.role) || null,
    [roles, form.role],
  );

  const validate = () => {
    const next = {};

    if (!form.name.trim()) next.name = "Name is required";

    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^\S+@\S+$/.test(form.email.trim())) next.email = "Enter a valid email";

    if (!form.role) next.role = "Select a role";

    if (!isEdit && form.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `At least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (isEdit && form.password && form.password.length < MIN_PASSWORD_LENGTH) {
      next.password = `At least ${MIN_PASSWORD_LENGTH} characters`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    try {
      await saveMut.mutateAsync({
        id: user?.id || null,
        values: {
          name: form.name,
          email: form.email,
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        },
      });

      toast.success(isEdit ? "User updated" : "User added");
      onClose?.();
    } catch (error) {
      toast.error(error?.message || "Could not save the user");
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add User"}
      subtitle={isEdit ? user?.email : "Give a team member access based on their role"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saveMut.isPending}>
            {isEdit ? "Save Changes" : "Add User"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="space-y-5"
      >
        <FormGrid cols={2}>
          <Field label="Full name" required error={errors.name} className="sm:col-span-2">
            <Input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="e.g. Ravi Kumar"
              error={Boolean(errors.name)}
              autoFocus
            />
          </Field>

          <Field label="Email (used to sign in)" required error={errors.email} className="sm:col-span-2">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              placeholder="name@company.com"
              error={Boolean(errors.email)}
              autoComplete="off"
            />
          </Field>

          <Field
            label={isEdit ? "New password" : "Password"}
            required={!isEdit}
            error={errors.password}
            hint={isEdit ? "Leave blank to keep the current password" : `Minimum ${MIN_PASSWORD_LENGTH} characters`}
            className="sm:col-span-2"
          >
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => set("password", event.target.value)}
                placeholder={isEdit ? "••••••" : "Set a password"}
                error={Boolean(errors.password)}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </FormGrid>

        {/* ROLE + what it allows */}
        <div className="space-y-3 rounded-xl border border-line bg-bg/40 p-4">
          <Field label="Role" required error={errors.role}>
            <Select
              value={form.role}
              onChange={(event) => set("role", event.target.value)}
              error={Boolean(errors.role)}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                  {role.isSystem ? "" : " (custom)"}
                </option>
              ))}
            </Select>
          </Field>

          {selectedRole && (
            <div className="space-y-2">
              {selectedRole.description && (
                <p className="text-xs text-muted">{selectedRole.description}</p>
              )}

              <div className="text-2xs font-bold uppercase tracking-wide text-muted">
                This user will be able to
              </div>

              <PermissionSummary permissions={selectedRole.permissions} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line p-4">
          <div>
            <div className="text-sm font-semibold text-ink">Active</div>
            <div className="text-xs text-muted">
              {isSelf
                ? "You cannot disable your own account"
                : "Disabled users cannot sign in"}
            </div>
          </div>

          <Switch
            checked={form.isActive}
            onChange={(value) => set("isActive", value)}
            disabled={isSelf}
          />
        </div>
      </form>
    </Sheet>
  );
}

export default UserFormSheet;
