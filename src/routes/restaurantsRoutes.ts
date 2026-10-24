import { Router } from "express";
import { UserController } from "../controllers/userController";
import { Role } from "@prisma/client";
import {
  attachUserIfPresent,
  isAuthenticated,
  allow,
  superAdminOnly,
} from "../middleware/authMiddleware";

const restaurantsRoutes = Router();

restaurantsRoutes.post("/", UserController.createRestaurant);
restaurantsRoutes.post("/admin/create", isAuthenticated, allow("restaurants"), UserController.createRestaurantByAdmin);
restaurantsRoutes.post("/verify", UserController.verifyRestaurant);
restaurantsRoutes.post("/resend-otp", UserController.resendOTP);
restaurantsRoutes.post("/accept", UserController.acceptTerms);
// Public for now; when a dashboard user is signed in, their customer-type scope applies
restaurantsRoutes.get("/", attachUserIfPresent, UserController.getAllRestaurants);
restaurantsRoutes.get("/:id", attachUserIfPresent, UserController.getRestaurantById);
// Edit: the restaurant itself or restaurants.edit; delete (to trash): super admin
restaurantsRoutes.put("/:id", isAuthenticated, UserController.updateRestaurant);
restaurantsRoutes.delete("/:id", isAuthenticated, superAdminOnly, UserController.deleteRestaurant);

export default restaurantsRoutes;
