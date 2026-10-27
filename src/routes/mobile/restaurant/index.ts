import { Router } from "express";
import authRoutes from "./auth.routes";
import cartRoutes from "./cart.routes";
import checkoutRoutes from "./checkout.routes";
import orderRoutes from "./order.routes";
import walletRoutes from "./wallet.routes";
import notificationRoutes from "./notification.routes";
import productRoutes from "./products.routes";
import voucherRoutes from "./voucher.routes";
import subscriptionRoutes from "./subscription.routes";
import affiliatorRoutes from "./affiliator.routes";
import addressRoutes from "./address.routes";
import marketRoutes from "./market.routes";
import aiRoutes from "./ai.routes";
import chatRoutes from "./chat.routes";
import configRoutes from "./config.routes";

const restaurantMobileRouter = Router();

restaurantMobileRouter.use("/", authRoutes);
restaurantMobileRouter.use("/products", productRoutes);
restaurantMobileRouter.use("/carts", cartRoutes);
restaurantMobileRouter.use("/checkouts", checkoutRoutes);
restaurantMobileRouter.use("/orders", orderRoutes);
restaurantMobileRouter.use("/wallets", walletRoutes);
restaurantMobileRouter.use("/notifications", notificationRoutes);
restaurantMobileRouter.use("/vouchers", voucherRoutes);
restaurantMobileRouter.use("/subscriptions", subscriptionRoutes);
restaurantMobileRouter.use("/affiliators", affiliatorRoutes);
restaurantMobileRouter.use("/addresses", addressRoutes);
restaurantMobileRouter.use("/market", marketRoutes);
restaurantMobileRouter.use("/ai", aiRoutes);
restaurantMobileRouter.use("/chat", chatRoutes);
restaurantMobileRouter.use("/config", configRoutes);

export default restaurantMobileRouter;
