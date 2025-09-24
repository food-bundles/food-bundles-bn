"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../prisma"));
const emailTemplates_1 = require("../utils/emailTemplates");
const sms_utility_1 = require("../utils/sms.utility");
const order_services_1 = require("../services/order.services");
const cart_service_1 = require("../services/cart.service");
const db_retry_utls_1 = require("../utils/db-retry.utls");
// Shared function to process wallet transactions with retry logic
async function processWalletTransaction(txRef, flwRef, status, currency) {
    console.log("Processing wallet transaction for reference:", txRef);
    const walletTransaction = await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
        return await prisma_1.default.walletTransaction.findFirst({
            where: {
                OR: [
                    { flwTxRef: txRef },
                    { flwRef: txRef },
                    { id: txRef },
                    { flwTxRef: { contains: txRef.split("_").pop() || "" } },
                ],
            },
            include: {
                wallet: {
                    include: { restaurant: true },
                },
            },
        });
    });
    if (!walletTransaction) {
        console.log("No matching wallet transaction found for txRef:", txRef);
        return null;
    }
    console.log("Found matching wallet transaction:", walletTransaction.id);
    if (status === "successful" && walletTransaction.status !== "COMPLETED") {
        const newBalance = walletTransaction.wallet.balance + walletTransaction.amount;
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.$transaction([
                prisma_1.default.wallet.update({
                    where: { id: walletTransaction.walletId },
                    data: {
                        balance: newBalance,
                        updatedAt: new Date(),
                    },
                }),
                prisma_1.default.walletTransaction.update({
                    where: { id: walletTransaction.id },
                    data: {
                        status: "COMPLETED",
                        newBalance,
                        flwStatus: "successful",
                        flwMessage: "Payment completed via webhook",
                        externalTxId: flwRef,
                        flwRef: flwRef,
                        updatedAt: new Date(),
                    },
                }),
            ]);
        });
        // Send notification
        try {
            await (0, sms_utility_1.sendMessage)(`Payment completed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet Top-up. Thank you!`, walletTransaction.wallet.restaurant.phone || "");
        }
        catch (error) {
            console.error("Failed to send wallet notification:", error);
        }
        console.log(`Wallet top-up completed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet ${walletTransaction.walletId}`);
    }
    else if (status === "failed") {
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.walletTransaction.update({
                where: { id: walletTransaction.id },
                data: {
                    status: "FAILED",
                    flwStatus: "failed",
                    flwMessage: "Payment failed via webhook",
                    externalTxId: flwRef,
                    flwRef: flwRef,
                    updatedAt: new Date(),
                },
            });
        });
        try {
            await (0, sms_utility_1.sendMessage)(`Payment failed: ${walletTransaction.amount} ${walletTransaction.wallet.currency} for wallet Top-up. Thank you!`, walletTransaction.wallet.restaurant.phone || "");
        }
        catch (error) {
            console.error("Failed to send wallet failure notification:", error);
        }
        console.log(`Wallet top-up failed: ${walletTransaction.id}`);
    }
    else {
        console.log(`Transaction already processed or status unchanged: ${walletTransaction.status}`);
    }
    return walletTransaction;
}
// Shared function to process checkout payments with retry logic
async function processCheckoutPayment(txRef, flwRef, status, paymentProvider = "FLUTTERWAVE", eventType, data) {
    const whereClause = paymentProvider === "PAYPACK"
        ? { paymentReference: txRef, paymentProvider: "PAYPACK" }
        : { OR: [{ txRef: txRef }, { paymentReference: txRef }] };
    const checkout = await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
        return await prisma_1.default.cHECKOUT.findFirst({
            where: whereClause,
            include: {
                restaurant: true,
                cart: {
                    include: {
                        cartItems: {
                            include: { product: true },
                        },
                    },
                },
                order: true,
            },
        });
    });
    if (!checkout) {
        console.log("No matching checkout found for txRef:", txRef);
        return null;
    }
    console.log("Found matching checkout:", checkout.id);
    if (status === "successful" && checkout.paymentStatus !== "COMPLETED") {
        const updateData = {
            paymentStatus: "COMPLETED",
            flwStatus: "successful",
            flwMessage: `Payment completed via ${paymentProvider.toLowerCase()} webhook`,
            transactionId: data?.id?.toString() || flwRef,
            flwRef: flwRef,
            paidAt: new Date(),
            updatedAt: new Date(),
        };
        if (paymentProvider === "FLUTTERWAVE") {
            updateData.appFee = data?.appfee;
            updateData.merchantFee = data?.merchantfee;
        }
        else if (paymentProvider === "PAYPACK") {
            updateData.appFee = data?.data?.fee;
        }
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.cHECKOUT.update({
                where: { id: checkout.id },
                data: updateData,
            });
        });
        // Create order if it doesn't exist
        if (!checkout.order && !checkout.orderId) {
            try {
                const order = await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
                    return await (0, order_services_1.createOrderFromCheckoutService)({
                        checkoutId: checkout.id,
                        restaurantId: checkout.restaurantId,
                        status: "CONFIRMED",
                    });
                });
                console.log(`Order created from checkout: ${order.id}`);
            }
            catch (orderError) {
                console.error("Failed to create order from checkout:", orderError);
            }
        }
        // Update existing order if it exists
        if (checkout.order || checkout.orderId) {
            try {
                await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
                    return await prisma_1.default.order.update({
                        where: { id: checkout.orderId || checkout.order?.id },
                        data: {
                            paymentStatus: "COMPLETED",
                            status: "CONFIRMED",
                            updatedAt: new Date(),
                        },
                    });
                });
            }
            catch (orderUpdateError) {
                console.error("Failed to update order status:", orderUpdateError);
            }
        }
        // Clear cart if checkout is completed
        if (checkout.cart.cartItems.length > 0) {
            try {
                await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
                    return await (0, cart_service_1.clearCartService)(checkout.cartId);
                });
            }
            catch (clearCartError) {
                console.error("Failed to clear cart:", clearCartError);
            }
        }
        // Send notifications (these are not critical, so we don't retry them)
        try {
            await (0, sms_utility_1.sendMessage)(`Payment completed: ${checkout.chargedAmount || checkout.totalAmount} ${checkout.currency}. Thank you!`, checkout.billingPhone || checkout.restaurant.phone || "");
        }
        catch (smsError) {
            console.error("Failed to send SMS notification:", smsError);
        }
        try {
            await (0, emailTemplates_1.sendPaymentConfirmationEmail)({
                amount: checkout.chargedAmount || checkout.totalAmount,
                transactionId: data?.id?.toString() || flwRef,
                restaurantName: checkout.restaurant.name,
                products: checkout.cart.cartItems.map((item) => ({
                    name: item.product.productName,
                    quantity: item.quantity,
                    price: item.product.unitPrice,
                })),
                customer: {
                    name: checkout.billingName || checkout.restaurant.name || "",
                    email: checkout.billingEmail || checkout.restaurant.email || "",
                },
                checkoutId: checkout.id,
            });
        }
        catch (emailError) {
            console.error("Failed to send confirmation email:", emailError);
        }
        console.log(`Checkout payment completed: ${checkout.id}`);
    }
    else if (status === "failed") {
        await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
            return await prisma_1.default.cHECKOUT.update({
                where: { id: checkout.id },
                data: {
                    paymentStatus: "FAILED",
                    flwStatus: "failed",
                    flwMessage: `Payment failed via ${paymentProvider.toLowerCase()} webhook`,
                    transactionId: data?.id?.toString() || flwRef,
                    flwRef: flwRef,
                    updatedAt: new Date(),
                },
            });
        });
        // Update order status to failed/cancelled
        if (checkout.order || checkout.orderId) {
            try {
                await (0, db_retry_utls_1.retryDatabaseOperation)(async () => {
                    return await prisma_1.default.order.update({
                        where: { id: checkout.orderId || checkout.order?.id },
                        data: {
                            paymentStatus: "FAILED",
                            status: "CANCELLED",
                            updatedAt: new Date(),
                        },
                    });
                });
            }
            catch (orderUpdateError) {
                console.error("Failed to update failed order status:", orderUpdateError);
            }
        }
        try {
            await (0, sms_utility_1.sendMessage)(`Payment failed: ${checkout.chargedAmount || checkout.totalAmount} ${checkout.currency}. Please try again.`, checkout.billingPhone || checkout.restaurant.phone || "");
        }
        catch (smsError) {
            console.error("Failed to send failure SMS notification:", smsError);
        }
        try {
            await (0, emailTemplates_1.sendPaymentFailedEmail)({
                amount: checkout.chargedAmount || checkout.totalAmount,
                transactionId: data?.id?.toString() || flwRef,
                restaurantName: checkout.restaurant.name,
                products: checkout.cart.cartItems.map((item) => ({
                    name: item.product.productName,
                    quantity: item.quantity,
                    price: item.product.unitPrice,
                })),
                customer: {
                    name: checkout.billingName || checkout.restaurant.name || "",
                    email: checkout.billingEmail || checkout.restaurant.email || "",
                },
                checkoutId: checkout.id,
            });
        }
        catch (emailError) {
            console.error("Failed to send payment failed email:", emailError);
        }
        console.log(`Checkout payment failed: ${checkout.id}`);
    }
    return checkout;
}
// Helper function to detect payment provider based on request body structure
function detectPaymentProvider(body) {
    // PayPack has nested structure with info?.data?.status and info.data?.ref
    if (body?.data?.status !== undefined && body?.data?.ref !== undefined) {
        return "PAYPACK";
    }
    // Flutterwave has flat structure with data.txRef, data["event.type"] and data.status
    if (body?.txRef !== undefined ||
        body?.tx_ref !== undefined ||
        body?.["event.type"] !== undefined ||
        body?.event !== undefined) {
        return "FLUTTERWAVE";
    }
    // Default to Flutterwave if structure is unclear
    return "FLUTTERWAVE";
}
const handleChargeCompleted = async (data) => {
    try {
        console.log("Processing Flutterwave charge.completed webhook:", data);
        const txRef = data.txRef || data.tx_ref;
        const flwRef = data.flwRef || data.flw_ref;
        const status = data.status;
        const eventType = data["event.type"] || data.event;
        if (!txRef) {
            console.error("No transaction reference found in Flutterwave webhook");
            return;
        }
        console.log(`Processing transaction: txRef=${txRef}, flwRef=${flwRef}, status=${status}`);
        // Check if this is a wallet top-up transaction
        if (txRef && (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))) {
            await processWalletTransaction(txRef, flwRef, status, data.currency);
        }
        else {
            // Process as regular checkout payment
            await processCheckoutPayment(txRef, flwRef, status, "FLUTTERWAVE", eventType, data);
        }
    }
    catch (error) {
        console.error("Error processing charge.completed webhook:", error);
        throw error;
    }
};
const handlePaymentWebhook = async (req, res) => {
    try {
        const payload = req.body;
        const paymentProvider = detectPaymentProvider(payload);
        console.log(`${paymentProvider} Webhook received:`, JSON.stringify(payload, null, 2));
        // Handle Flutterwave webhook
        if (paymentProvider === "FLUTTERWAVE") {
            // Verify webhook signature
            const secretHash = process.env.FLW_SECRET_HASH;
            const signature = req.headers["verif-hash"];
            if (!signature || signature !== secretHash) {
                return res.status(401).json({ error: "Unauthorized webhook" });
            }
            await handleChargeCompleted(payload);
        }
        // Handle PayPack webhook
        else if (paymentProvider === "PAYPACK") {
            // Verify PayPack webhook signature
            const paypackSignature = req.headers["x-paypack-signature"];
            const paypackSecret = process.env.PAYPACK_WEBHOOK_SECRET;
            if (!paypackSecret) {
                return res.status(500).json({ error: "Webhook configuration error" });
            }
            if (!paypackSignature) {
                return res.status(401).json({ error: "Missing signature header" });
            }
            // Use raw body for signature verification
            let rawBody;
            // Check if we have access to raw body
            if (req.rawBody) {
                rawBody = req.rawBody;
            }
            // If raw body not available, convert payload back to string
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
                return res
                    .status(400)
                    .json({ error: "No transaction reference provided" });
            }
            // Check if this is a wallet top-up transaction
            if (txRef &&
                (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))) {
                await processWalletTransaction(txRef, flwRef, paymentStatus);
            }
            else {
                // Process as regular checkout payment
                await processCheckoutPayment(txRef, flwRef, paymentStatus, "PAYPACK");
            }
        }
        res.status(200).json({ message: "Webhook processed successfully" });
    }
    catch (error) {
        console.error("Payment webhook processing error:", error);
        // Check if it's a database connection issue
        if (error.message?.includes("timeout") || error.code === "P1017") {
            return res.status(503).json({
                error: "Service temporarily unavailable",
                message: "Database connection issue, webhook will be retried",
            });
        }
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
exports.handlePaymentWebhook = handlePaymentWebhook;
