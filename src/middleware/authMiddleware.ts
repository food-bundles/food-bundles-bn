// Backend Middleware - Token-Based
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { getUserById } from "../services/userGets";
import { getEffectivePermissions } from "../services/access.service";
import { isDashboardRole, PermissionModule } from "../config/permissions";

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token found" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = verifyToken(token);

    const user: any = await getUserById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Dashboard users carry their permissions; loaded per request so role
    // changes apply immediately without re-login.
    user.permissions = isDashboardRole(user.role)
      ? await getEffectivePermissions(user)
      : [];

    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/** Role-based guard for non-dashboard roles (restaurants, farmers, traders…). */
export const checkPermission = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (
      !user ||
      (!allowedRoles.includes(user.role) && user.role !== "SUPERUSER")
    ) {
      return res.status(403).json({ message: "Forbidden: Access denied" });
    }

    next();
  };
};

const hasPermission = (user: any, permission: string) =>
  user?.role === "SUPERUSER" ||
  (Array.isArray(user?.permissions) && user.permissions.includes(permission));

/**
 * Dashboard feature guard. Passes when the user:
 * - is a dashboard user with `<module>.view` (GET/HEAD) or `<module>.manage`
 *   (other methods) for ANY of the given modules, or
 * - has one of `otherRoles` (e.g. RESTAURANT on shared endpoints).
 *
 *   allow("orders")                         admin-only orders endpoint
 *   allow("orders", "RESTAURANT", "HOTEL")  shared endpoint
 *   allow(["categories", "markets"])        needed by two features
 *   allow.view("markets")                   read-only even for POST
 */
const buildGuard =
  (action: "auto" | "view" | "manage") =>
  (modules: PermissionModule | PermissionModule[], ...otherRoles: string[]) => {
    const moduleList = Array.isArray(modules) ? modules : [modules];

    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (otherRoles.includes(user.role)) return next();

      const needed =
        action === "auto"
          ? ["GET", "HEAD"].includes(req.method)
            ? "view"
            : "manage"
          : action;

      if (
        isDashboardRole(user.role) &&
        moduleList.some((m) => hasPermission(user, `${m}.${needed}`))
      ) {
        return next();
      }

      return res.status(403).json({
        message: "Forbidden: you don't have permission for this action",
        required: moduleList.map((m) => `${m}.${needed}`),
      });
    };
  };

export const allow = Object.assign(buildGuard("auto"), {
  view: buildGuard("view"),
  manage: buildGuard("manage"),
});

/** Only super admins (role & permission management). */
export const superAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user?.role !== "SUPERUSER") {
    return res.status(403).json({ message: "Forbidden: super admin only" });
  }
  next();
};
