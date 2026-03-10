import { Router } from "express";
import { UserController } from "../controllers/userController";

const userRoutes = Router();

userRoutes.post("/login", UserController.login);
userRoutes.get("/me", UserController.me);

// Password reset routes
userRoutes.post("/forgot-password", UserController.requestPasswordReset);
userRoutes.post("/reset-password", UserController.resetPassword);

// User lookup routes
userRoutes.get("/users/id/:id", UserController.getUserById);
userRoutes.get("/users/email/:email", UserController.getUserByEmail);
userRoutes.get("/users/phone/:phone", UserController.getUserByPhone);

export default userRoutes;
