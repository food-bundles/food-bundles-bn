import { Router } from "express";
import { UserController } from "../controllers/userController";
import { allow, isAuthenticated } from "../middleware/authMiddleware";

// Admin user management — "Administration" permission (admins.view / admins.manage).
// Role changes and SUPERUSER accounts are further restricted in the controller.
const adminsRoutes = Router();

adminsRoutes.use(isAuthenticated, allow("admins"));

adminsRoutes.post("/", UserController.createAdmin);
adminsRoutes.get("/", UserController.getAllAdmins);
adminsRoutes.get("/:id", UserController.getAdminById);
adminsRoutes.put("/:id", UserController.updateAdmin);
adminsRoutes.delete("/:id", UserController.deleteAdmin);

export default adminsRoutes;
