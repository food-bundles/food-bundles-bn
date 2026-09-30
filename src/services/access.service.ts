import prisma from "../prisma";
import { Role } from "@prisma/client";
import {
  ALL_PERMISSIONS,
  normalizePermissions,
  Permission,
  SYSTEM_ROLES,
} from "../config/permissions";

/**
 * Effective dashboard permissions for a user.
 * - SUPERUSER: everything (and only they manage roles)
 * - admin with an AdminRole: that role's permissions
 * - legacy fallbacks keep today's behaviour until the backfill has run:
 *   ADMIN → everything, MARKET_PRICES → market prices only
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
  if (user.role === "MARKET_PRICES") return SYSTEM_ROLES.MARKET_PRICES_MANAGER.permissions;
  return [];
};

/**
 * Validate the role an actor wants to give a new/updated admin account and
 * return what to store. Blocks privilege escalation:
 * - only SUPERUSER can create SUPERUSERs or assign dynamic roles
 * - a dynamic role maps to enum role ADMIN (Administrator) or STAFF (others)
 */
export const resolveRoleAssignment = async (
  actor: { role?: string | null } | undefined,
  input: { role?: string | null; adminRoleId?: string | null },
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
    return {
      role: adminRole.name === SYSTEM_ROLES.ADMINISTRATOR.name ? Role.ADMIN : Role.STAFF,
      adminRoleId: adminRole.id,
    };
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
 * 2. "Market Prices Manager" exists (created with defaults once; editable after)
 * 3. Existing ADMIN / MARKET_PRICES users without a role get the matching one
 */
export const ensureSystemRoles = async () => {
  const administrator = await prisma.adminRole.upsert({
    where: { name: SYSTEM_ROLES.ADMINISTRATOR.name },
    update: { permissions: ALL_PERMISSIONS, isSystem: true },
    create: {
      name: SYSTEM_ROLES.ADMINISTRATOR.name,
      description: SYSTEM_ROLES.ADMINISTRATOR.description,
      permissions: ALL_PERMISSIONS,
      isSystem: true,
    },
  });

  const marketManager = await prisma.adminRole.upsert({
    where: { name: SYSTEM_ROLES.MARKET_PRICES_MANAGER.name },
    update: { isSystem: true },
    create: {
      name: SYSTEM_ROLES.MARKET_PRICES_MANAGER.name,
      description: SYSTEM_ROLES.MARKET_PRICES_MANAGER.description,
      permissions: SYSTEM_ROLES.MARKET_PRICES_MANAGER.permissions,
      isSystem: true,
    },
  });

  const [admins, marketUsers] = await Promise.all([
    prisma.admin.updateMany({
      where: { role: "ADMIN", adminRoleId: null },
      data: { adminRoleId: administrator.id },
    }),
    prisma.admin.updateMany({
      where: { role: "MARKET_PRICES", adminRoleId: null },
      data: { adminRoleId: marketManager.id },
    }),
  ]);

  if (admins.count || marketUsers.count) {
    console.log(
      `[roles] Assigned Administrator to ${admins.count} and Market Prices Manager to ${marketUsers.count} existing user(s)`,
    );
  }
};
