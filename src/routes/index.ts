import { NextFunction, Request, Response, Router } from "express";
import ussdRoutes from "./ussdRoute";
import userRoutes from "./userRoute";
import ProductverifyRoutes from "./ProductVerifyRoute";
import productRoutes from "./productRoute";
import errorHandler from "../utils/errorhandler.utlity";
import { globalErrorController } from "../controllers/error.controller";
import submissionsRoutes from "./submissionsRoutes";
import adminsRoutes from "./adminsRoutes";
import restaurantsRoutes from "./restaurantsRoutes";
import farmersRoutes from "./farmersRoutes";
import cartRoutes from "./cart.routes";
import checkoutRoutes from "./checkout.routes";
import orderRoutes from "./order.routes";
import productCategoryRoutes from "./product_category.routes";
import walletRoutes from "./wallet.routes";
import paymentsRoutes from "./payments.route";
import locationRoutes from "./location.routes";
import subscriptionRoutes from "./subscription.routes";

const routes = Router();

// Order matters! Most specific routes should come first
routes.use("/farmers", farmersRoutes);
routes.use("/restaurants", restaurantsRoutes);
routes.use("/admins", adminsRoutes);
routes.use("/submissions", submissionsRoutes);
routes.use("/products", productRoutes);
routes.use("/carts", cartRoutes);
routes.use("/category", productCategoryRoutes);
routes.use("/checkouts", checkoutRoutes);
routes.use("/orders", orderRoutes);
routes.use("/wallets", walletRoutes);
routes.use("/payments", paymentsRoutes);
routes.use("/locations", locationRoutes);
routes.use("/subscriptions", subscriptionRoutes);

// These should come after the specific routes above
routes.use("/", ProductverifyRoutes);
routes.use("/", userRoutes);
routes.use("/", ussdRoutes); // This should probably be last since it has generic paths

// 404 handler
routes.all("/{0,}", (req: Request, res: Response, next: NextFunction) => {
  next(
    new errorHandler({
      message: `Route ${req.originalUrl} not found`,
      statusCode: 404,
    })
  );
});

// Global error handler
routes.use(globalErrorController);

export default routes;
