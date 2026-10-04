import { userRepo, companyRepo } from "@/lib/api/repos";
import { ROLE_VALUES } from "@/lib/domain/roles";
import { hashPassword } from "@/lib/utils/password";
import { newId } from "@/lib/utils/id";
import { nowIso } from "@/lib/utils/date";

/*
 * Users created before passwords existed (for example the seeded admin)
 * have no password saved. They can sign in with this default password —
 * change it from Settings → Users.
 */
export const LEGACY_DEFAULT_PASSWORD = "admin123";

export const MIN_PASSWORD_LENGTH = 6;

const norm = (value) => String(value || "").trim().toLowerCase();

const isActive = (user) => user?.isActive !== false;

/* Never let the last active admin be removed, disabled or demoted */
function wouldRemoveLastAdmin(users, target, nextRole, nextActive) {
  const isActiveAdmin = target.role === "admin" && isActive(target);
  if (!isActiveAdmin) return false;

  const staysAdmin = nextRole === "admin" && nextActive;
  if (staysAdmin) return false;

  return !users.some(
    (user) => user.id !== target.id && user.role === "admin" && isActive(user),
  );
}

function validateBasics({ name, email, role }) {
  if (!String(name || "").trim()) throw new Error("Name is required");

  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) throw new Error("Email is required");
  if (!/^\S+@\S+$/.test(cleanEmail)) throw new Error("Enter a valid email");

  if (!ROLE_VALUES.includes(role)) throw new Error("Select a valid role");
}

function validatePassword(password) {
  if (String(password || "").length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

/* ───────────────── Sign in ───────────────── */

export async function authenticate({ email, password }) {
  const users = await userRepo.list();
  const user = users.find((item) => norm(item.email) === norm(email));

  if (!user) throw new Error("Invalid email or password");
  if (!isActive(user)) throw new Error("This account is disabled. Contact an admin.");

  let passwordOk = false;

  if (user.passwordHash) {
    const hash = await hashPassword(password, user.passwordSalt);
    passwordOk = hash === user.passwordHash;
  } else {
    passwordOk = password === LEGACY_DEFAULT_PASSWORD;
  }

  if (!passwordOk) throw new Error("Invalid email or password");

  await userRepo.update(user.id, { lastLoginAt: nowIso() });

  return user;
}

/* ───────────────── Manage users ───────────────── */

export async function createUser({ name, email, role, password, isActive: active = true }) {
  validateBasics({ name, email, role });
  validatePassword(password);

  const users = await userRepo.list();

  if (users.some((user) => norm(user.email) === norm(email))) {
    throw new Error("A user with this email already exists");
  }

  const companies = await companyRepo.list();
  const passwordSalt = newId();
  const passwordHash = await hashPassword(password, passwordSalt);

  return userRepo.create({
    companyId: companies?.[0]?.id || null,
    name: String(name).trim(),
    email: String(email).trim(),
    role,
    isActive: active !== false,
    passwordSalt,
    passwordHash,
  });
}

/* patch may hold: name, email, role, isActive, password (blank = keep) */
export async function updateUser(id, patch = {}) {
  const users = await userRepo.list();
  const target = users.find((user) => user.id === id);

  if (!target) throw new Error("User not found");

  const next = {
    name: patch.name !== undefined ? patch.name : target.name,
    email: patch.email !== undefined ? patch.email : target.email,
    role: patch.role !== undefined ? patch.role : target.role,
    isActive: patch.isActive !== undefined ? patch.isActive !== false : isActive(target),
  };

  validateBasics(next);

  if (
    users.some((user) => user.id !== id && norm(user.email) === norm(next.email))
  ) {
    throw new Error("A user with this email already exists");
  }

  if (wouldRemoveLastAdmin(users, target, next.role, next.isActive)) {
    throw new Error("At least one active admin is required");
  }

  const update = {
    name: String(next.name).trim(),
    email: String(next.email).trim(),
    role: next.role,
    isActive: next.isActive,
  };

  if (patch.password) {
    validatePassword(patch.password);
    update.passwordSalt = newId();
    update.passwordHash = await hashPassword(patch.password, update.passwordSalt);
  }

  return userRepo.update(id, update);
}

export async function removeUser(id) {
  const users = await userRepo.list();
  const target = users.find((user) => user.id === id);

  if (!target) throw new Error("User not found");

  if (wouldRemoveLastAdmin(users, target, null, false)) {
    throw new Error("At least one active admin is required");
  }

  return userRepo.remove(id);
}