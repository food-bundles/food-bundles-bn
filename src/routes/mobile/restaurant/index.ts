import { Router } from "express";
import authRoutes from "./auth.routes";
import cartRoutes from "./cart.routes";
import checkoutRoutes from "./checkout.routes";
import orderRoutes from "./order.routes";
import walletRoutes from "./wallet.routes";
import notificationRoutes from "./notification.routes";
import productRoutes from "./products.routes";
import voucherRoutes from "./voucher.routes";

const restaurantMobileRouter = Router();

restaurantMobileRouter.use("/", authRoutes);
restaurantMobileRouter.use("/products", productRoutes);
restaurantMobileRouter.use("/carts", cartRoutes);
restaurantMobileRouter.use("/checkouts", checkoutRoutes);
restaurantMobileRouter.use("/orders", orderRoutes);
restaurantMobileRouter.use("/wallets", walletRoutes);
restaurantMobileRouter.use("/notifications", notificationRoutes);
restaurantMobileRouter.use("/vouchers", voucherRoutes);

export default restaurantMobileRouter;
