"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const adminsRoutes = (0, express_1.Router)();
adminsRoutes.post("/", 
//   isAuthenticated,
//   checkPermission(Role.ADMIN),
userController_1.UserController.createAdmin);
adminsRoutes.get("/", userController_1.UserController.getAllAdmins);
adminsRoutes.get("/:id", userController_1.UserController.getAdminById);
adminsRoutes.put("/:id", userController_1.UserController.updateAdmin);
adminsRoutes.delete("/:id", userController_1.UserController.deleteAdmin);
exports.default = adminsRoutes;
