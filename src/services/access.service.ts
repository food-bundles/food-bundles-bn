import prisma from "../prisma";
import { Role } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  FIELD_ROLES,
  normalizePermissions,
  Permission,
  SYSTEM_ROLES,
  userRoleForAdminRole,
} from "../config/permissions";

const isFieldRole = (role?: string | null) =>
  !!role && (FIELD_ROLES as readonly string[]).includes(role);

// System role whose account role (Role enum) is this one, if any
const systemRoleFor = (role: string) =>
  Object.values(SYSTEM_ROLES).find((r) => r.userRole === role);

/**
 * Effective dashboard permissions for a user.
 * - SUPERUSER: everything (and only they manage roles)
 * - admin with an AdminRole: that role's permissions
 * - fallbacks until the startup backfill has run: ADMIN → everything; MARKET_PRICES,
 *   AGGREGATOR, LOGISTICS → their system role's default permissions
 * - everyone else (restaurants, farmers, traders, logistics…): none
 */
export const getEffectivePermissions = async (user: {
  role?: string | null;
  adminRoleId?: string | null;
}): Promise<Permission[]> => {
  if (!user?.role) return [];
  if (user.role === "SUPERUSER") return ALL_PERMISSIONS;

  if (user.adminRoleId) {
    const adminRole = await prisma.adminRole.findUnique({
      where: { id: user.adminRoleId },
      select: { permissions: true },
    });
    if (adminRole) return normalizePermissions(adminRole.permissions);
  }

  if (user.role === "ADMIN") return ALL_PERMISSIONS;
  const fallback = systemRoleFor(user.role);
  return fallback ? [...fallback.permissions] : [];
};

/**
 * Validate the role an actor wants to give a new/updated admin account and
 * return what to store. Blocks privilege escalation:
 * - only SUPERUSER can create SUPERUSERs or assign dynamic roles
 * - a system role maps to its account role (Administrator → ADMIN, Aggregator →
 *   AGGREGATOR…); a custom role keeps a field user's role (an aggregator stays an
 *   aggregator, so they still only see their own submissions), otherwise STAFF
 * - picking a plain account role (e.g. AGGREGATOR) attaches its system role
 */
export const resolveRoleAssignment = async (
  actor: { role?: string | null } | undefined,
  input: { role?: string | null; adminRoleId?: string | null },
  currentRole?: string | null,
): Promise<{ role: Role; adminRoleId: string | null }> => {
  const actorIsSuper = actor?.role === "SUPERUSER";

  if (input.adminRoleId) {
    if (!actorIsSuper) {
      throw new AccessError("Only a super admin can assign dashboard roles");
    }
    const adminRole = await prisma.adminRole.findUnique({
      where: { id: input.adminRoleId },
    });
    if (!adminRole) throw new AccessError("Selected role does not exist", 400);
    const mapped = userRoleForAdminRole(adminRole.name);
    const role =
      mapped === "STAFF" && isFieldRole(currentRole) ? (currentRole as Role) : (mapped as Role);
    return { role, adminRoleId: adminRole.id };
  }

  const role = input.role as Role;
  if (!role || !Object.values(Role).includes(role)) {
    throw new AccessError("A valid role is required", 400);
  }
  if (role === Role.SUPERUSER && !actorIsSuper) {
    throw new AccessError("Only a super admin can create super admins");
  }
  if (role === Role.STAFF) {
    throw new AccessError("Choose a dashboard role for staff users", 400);
  }
  const system = systemRoleFor(role);
  if (system) {
    const adminRole = await prisma.adminRole.findUnique({
      where: { name: system.name },
      select: { id: true },
    });
    if (adminRole) return { role, adminRoleId: adminRole.id };
  }
  return { role, adminRoleId: null };
};

export class AccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
  }
}

/**
 * Idempotent startup sync (safe on every boot, never deletes data):
 * 1. "Administrator" exists and always has every permission in the catalog
 * 2. The other system roles exist (created with defaults once; editable after)
 * 3. Users without a role get the system role matching their account role
 * 4. Saved roles are rewritten to current permission keys (legacy
 *    "<module>.manage" becomes every action of that module — same access)
 */
export const ensureSystemRoles = async () => {
  try {
    for (const system of Object.values(SYSTEM_ROLES)) {
      const isAdministrator = system.name === SYSTEM_ROLES.ADMINISTRATOR.name;
      const adminRole = await prisma.adminRole.upsert({
        where: { name: system.name },
        update: isAdministrator
          ? { permissions: ALL_PERMISSIONS, isSystem: true }
          : { isSystem: true },
        create: {
          name: system.name,
          description: system.description,
          permissions: [...system.permissions],
          isSystem: true,
        },
      });

      const assigned = await prisma.admin.updateMany({
        where: { role: system.userRole as Role, adminRoleId: null },
        data: { adminRoleId: adminRole.id },
      });
      if (assigned.count) {
        console.log(`[roles] Assigned "${system.name}" to ${assigned.count} existing user(s)`);
      }
    }

    const roles = await prisma.adminRole.findMany({ select: { id: true, name: true, permissions: true } });
    let migrated = 0;
    for (const role of roles) {
      const normalized = normalizePermissions(role.permissions);
      const same =
        normalized.length === role.permissions.length &&
        normalized.every((p, i) => p === role.permissions[i]);
      if (!same) {
        await prisma.adminRole.update({ where: { id: role.id }, data: { permissions: normalized } });
        migrated++;
      }
    }
    if (migrated) console.log(`[roles] Updated ${migrated} role(s) to the current permission keys`);
  } catch (error: any) {
    console.warn("[roles] Warning: Could not sync system roles at startup:", error?.message || error);
  }
};
