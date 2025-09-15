"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const farmer_controller_1 = __importStar(require("../controllers/farmer.controller"));
const farmersRoutes = (0, express_1.Router)();
farmersRoutes.post("/submit-product/:productId", authMiddleware_1.isAuthenticated, farmer_controller_1.submitProductController);
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
