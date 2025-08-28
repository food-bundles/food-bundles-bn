"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ussdRoute_1 = __importDefault(require("./ussdRoute"));
const userRoute_1 = __importDefault(require("./userRoute"));
const ProductVerifyRoute_1 = __importDefault(require("./ProductVerifyRoute"));
const productRoute_1 = __importDefault(require("./productRoute"));
const errorhandler_utlity_1 = __importDefault(require("../utils/errorhandler.utlity"));
const error_controller_1 = require("../controllers/error.controller");
const submissionsRoutes_1 = __importDefault(require("./submissionsRoutes"));
const adminsRoutes_1 = __importDefault(require("./adminsRoutes"));
const restaurantsRoutes_1 = __importDefault(require("./restaurantsRoutes"));
const farmersRoutes_1 = __importDefault(require("./farmersRoutes"));
const cart_routes_1 = __importDefault(require("./cart.routes"));
const checkout_routes_1 = __importDefault(require("./checkout.routes"));
const order_routes_1 = __importDefault(require("./order.routes"));
const product_category_routes_1 = __importDefault(require("./product_category.routes"));
const routes = (0, express_1.Router)();
// Order matters! Most specific routes should come first
routes.use("/farmers", farmersRoutes_1.default);
routes.use("/restaurants", restaurantsRoutes_1.default);
routes.use("/admins", adminsRoutes_1.default);
routes.use("/submissions", submissionsRoutes_1.default);
routes.use("/products", productRoute_1.default);
routes.use("/carts", cart_routes_1.default);
routes.use("/category", product_category_routes_1.default);
routes.use("/checkouts", checkout_routes_1.default);
routes.use("/orders", order_routes_1.default);
// These should come after the specific routes above
routes.use("/", ProductVerifyRoute_1.default);
routes.use("/", userRoute_1.default);
routes.use("/", ussdRoute_1.default); // This should probably be last since it has generic paths
// 404 handler
routes.all("/{0,}", (req, res, next) => {
    next(new errorhandler_utlity_1.default({
        message: `Route ${req.originalUrl} not found`,
        statusCode: 404,
    }));
});
// Global error handler
routes.use(error_controller_1.globalErrorController);
exports.default = routes;
