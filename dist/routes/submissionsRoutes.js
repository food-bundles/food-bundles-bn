"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProductVerifyController_1 = __importDefault(require("../controllers/ProductVerifyController"));
const client_1 = require("@prisma/client");
const productController_1 = require("../controllers/productController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const imageUpload_1 = require("../utils/imageUpload");
const submissionsRoutes = (0, express_1.Router)();
// Get verified submissions ready for admin approval (move this BEFORE parameterized routes)
submissionsRoutes.get("/verified", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), productController_1.getVerifiedSubmissions);
// Get submissions awaiting feedback (aggregators/admins)
submissionsRoutes.get("/awaiting-feedback", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.AGGREGATOR, client_1.Role.ADMIN), ProductVerifyController_1.default.getSubmissionsAwaitingFeedback);
// Get submissions by status (move this BEFORE parameterized routes)
submissionsRoutes.get("/status/:status", authMiddleware_1.isAuthenticated, ProductVerifyController_1.default.getSubmissionsByStatus);
// farmers only (move this BEFORE parameterized routes)
submissionsRoutes.get("/my-submissions", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.FARMER), ProductVerifyController_1.default.getMySubmissions);
// dashboard data (move this BEFORE parameterized routes)
submissionsRoutes.get("/stats", authMiddleware_1.isAuthenticated, ProductVerifyController_1.default.getSubmissionStats);
// Get all submissions role-based (move this BEFORE parameterized routes)
submissionsRoutes.get("/", authMiddleware_1.isAuthenticated, ProductVerifyController_1.default.getAllSubmissions);
// Update product quantity from submission (Admin only)
submissionsRoutes.patch("/:submissionId/products/:productId/update-quantity", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), productController_1.updateProductQuantityFromSubmission);
// Create product from submission
submissionsRoutes.post("/:submissionId/create-product", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), imageUpload_1.upload.array("images", 4), imageUpload_1.validateImages, productController_1.createProductFromSubmission);
// Approve submission
submissionsRoutes.patch("/:submissionId/approve", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), productController_1.approveSubmission);
// Purchase product from submission
submissionsRoutes.post("/:submissionId/purchase", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.AGGREGATOR, client_1.Role.ADMIN), ProductVerifyController_1.default.purchaseProduct);
// Clear submission
submissionsRoutes.put("/:submissionId/clear", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.AGGREGATOR, client_1.Role.ADMIN), ProductVerifyController_1.default.clearSubmission);
// Get specific submission by ID role-based (keep this last among GET routes)
submissionsRoutes.get("/:submissionId", authMiddleware_1.isAuthenticated, ProductVerifyController_1.default.getSubmissionById);
exports.default = submissionsRoutes;
