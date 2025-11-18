import { Router } from "express";
import { UserController } from "../controllers/userController";
import { Role } from "@prisma/client";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const restaurantsRoutes = Router();

restaurantsRoutes.post("/", UserController.createRestaurant);
restaurantsRoutes.post("/admin/create", isAuthenticated, checkPermission(Role.ADMIN), UserController.createRestaurantByAdmin);
restaurantsRoutes.post("/verify", UserController.verifyRestaurant);
restaurantsRoutes.post("/resend-otp", UserController.resendOTP);
restaurantsRoutes.post("/accept", UserController.acceptTerms);
restaurantsRoutes.get("/", UserController.getAllRestaurants);
restaurantsRoutes.get("/:id", UserController.getRestaurantById);
restaurantsRoutes.put("/:id", UserController.updateRestaurant);
restaurantsRoutes.delete("/:id", UserController.deleteRestaurant);

export default restaurantsRoutes;
