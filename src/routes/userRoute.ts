import { Router } from "express";
import { UserController } from "../controllers/userController";

const userRoutes = Router();

userRoutes.post("/login", UserController.login);
userRoutes.get("/me", UserController.me);

export default userRoutes;
