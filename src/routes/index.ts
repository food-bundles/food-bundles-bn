import { Router } from "express";
import ussdRoutes from "./ussdRoute";
import userRoutes from "./userRoute";

const routes = Router();

routes.use("/", ussdRoutes);
routes.use("/", userRoutes);

export default routes;
