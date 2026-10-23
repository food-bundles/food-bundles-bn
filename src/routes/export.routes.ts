import { Router, Request, Response, NextFunction } from "express";
import {
  exportData,
  getExportTypes,
} from "../controllers/export.controller";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import {
  isValidPermission,
  Permission,
  PermissionModule,
  PERMISSION_MODULES,
} from "../config/permissions";

const exportRoutes = Router();

// Which feature a data export belongs to: exporting needs view access to it
const EXPORT_MODULES: Record<string, PermissionModule[]> = {
  users: ["user_lookup", "farmers", "restaurants", "admins"],
  orders: ["orders"],
  restaurants: ["restaurants"],
  payments: ["orders", "deposits"],
  products: ["products"],
  farmers: ["farmers"],
  logistics: ["admins"],
  aggregators: ["admins"],
  markets: ["markets"],
  subscriptions: ["subscriptions"],
  wallets: ["deposits"],
  loans: ["vouchers"],
  deposits: ["deposits"],
  transactions: ["deposits"],
  submissions: ["farmer_submissions"],
};

const ALL_MODULES = PERMISSION_MODULES.map((m) => m.key) as PermissionModule[];

// Get available export types and formats (any dashboard user)
exportRoutes.get("/types", isAuthenticated, allow.view(ALL_MODULES), getExportTypes);

// Export permission of a feature ("orders.export"), or view when it has none
const exportPermission = (module: PermissionModule): Permission =>
  (isValidPermission(`${module}.export`) ? `${module}.export` : `${module}.view`) as Permission;

// Export data in specified format — needs the export permission of that data's feature
exportRoutes.get(
  "/:type/:format",
  isAuthenticated,
  (req: Request, res: Response, next: NextFunction) =>
    allow.to((EXPORT_MODULES[req.params.type as string] || ["admins"]).map(exportPermission))(
      req,
      res,
      next,
    ),
  exportData
);

export default exportRoutes;
