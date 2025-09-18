import express from "express";
import {
  handlePaymentWebhook,
  handlePayPackWebhook,
} from "../controllers/webhook.controller";

const paymentsRoutes = express.Router();

// Payment webhook endpoint
paymentsRoutes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handlePaymentWebhook
);

paymentsRoutes.post("/paypack", handlePayPackWebhook);

export default paymentsRoutes;
