import { Router } from "express";
import { UserController } from "../controllers/userController";

const userRoutes = Router();

userRoutes.post("/login", UserController.login);
userRoutes.get("/me", UserController.me);
userRoutes.post("/logout", UserController.logout);

export default userRoutes;
