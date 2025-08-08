import { Router } from "express";
import { UserController } from "../controllers/userController";

const adminsRoutes = Router();

adminsRoutes.post(
  "/",
  //   isAuthenticated,
  //   checkPermission(Role.ADMIN),
  UserController.createAdmin
);
adminsRoutes.get("/", UserController.getAllAdmins);
adminsRoutes.get("/:id", UserController.getAdminById);
adminsRoutes.put("/:id", UserController.updateAdmin);
adminsRoutes.delete("/:id", UserController.deleteAdmin);

export default adminsRoutes;
