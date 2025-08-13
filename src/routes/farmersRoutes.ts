import { Router } from "express";
import { UserController } from "../controllers/userController";
import { Role } from "@prisma/client";

const farmersRoutes = Router();

farmersRoutes.post("/", UserController.createFarmer);
farmersRoutes.get("/", UserController.getAllFarmers);
farmersRoutes.get("/:id", UserController.getFarmerById);
farmersRoutes.put("/:id", UserController.updateFarmer);
farmersRoutes.delete("/:id", UserController.deleteFarmer);

export default farmersRoutes;
