import { roleRepo, userRepo } from "@/lib/api/repos";
import {
  getAllRoles,
  NEEDS_SETTINGS,
  PERMISSION_LABELS,
} from "@/lib/domain/roles";
import { useRolesStore } from "@/lib/store/rolesStore";

/*
 * Custom roles ("Store keeper", "Accountant" …) with their own list of
 * responsibilities (permissions). Built-in roles can be copied but not edited.
 */

const VALID_KEYS = PERMISSION_LABELS.map((item) => item.key);
const norm = (value) => String(value || "").trim().toLowerCase();

/* keeps only known permissions, in a fixed order, and adds what they need */
export function normalizePermissions(list = []) {
  const set = new Set((list || []).filter((key) => VALID_KEYS.includes(key)));

  if (NEEDS_SETTINGS.some((key) => set.has(key))) set.add("canViewSettings");

  return VALID_KEYS.filter((key) => set.has(key));
}

function slug(label) {
  return (
    norm(label)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "role"
  );
}

function uniqueValue(label, takenValues) {
  const base = slug(label);
  let value = base;
  let n = 2;

  while (takenValues.includes(value)) {
    value = `${base}-${n}`;
    n += 1;
  }

  return value;
}

function validate({ label, permissions }, existingRoles, selfId = null) {
  const cleanLabel = String(label || "").trim();

  if (!cleanLabel) throw new Error("Role name is required");
  if (cleanLabel.length > 40) throw new Error("Role name is too long (max 40 characters)");

  if (
    existingRoles.some(
      (role) => role.id !== selfId && norm(role.label) === norm(cleanLabel),
    )
  ) {
    throw new Error("A role with this name already exists");
  }

  if (!normalizePermissions(permissions).length) {
    throw new Error("Select at least one responsibility for this role");
  }

  return cleanLabel;
}

const refresh = () => useRolesStore.getState().bump();

export async function createRole({ label, description = "", permissions = [] }) {
  const roles = getAllRoles();
  const cleanLabel = validate({ label, permissions }, roles);

  const created = await roleRepo.create({
    value: uniqueValue(
      cleanLabel,
      roles.map((role) => role.value),
    ),
    label: cleanLabel,
    description: String(description || "").trim(),
    permissions: normalizePermissions(permissions),
    isSystem: false,
  });

  refresh();
  return created;
}

export async function updateRole(id, { label, description, permissions }) {
  const roles = getAllRoles();
  const target = roles.find((role) => role.id === id);

  if (!target) throw new Error("Role not found");
  if (target.isSystem) throw new Error("Built-in roles cannot be edited. Copy it to make your own.");

  const cleanLabel = validate(
    {
      label: label ?? target.label,
      permissions: permissions ?? target.permissions,
    },
    roles,
    id,
  );

  /* the role's value never changes, so users keep their role */
  const updated = await roleRepo.update(id, {
    label: cleanLabel,
    description: String(description ?? target.description ?? "").trim(),
    permissions: normalizePermissions(permissions ?? target.permissions),
  });

  refresh();
  return updated;
}

export async function deleteRole(id) {
  const target = getAllRoles().find((role) => role.id === id);

  if (!target) throw new Error("Role not found");
  if (target.isSystem) throw new Error("Built-in roles cannot be deleted");

  const users = await userRepo.list();
  const inUse = users.filter((user) => user.role === target.value).length;

  if (inUse > 0) {
    throw new Error(
      `${inUse} user${inUse === 1 ? " is" : "s are"} still using “${target.label}”. Change their role first.`,
    );
  }

  await roleRepo.remove(id);
  refresh();
  return true;
}
