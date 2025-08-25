"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const farmer_controller_1 = __importDefault(require("../controllers/farmer.controller"));
const farmersRoutes = (0, express_1.Router)();
// Get pending feedback submissions (farmers only)
farmersRoutes.get("/pending-feedback", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.FARMER), farmer_controller_1.default.getPendingFeedbackSubmissions);
// Get farmer's feedback history (farmers only)
farmersRoutes.get("/feedback-history", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.FARMER), farmer_controller_1.default.getFarmerFeedbackHistory);
// Submit farmer feedback on a specific submission
farmersRoutes.post("/:submissionId/feedback", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.FARMER), farmer_controller_1.default.submitFarmerFeedback);
// Update farmer feedback (before deadline)
farmersRoutes.patch("/:submissionId/feedback", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.FARMER), farmer_controller_1.default.updateFarmerFeedback);
farmersRoutes.post("/", userController_1.UserController.createFarmer);
farmersRoutes.get("/", userController_1.UserController.getAllFarmers);
farmersRoutes.get("/:id", userController_1.UserController.getFarmerById);
farmersRoutes.put("/:id", userController_1.UserController.updateFarmer);
farmersRoutes.delete("/:id", userController_1.UserController.deleteFarmer);
exports.default = farmersRoutes;
