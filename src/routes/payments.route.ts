import express from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller";
import { handleIntouchWebhook } from "../controllers/webhooks/intouch.webhook";
import { handleUrubutopayWebhook } from "../controllers/webhooks/urubutopay.webhook";
import {
  handlePesapalIPNGet,
  handlePesapalIPNPost,
} from "../controllers/webhooks/pesapal.webhook";
import { handleMtnMomoWebhook } from "../controllers/webhooks/mtn-momo.webhook";
import {
  requestIntouchPayment,
  requestIntouchDeposit,
  getIntouchBalance,
  getIntouchTransactionStatus,
} from "../controllers/payment/intouch.controller";
import {
  requestMtnPayment,
  getMtnPaymentStatus,
  getMtnBalance,
} from "../controllers/payment/mtn-momo.controller";
import {
  submitPesapalOrder,
  getPesapalTransactionStatus,
  refundPesapalPayment,
  cancelPesapalOrder,
  registerPesapalIPN,
  getPesapalIPNList,
} from "../controllers/payment/pesapal.controller";
import {
  initiateUrubutopayPayment,
  getUrubutopayTransactionStatus,
  validateUrubutopayWallet,
  getUrubutopayKYC,
  createUrubutopayInvoice,
  getUrubutopayInvoiceStatus,
  getUrubutopayWalletBalance,
  initiateUrubutopayDisbursement,
} from "../controllers/payment/urubutopay.controller";

const paymentsRoutes = express.Router();

// ─── Generic webhook ──────────────────────────────────────────────────────────
paymentsRoutes.post("/webhook", express.raw({ type: "application/json" }), handlePaymentWebhook);

// ─── InTouch ──────────────────────────────────────────────────────────────────
paymentsRoutes.post("/intouch", handleIntouchWebhook);
paymentsRoutes.post("/intouch/request", requestIntouchPayment);
paymentsRoutes.post("/intouch/deposit", requestIntouchDeposit);
paymentsRoutes.get("/intouch/balance", getIntouchBalance);
paymentsRoutes.post("/intouch/status", getIntouchTransactionStatus);

// ─── MTN MoMo ─────────────────────────────────────────────────────────────────
paymentsRoutes.post("/mtn-momo", express.raw({ type: "application/json" }), handleMtnMomoWebhook);
paymentsRoutes.post("/mtn-momo/request", requestMtnPayment);
paymentsRoutes.get("/mtn-momo/status/:referenceId", getMtnPaymentStatus);
paymentsRoutes.get("/mtn-momo/balance", getMtnBalance);

// ─── PesaPal ──────────────────────────────────────────────────────────────────
paymentsRoutes.get("/pesapal", express.raw({ type: "application/json" }), handlePesapalIPNGet);
paymentsRoutes.post("/pesapal", express.raw({ type: "application/json" }), handlePesapalIPNPost);
paymentsRoutes.post("/pesapal/order", submitPesapalOrder);
paymentsRoutes.get("/pesapal/status/:orderTrackingId", getPesapalTransactionStatus);
paymentsRoutes.post("/pesapal/refund", refundPesapalPayment);
paymentsRoutes.post("/pesapal/cancel", cancelPesapalOrder);
paymentsRoutes.post("/pesapal/ipn/register", registerPesapalIPN);
paymentsRoutes.get("/pesapal/ipn/list", getPesapalIPNList);

// ─── UrubutoPay ───────────────────────────────────────────────────────────────
paymentsRoutes.post("/urubutopay", express.raw({ type: "application/json" }), handleUrubutopayWebhook);
paymentsRoutes.post("/urubutopay/request", initiateUrubutopayPayment);
paymentsRoutes.get("/urubutopay/status/:transaction_id", getUrubutopayTransactionStatus);
paymentsRoutes.post("/urubutopay/validate", validateUrubutopayWallet);
paymentsRoutes.post("/urubutopay/kyc", getUrubutopayKYC);
paymentsRoutes.post("/urubutopay/invoice", createUrubutopayInvoice);
paymentsRoutes.get("/urubutopay/invoice/:invoice_number", getUrubutopayInvoiceStatus);
paymentsRoutes.get("/urubutopay/balance", getUrubutopayWalletBalance);
paymentsRoutes.post("/urubutopay/disburse", initiateUrubutopayDisbursement);

export default paymentsRoutes;
