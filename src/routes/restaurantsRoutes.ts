import { Router } from "express";
import { UserController } from "../controllers/userController";

const restaurantsRoutes = Router();

restaurantsRoutes.post("/", UserController.createRestaurant);
restaurantsRoutes.post("/verify", UserController.verifyRestaurant);
restaurantsRoutes.post("/resend-otp", UserController.resendOTP);
restaurantsRoutes.get("/", UserController.getAllRestaurants);
restaurantsRoutes.get("/:id", UserController.getRestaurantById);
restaurantsRoutes.put("/:id", UserController.updateRestaurant);
restaurantsRoutes.delete("/:id", UserController.deleteRestaurant);

export default restaurantsRoutes;
