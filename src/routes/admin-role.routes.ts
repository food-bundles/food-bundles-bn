import { Router } from "express";
import {
  assignAdminRole,
  createAdminRole,
  deleteAdminRole,
  getAdminRoles,
  getPermissionCatalog,
  updateAdminRole,
} from "../controllers/admin-role.controller";
import { isAuthenticated, superAdminOnly } from "../middleware/authMiddleware";

// Roles & permissions management — super admins (SUPERUSER) only
const adminRoleRoutes = Router();

adminRoleRoutes.use(isAuthenticated, superAdminOnly);

adminRoleRoutes.get("/permissions", getPermissionCatalog);
adminRoleRoutes.get("/", getAdminRoles);
adminRoleRoutes.post("/", createAdminRole);
adminRoleRoutes.patch("/assign/:adminId", assignAdminRole);
adminRoleRoutes.patch("/:id", updateAdminRole);
adminRoleRoutes.delete("/:id", deleteAdminRole);

export default adminRoleRoutes;
