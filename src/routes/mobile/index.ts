import { Router } from "express";
import restaurantMobileRouter from "./restaurant/index";

const mobileAppsRouter = Router();

// All restaurant mobile app routes → /mobile/restaurant/...
mobileAppsRouter.use("/restaurant", restaurantMobileRouter);

export default mobileAppsRouter;
