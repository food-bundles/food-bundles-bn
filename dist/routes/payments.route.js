"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhook_controller_1 = require("../controllers/webhook.controller");
const paymentsRoutes = express_1.default.Router();
// Payment webhook endpoint
paymentsRoutes.post("/webhook", express_1.default.raw({ type: "application/json" }), webhook_controller_1.handlePaymentWebhook);
paymentsRoutes.post("/paypack", webhook_controller_1.handlePayPackWebhook);
exports.default = paymentsRoutes;
