// Backend Middleware - Token-Based
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { getUserById } from "../services/userGets";
import { getCustomerTypeScope, getEffectivePermissions } from "../services/access.service";
import { hasDashboardAccess, Permission, PermissionModule } from "../config/permissions";

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

    // A trashed account's old session stops working right away
    if (user.deletedAt) {
      return res.status(401).json({ message: "This account has been deleted" });
    }

    // Dashboard users carry their permissions; loaded per request so role
    // changes apply immediately without re-login.
    user.permissions = hasDashboardAccess(user.role)
      ? await getEffectivePermissions(user)
      : [];
    // Customer types the user works with (null = all); limits customer lists
    user.customerTypeScope = hasDashboardAccess(user.role)
      ? await getCustomerTypeScope(user)
      : null;

    (req as any).user = user;
    next();
  } catch (err: any) {
    // Reason is logged server-side only (TokenExpiredError, JsonWebTokenError: invalid signature, DB errors…)
    console.warn(`[auth] ${req.method} ${req.originalUrl} rejected: ${err?.name}: ${err?.message}`);
    // Only token problems are an auth failure. DB/infra errors must not look like
    // an expired session, or the client logs the user out during an outage.
    const isTokenError =
      err?.name === "TokenExpiredError" ||
      err?.name === "JsonWebTokenError" ||
      err?.name === "NotBeforeError" ||
      err?.message === "Invalid token payload";
    if (!isTokenError) {
      return res
        .status(503)
        .json({ message: "Service temporarily unavailable, please retry" });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * Signs the user in when a valid token is sent, but lets the request through
 * without one (for endpoints that are also used publicly). Dashboard users then
 * get their permissions and customer-type scope like with isAuthenticated.
 */
export const attachUserIfPresent = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();
  try {
    const decoded = verifyToken(authHeader.substring(7));
    const user: any = await getUserById(decoded.id);
    if (user && !user.deletedAt) {
      user.permissions = hasDashboardAccess(user.role) ? await getEffectivePermissions(user) : [];
      user.customerTypeScope = hasDashboardAccess(user.role) ? await getCustomerTypeScope(user) : null;
      (req as any).user = user;
    }
  } catch {
    // Bad or expired token: carry on as a public request
  }
  next();
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

const forbidden = (res: Response, required: string[]) =>
  res.status(403).json({
    message: "Forbidden: you don't have permission for this action",
    required,
  });

// Default action for a module guard when the route names none
const METHOD_ACTIONS: Record<string, string> = {
  GET: "view",
  HEAD: "view",
  POST: "create",
  PUT: "edit",
  PATCH: "edit",
  DELETE: "delete",
};

/**
 * Dashboard feature guard. Passes when the user:
 * - signs in to the dashboard (office or field role) and has the needed
 *   permission for ANY of the given modules, or
 * - has one of `otherRoles` (e.g. RESTAURANT on shared endpoints).
 *
 *   allow("orders")                  GET → orders.view, POST → orders.create,
 *                                    PUT/PATCH → orders.edit, DELETE → orders.delete
 *   allow("orders", "RESTAURANT")    shared endpoint
 *   allow(["categories", "markets"]) needed by two features
 *   allow.view("markets")            read-only even for POST
 *   allow.to("orders.update_status") one named action (or a list: any of them)
 */
const buildGuard =
  (action: "auto" | "view") =>
  (modules: PermissionModule | PermissionModule[], ...otherRoles: string[]) => {
    const moduleList = Array.isArray(modules) ? modules : [modules];

    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (otherRoles.includes(user.role)) return next();

      const needed = action === "auto" ? METHOD_ACTIONS[req.method] || "edit" : action;
      const required = moduleList.map((m) => `${m}.${needed}`);

      if (hasDashboardAccess(user.role) && required.some((p) => hasPermission(user, p))) {
        return next();
      }
      return forbidden(res, required);
    };
  };

const actionGuard =
  (permissions: Permission | Permission[], ...otherRoles: string[]) => {
    const required: string[] = Array.isArray(permissions) ? permissions : [permissions];

    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (otherRoles.includes(user.role)) return next();
      if (hasDashboardAccess(user.role) && required.some((p) => hasPermission(user, p))) {
        return next();
      }
      return forbidden(res, required);
    };
  };

export const allow = Object.assign(buildGuard("auto"), {
  view: buildGuard("view"),
  to: actionGuard,
});

/** True when the signed-in user holds this permission (super admins hold all). */
export const userCan = (user: any, permission: Permission) =>
  hasDashboardAccess(user?.role) && hasPermission(user, permission);

/** Only super admins (role & permission management). */
export const superAdminOnly = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user?.role !== "SUPERUSER") {
    return res.status(403).json({ message: "Forbidden: super admin only" });
  }
  next();
};
