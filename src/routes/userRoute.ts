import { Router } from "express";
import { UserController} from "../controllers/userController";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";

const userRoutes = Router();

userRoutes.post("/login", UserController.login);

userRoutes.post("/farmers", UserController.createFarmer);
userRoutes.get("/farmers", UserController.getAllFarmers);
userRoutes.get("/farmers/:id", UserController.getFarmerById);
userRoutes.put("/farmers/:id", UserController.updateFarmer);
userRoutes.delete("/farmers/:id", UserController.deleteFarmer);

userRoutes.post("/restaurants", UserController.createRestaurant);
userRoutes.get("/restaurants", UserController.getAllRestaurants);
userRoutes.get("/restaurants/:id", UserController.getRestaurantById);
userRoutes.put("/restaurants/:id", UserController.updateRestaurant);
userRoutes.delete("/restaurants/:id", UserController.deleteRestaurant);

userRoutes.post("/admins", isAuthenticated,checkPermission(Role.FOOD_BUNDLE), UserController.createAdmin);
userRoutes.get("/admins", UserController.getAllAdmins);
userRoutes.get("/admins/:id", UserController.getAdminById);
userRoutes.put("/admins/:id", UserController.updateAdmin);
userRoutes.delete("/admins/:id", UserController.deleteAdmin);

export default userRoutes;
