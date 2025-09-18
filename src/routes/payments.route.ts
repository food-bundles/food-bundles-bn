import express from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller";

const paymentsRoutes = express.Router();

// Payment webhook endpoint
paymentsRoutes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handlePaymentWebhook
);

export default paymentsRoutes;
