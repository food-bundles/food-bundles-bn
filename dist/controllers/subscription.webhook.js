"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSubscriptionWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../prisma"));
const sms_utility_1 = require("../utils/sms.utility");
const db_retry_utls_1 = require("../utils/db-retry.utls");
const index_1 = require("../index");
/**
 * Process subscription payment webhook
 */
async function processSubscriptionPayment(txRef, flwRef, status, paymentProvider = "FLUTTERWAVE", data) {
    console.log("Processing subscription payment for reference:", txRef);
    const subscription = await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
        return await prisma_1.default.restaurantSubscription.findFirst({
            where: {
                OR: [{ txRef: txRef }, { flwRef: txRef }],
            },
            include: {
                restaurant: true,
                plan: true,
            },
        });
    });
    if (!subscription) {
        console.log("No matching subscription found for txRef:", txRef);
        return null;
    }
    console.log("Found matching subscription:", subscription.id);
    if (status === "successful" && subscription.paymentStatus !== "COMPLETED") {
        const updateData = {
            paymentStatus: "COMPLETED",
            status: "ACTIVE",
            flwStatus: "successful",
            transactionId: data?.id?.toString() || flwRef,
            flwRef: flwRef,
            amountPaid: subscription.plan.price,
            updatedAt: new Date(),
        };
        if (paymentProvider === "FLUTTERWAVE") {
            updateData.appFee = data?.appfee || data?.data?.fee;
            updateData.merchantFee = data?.merchantfee || data?.data?.merchantfee;
        }
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.$transaction([
                prisma_1.default.restaurantSubscription.update({
                    where: { id: subscription.id },
                    data: updateData,
                }),
                prisma_1.default.subscriptionHistory.create({
                    data: {
                        subscriptionId: subscription.id,
                        action: "CREATED",
                        newStatus: "ACTIVE",
                        newPlanId: subscription.planId,
                    },
                }),
            ]);
        });
        // Send notification
        try {
            await (0, sms_utility_1.sendMessage)(`Dear ${subscription.restaurant.name}, Your subscription to ${subscription.plan.name} has been activated. Thank you!`, subscription.restaurant.phone || "");
        }
        catch (error) {
            console.error("Failed to send subscription notification:", error);
        }
        console.log(`Subscription payment completed: ${subscription.id}`);
    }
    else if (status === "failed") {
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.$transaction([
                prisma_1.default.restaurantSubscription.update({
                    where: { id: subscription.id },
                    data: {
                        paymentStatus: "FAILED",
                        transactionId: data?.id?.toString() || flwRef,
                        flwRef: flwRef,
                        updatedAt: new Date(),
                    },
                }),
                prisma_1.default.subscriptionHistory.create({
                    data: {
                        subscriptionId: subscription.id,
                        action: "CREATED",
                        newStatus: "PENDING",
                        reason: "Payment failed",
                    },
                }),
            ]);
        });
        try {
            await (0, sms_utility_1.sendMessage)(`Dear ${subscription.restaurant.name}, Your subscription payment failed. Please try again.`, subscription.restaurant.phone || "");
        }
        catch (error) {
            console.error("Failed to send subscription failure notification:", error);
        }
        // Broadcast subscription update via WebSocket
        try {
            index_1.wsManager.broadcastSubscriptionUpdate({
                subscriptionId: subscription.id,
                status: "PENDING",
                paymentStatus: "FAILED",
                timestamp: new Date().toISOString(),
                restaurantId: subscription.restaurantId,
            });
        }
        catch (error) {
            console.error("Failed to broadcast subscription update:", error);
        }
        console.log(`Subscription payment failed: ${subscription.id}`);
    }
    return subscription;
}
/**
 * Subscription payment webhook handler
 * POST /subscriptions/webhook
 */
const handleSubscriptionWebhook = async (req, res) => {
    try {
        const payload = req.body;
        const paymentProvider = detectPaymentProvider(payload);
        console.log(`${paymentProvider} Subscription Webhook received:`, JSON.stringify(payload, null, 2));
        if (paymentProvider === "FLUTTERWAVE") {
            const secretHash = process.env.FLW_SECRET_HASH;
            const signature = req.headers["verif-hash"];
            if (!signature || signature !== secretHash) {
                return res.status(401).json({ error: "Unauthorized webhook" });
            }
            const txRef = payload.tx_ref ||
                payload.txRef ||
                payload.data?.tx_ref ||
                payload.data?.txRef;
            const flwRef = payload.flw_ref ||
                payload.flwRef ||
                payload.data?.flw_ref ||
                payload.data?.flwRef;
            const status = payload.status || payload.data?.status;
            if (!txRef) {
                console.error("No transaction reference found in webhook");
                return res.status(400).json({ error: "No transaction reference" });
            }
            // Check if this is a subscription payment (contains SUB_ prefix)
            if (txRef.includes("SUB_")) {
                await processSubscriptionPayment(txRef, flwRef, status, "FLUTTERWAVE", payload);
            }
        }
        else if (paymentProvider === "PAYPACK") {
            const paypackSignature = req.headers["x-paypack-signature"];
            const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;
            if (!paypackSecret) {
                return res.status(500).json({ error: "Webhook configuration error" });
            }
            if (!paypackSignature) {
                return res.status(401).json({ error: "Missing signature header" });
            }
            let rawBody;
            if (req.rawBody) {
                rawBody = req.rawBody;
            }
            else {
                rawBody = JSON.stringify(payload);
            }
            const expectedSignature = crypto_1.default
                .createHmac("sha256", paypackSecret)
                .update(rawBody)
                .digest("base64");
            if (paypackSignature !== expectedSignature) {
                return res.status(401).json({ error: "Invalid webhook signature" });
            }
            const paymentStatus = payload?.data?.status;
            const txRef = payload.data?.ref;
            const flwRef = payload.data?.ref;
            if (!txRef) {
                console.error("No transaction reference found in PayPack webhook");
                return res.status(400).json({ error: "No transaction reference" });
            }
            // Check if this is a subscription payment
            if (txRef.includes("SUB_")) {
                await processSubscriptionPayment(txRef, flwRef, paymentStatus, "PAYPACK", payload);
            }
        }
        res
            .status(200)
            .json({ message: "Subscription webhook processed successfully" });
    }
    catch (error) {
        console.error("Subscription webhook processing error:", error);
        if (error.message?.includes("timeout") || error.code === "P1017") {
            return res.status(503).json({
                error: "Service temporarily unavailable",
                message: "Database connection issue, webhook will be retried",
            });
        }
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
exports.handleSubscriptionWebhook = handleSubscriptionWebhook;
function detectPaymentProvider(body) {
    if (body?.data?.status !== undefined && body?.data?.ref !== undefined) {
        return "PAYPACK";
    }
    if (body?.txRef !== undefined ||
        body?.tx_ref !== undefined ||
        body?.["event.type"] !== undefined ||
        body?.event !== undefined) {
        return "FLUTTERWAVE";
    }
    return "FLUTTERWAVE";
}
