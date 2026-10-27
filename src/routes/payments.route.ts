import express from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller";
import { handleIntouchWebhook } from "../controllers/webhooks/intouch.webhook";
import { handleUrubutopayWebhook } from "../controllers/webhooks/urubutopay.webhook";
import {
  handlePesapalIPNGet,
  handlePesapalIPNPost,
} from "../controllers/webhooks/pesapal.webhook";
import { handleMtnMomoWebhook } from "../controllers/webhooks/mtn-momo.webhook";

const paymentsRoutes = express.Router();

// Payment webhook endpoint
paymentsRoutes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handlePaymentWebhook,
);

// InTouch Payment webhook endpoint
paymentsRoutes.post(
  "/intouch",
  express.raw({ type: "application/json" }),
  handleIntouchWebhook,
);

// MTN MoMo Payment webhook endpoint
paymentsRoutes.post(
  "/mtn-momo",
  express.raw({ type: "application/json" }),
  handleMtnMomoWebhook,
);

// PesaPal Payment webhook endpoint
paymentsRoutes.get(
  "/pesapal",
  express.raw({ type: "application/json" }),
  handlePesapalIPNGet,
);

// PesaPal Payment webhook endpoint
paymentsRoutes.post(
  "/pesapal",
  express.raw({ type: "application/json" }),
  handlePesapalIPNPost,
);

// UrubutoPay Payment webhook endpoint
paymentsRoutes.post(
  "/urubutopay",
  express.raw({ type: "application/json" }),
  handleUrubutopayWebhook,
);

export default paymentsRoutes;
