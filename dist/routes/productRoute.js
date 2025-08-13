"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const productController_1 = require("../controllers/productController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const multer_1 = __importDefault(require("../middleware/multer"));
const productRoutes = (0, express_1.Router)();
// Create new product (Admin only)
productRoutes.post("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), multer_1.default, productController_1.createProduct);
// Get all products (accessible by all authenticated)
productRoutes.get("/", productController_1.getAllProducts);
// Get product by ID (accessible by all authenticated users)
productRoutes.get("/:productId", productController_1.getProductById);
// Update product (Admin only)
productRoutes.patch("/:productId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), multer_1.default, productController_1.updateProduct);
productRoutes.delete("/:productId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), productController_1.deleteProduct);
exports.default = productRoutes;
