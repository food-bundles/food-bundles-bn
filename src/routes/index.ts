import { Router } from "express";
import ussdRoutes from "./ussdRoute";
import userRoutes from "./userRoute";
import ProductverifyRoutes from "./ProductVerifyRoute";
import productRoutes from "./productRoute";

const routes = Router();

routes.use("/", ussdRoutes);
routes.use("/", userRoutes);
routes.use("/", ProductverifyRoutes);
routes.use("/", productRoutes);

export default routes;
