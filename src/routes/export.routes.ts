import { Router, Request, Response, NextFunction } from "express";
import {
  exportData,
  getExportTypes,
} from "../controllers/export.controller";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import { PermissionModule, PERMISSION_MODULES } from "../config/permissions";

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
  subscriptions: ["subscriptions"],
  wallets: ["deposits"],
  loans: ["vouchers"],
  deposits: ["deposits"],
  transactions: ["deposits"],
};

const ALL_MODULES = PERMISSION_MODULES.map((m) => m.key) as PermissionModule[];

// Get available export types and formats (any dashboard user)
exportRoutes.get("/types", isAuthenticated, allow.view(ALL_MODULES), getExportTypes);

// Export data in specified format — needs view access to that data's feature
exportRoutes.get(
  "/:type/:format",
  isAuthenticated,
  (req: Request, res: Response, next: NextFunction) =>
    allow.view(EXPORT_MODULES[req.params.type as string] || ["admins"])(req, res, next),
  exportData
);

export default exportRoutes;
