import { Router } from "express";
import { UserController } from "../controllers/userController";
import { allow, isAuthenticated, superAdminOnly } from "../middleware/authMiddleware";

// Admin user management — "Administration" permission: anyone whose role has
// admins.view lists users, admins.create / admins.edit add and edit them.
// Role changes and SUPERUSER accounts are further restricted in the controller.
const adminsRoutes = Router();

adminsRoutes.use(isAuthenticated, allow("admins"));

adminsRoutes.post("/", UserController.createAdmin);
adminsRoutes.get("/", UserController.getAllAdmins);
adminsRoutes.get("/:id", UserController.getAdminById);
adminsRoutes.put("/:id", UserController.updateAdmin);
adminsRoutes.delete("/:id", superAdminOnly, UserController.deleteAdmin);

export default adminsRoutes;
