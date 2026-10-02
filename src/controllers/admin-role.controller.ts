import { Request, Response } from "express";
import prisma from "../prisma";
import {
  normalizePermissions,
  PERMISSION_MODULES,
  SYSTEM_ROLES,
  isDashboardRole,
} from "../config/permissions";
import { AccessError, resolveRoleAssignment } from "../services/access.service";

const sendError = (res: Response, error: any, fallback: string) => {
  const status = error instanceof AccessError ? error.status : error.code === "P2002" ? 409 : 500;
  const message =
    error.code === "P2002" ? "A role with this name already exists" : error.message || fallback;
  res.status(status).json({ success: false, message });
};

const isLockedRole = (name: string) => name === SYSTEM_ROLES.ADMINISTRATOR.name;

/**
 * Permission catalog for the role editor
 * GET /admin-roles/permissions
 */
export const getPermissionCatalog = async (_req: Request, res: Response) => {
  res.json({ success: true, data: PERMISSION_MODULES });
};

/**
 * All roles with how many admins use each
 * GET /admin-roles
 */
export const getAdminRoles = async (_req: Request, res: Response) => {
  try {
    const roles = await prisma.adminRole.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { admins: true } } },
    });
    res.json({
      success: true,
      data: roles.map(({ _count, ...role }) => ({
        ...role,
        adminCount: _count.admins,
        locked: isLockedRole(role.name),
      })),
    });
  } catch (error: any) {
    sendError(res, error, "Failed to load roles");
  }
};

/**
 * POST /admin-roles  { name, description?, permissions: string[] }
 */
export const createAdminRole = async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    if (!name || !String(name).trim()) {
      throw new AccessError("Role name is required", 400);
    }
    const role = await prisma.adminRole.create({
      data: {
        name: String(name).trim(),
        description: description?.trim() || null,
        permissions: normalizePermissions(Array.isArray(permissions) ? permissions : []),
      },
    });
    res.status(201).json({ success: true, message: "Role created", data: role });
  } catch (error: any) {
    sendError(res, error, "Failed to create role");
  }
};

/**
 * PATCH /admin-roles/:id  { name?, description?, permissions? }
 * The Administrator role always has every permission and cannot be edited.
 */
export const updateAdminRole = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.adminRole.findUnique({ where: { id } });
    if (!existing) throw new AccessError("Role not found", 404);
    if (isLockedRole(existing.name)) {
      throw new AccessError("The Administrator role always has full access and cannot be edited", 400);
    }

    const { name, description, permissions } = req.body;
    if (existing.isSystem && name && name.trim() !== existing.name) {
      throw new AccessError("System roles cannot be renamed", 400);
    }

    const role = await prisma.adminRole.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(Array.isArray(permissions) && { permissions: normalizePermissions(permissions) }),
      },
    });
    res.json({ success: true, message: "Role updated", data: role });
  } catch (error: any) {
    sendError(res, error, "Failed to update role");
  }
};

/**
 * DELETE /admin-roles/:id — only custom roles nobody is using
 */
export const deleteAdminRole = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.adminRole.findUnique({
      where: { id },
      include: { _count: { select: { admins: true } } },
    });
    if (!existing) throw new AccessError("Role not found", 404);
    if (existing.isSystem) throw new AccessError("System roles cannot be deleted", 400);
    if (existing._count.admins > 0) {
      throw new AccessError(
        `Move the ${existing._count.admins} user(s) with this role to another role first`,
        400,
      );
    }
    await prisma.adminRole.delete({ where: { id } });
    res.json({ success: true, message: "Role deleted" });
  } catch (error: any) {
    sendError(res, error, "Failed to delete role");
  }
};

/**
 * PATCH /admin-roles/assign/:adminId  { adminRoleId }
 * Give a dashboard user a role. Traders, logistics, aggregators and super
 * admins keep their own access model and can't be reassigned here.
 */
export const assignAdminRole = async (req: Request, res: Response) => {
  try {
    const adminId = req.params.adminId as string;
    const actor = (req as any).user;
    if (adminId === actor.id) {
      throw new AccessError("You cannot change your own role", 400);
    }

    const target = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!target) throw new AccessError("User not found", 404);
    if (!isDashboardRole(target.role) || target.role === "SUPERUSER") {
      throw new AccessError(
        `${target.role} users don't use dashboard roles`,
        400,
      );
    }

    const { role, adminRoleId } = await resolveRoleAssignment(actor, {
      adminRoleId: req.body.adminRoleId,
    });

    const updated = await prisma.admin.update({
      where: { id: adminId },
      data: { role, adminRoleId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        adminRole: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, message: "Role assigned", data: updated });
  } catch (error: any) {
    sendError(res, error, "Failed to assign role");
  }
};
