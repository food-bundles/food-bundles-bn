import { Router } from "express";
import { UserController } from "../controllers/userController";

const userRoutes = Router();

userRoutes.post("/login", UserController.login);

export default userRoutes;
