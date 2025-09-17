"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ProductVerifyController_1 = __importDefault(require("../controllers/ProductVerifyController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const client_1 = require("@prisma/client");
const ProductverifyRoutes = (0, express_1.Router)();
ProductverifyRoutes.put("/product/:submissionId/update", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)(client_1.Role.AGGREGATOR, client_1.Role.ADMIN), ProductVerifyController_1.default.updateSubmission);
exports.default = ProductverifyRoutes;
