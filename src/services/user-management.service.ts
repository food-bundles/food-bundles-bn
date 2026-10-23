import prisma from "../prisma";
import { hashPassword } from "../utils/password";
import { LocationValidationService } from "./location.service";

/**
 * Editing, trashing and restoring user accounts from the dashboard
 * (farmers, restaurants and admin-table users).
 *
 * Delete is a soft delete: the account moves to the trash (deletedAt set),
 * can't sign in, disappears from the lists, and a super admin can restore it.
 * Passwords are stored hashed and can never be read back; a super admin can
 * set a new one.
 */

export type ManagedUserType = "farmer" | "restaurant" | "admin";

export const MANAGED_USER_TYPES: ManagedUserType[] = ["farmer", "restaurant", "admin"];

export class UserManagementError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// Fields a dashboard edit may change, per account type. Anything else in the
// request (role, verified flags, secrets…) is ignored.
const EDITABLE_FIELDS: Record<ManagedUserType, string[]> = {
  farmer: [
    "name",
    "email",
    "phone",
    "location",
    "province",
    "district",
    "sector",
    "cell",
    "village",
    "preferredLanguage",
    "smsNotifications",
    "notificationFrequency",
  ],
  restaurant: [
    "name",
    "email",
    "phone",
    "tin",
    "location",
    "province",
    "district",
    "sector",
    "cell",
    "village",
    "preferredLanguage",
  ],
  admin: ["username", "email", "phone", "location", "province", "district", "sector", "cell", "village"],
};

// Fields that must keep a value (the column is required)
const REQUIRED_FIELDS: Record<ManagedUserType, string[]> = {
  farmer: [],
  restaurant: ["name", "tin"],
  admin: ["username", "email"],
};

const LOCATION_FIELDS = ["province", "district", "sector", "cell", "village"] as const;

const SAFE_SELECT_OMIT = ["password", "twoFactorSecret", "twoFactorBackupCodes", "ussdPin"];

const delegateFor = (type: ManagedUserType): any => {
  if (type === "farmer") return prisma.farmer;
  if (type === "restaurant") return prisma.restaurant;
  return prisma.admin;
};

export const isManagedUserType = (value: unknown): value is ManagedUserType =>
  typeof value === "string" && (MANAGED_USER_TYPES as string[]).includes(value);

const stripSecrets = (user: Record<string, any>) => {
  const copy = { ...user };
  SAFE_SELECT_OMIT.forEach((key) => delete copy[key]);
  return copy;
};

/** Clean one submitted value: trim text, lowercase email, "" → null. */
const cleanValue = (field: string, value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return field === "email" ? trimmed.toLowerCase() : trimmed;
};

/**
 * Email and phone must be unique across every account table (people sign in
 * with them). Checks each value separately, ignoring the account itself.
 */
export const assertContactAvailable = async (
  currentId: string,
  contact: { email?: string | null; phone?: string | null },
) => {
  const checks: Array<[string, string]> = [];
  if (contact.email) checks.push(["email", contact.email]);
  if (contact.phone) checks.push(["phone", contact.phone]);

  for (const [field, value] of checks) {
    const where = { [field]: field === "email" ? { equals: value, mode: "insensitive" } : value, NOT: { id: currentId } };
    const [farmer, restaurant, admin, affiliator] = await Promise.all([
      prisma.farmer.findFirst({ where: where as any, select: { id: true } }),
      prisma.restaurant.findFirst({ where: where as any, select: { id: true } }),
      prisma.admin.findFirst({ where: where as any, select: { id: true } }),
      prisma.affiliator.findFirst({ where: where as any, select: { id: true } }),
    ]);
    if (farmer || restaurant || admin || affiliator) {
      throw new UserManagementError(`Another account already uses this ${field}: ${value}`, 409);
    }
  }
};

/**
 * Update an account's details. Only the editable fields are saved; email and
 * phone are checked for duplicates; a new password is only applied when the
 * caller allows it (super admin, or the user changing their own).
 */
export const updateManagedUser = async (
  type: ManagedUserType,
  id: string,
  input: Record<string, any>,
  options: { allowPassword?: boolean } = {},
) => {
  const delegate = delegateFor(type);
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new UserManagementError("User not found", 404);
  }

  const data: Record<string, any> = {};
  for (const field of EDITABLE_FIELDS[type]) {
    if (input[field] === undefined) continue;
    const value = cleanValue(field, input[field]);
    if (value === null && REQUIRED_FIELDS[type].includes(field)) {
      throw new UserManagementError(`${field} cannot be empty`);
    }
    data[field] = value;
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    throw new UserManagementError("Enter a valid email address");
  }

  // Location: validate the full hierarchy when any part changes
  if (LOCATION_FIELDS.some((f) => data[f])) {
    const merged = Object.fromEntries(
      LOCATION_FIELDS.map((f) => [f, (data[f] ?? existing[f] ?? "") as string]),
    );
    const result = LocationValidationService.validateLocationHierarchy(merged as any);
    if (!result.isValid) {
      throw new UserManagementError(`Location validation failed: ${result.errors.join(", ")}`);
    }
  }

  const contactChanges = {
    email: data.email && data.email !== existing.email ? data.email : null,
    phone: data.phone && data.phone !== existing.phone ? data.phone : null,
  };
  await assertContactAvailable(id, contactChanges);

  if (input.password !== undefined && input.password !== "") {
    if (!options.allowPassword) {
      throw new UserManagementError("Only a super admin can set another user's password", 403);
    }
    if (String(input.password).length < 4) {
      throw new UserManagementError("Password must be at least 4 characters");
    }
    data.password = await hashPassword(String(input.password));
  }

  if (Object.keys(data).length === 0) return stripSecrets(existing);

  const updated = await delegate.update({ where: { id }, data });
  return stripSecrets(updated);
};

/** Super admin: set a new password (the old one can't be read). */
export const setManagedUserPassword = async (type: ManagedUserType, id: string, password: string) => {
  if (!password || String(password).length < 4) {
    throw new UserManagementError("Password must be at least 4 characters");
  }
  const delegate = delegateFor(type);
  const existing = await delegate.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!existing || existing.deletedAt) throw new UserManagementError("User not found", 404);
  await delegate.update({ where: { id }, data: { password: await hashPassword(String(password)) } });
};

/** Move an account to the trash (soft delete). */
export const moveUserToTrash = async (type: ManagedUserType, id: string, actorId: string) => {
  if (id === actorId) throw new UserManagementError("You cannot delete your own account");
  const delegate = delegateFor(type);
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) throw new UserManagementError("User not found", 404);
  if (existing.deletedAt) throw new UserManagementError("This user is already in the trash");
  await delegate.update({ where: { id }, data: { deletedAt: new Date(), deletedBy: actorId } });
};

/** Bring an account back from the trash. */
export const restoreUserFromTrash = async (type: ManagedUserType, id: string) => {
  const delegate = delegateFor(type);
  const existing = await delegate.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!existing) throw new UserManagementError("User not found", 404);
  if (!existing.deletedAt) throw new UserManagementError("This user is not in the trash");
  await delegate.update({ where: { id }, data: { deletedAt: null, deletedBy: null } });
};

/**
 * Delete forever (only from the trash). Accounts linked to orders, payments
 * or other records can't be removed and stay in the trash.
 */
export const deleteUserPermanently = async (type: ManagedUserType, id: string) => {
  const delegate = delegateFor(type);
  const existing = await delegate.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!existing) throw new UserManagementError("User not found", 404);
  if (!existing.deletedAt) {
    throw new UserManagementError("Move the user to the trash before deleting permanently");
  }
  try {
    await delegate.delete({ where: { id } });
  } catch (error: any) {
    if (error?.code === "P2003" || error?.code === "P2014") {
      throw new UserManagementError(
        "This user has orders, payments or other records linked to them, so they can only stay in the trash",
        409,
      );
    }
    throw error;
  }
};

/** Everything in the trash, newest first (optionally one account type). */
export const listTrash = async (type?: ManagedUserType) => {
  const types = type ? [type] : MANAGED_USER_TYPES;
  const nameField: Record<ManagedUserType, string> = { farmer: "name", restaurant: "name", admin: "username" };

  const lists = await Promise.all(
    types.map(async (t) => {
      const rows = await delegateFor(t).findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          deletedAt: true,
          deletedBy: true,
          createdAt: true,
          [nameField[t]]: true,
        },
      });
      return rows.map((row: any) => ({
        id: row.id,
        type: t,
        name: row[nameField[t]] || null,
        email: row.email,
        phone: row.phone,
        role: row.role,
        createdAt: row.createdAt,
        deletedAt: row.deletedAt,
        deletedBy: row.deletedBy,
      }));
    }),
  );

  const items = lists.flat().sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt));

  // Name who deleted each one
  const actorIds = [...new Set(items.map((i) => i.deletedBy).filter(Boolean))] as string[];
  const actors = actorIds.length
    ? await prisma.admin.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true } })
    : [];
  const actorName = new Map(actors.map((a) => [a.id, a.username]));
  return items.map((i) => ({ ...i, deletedByName: i.deletedBy ? actorName.get(i.deletedBy) || null : null }));
};
