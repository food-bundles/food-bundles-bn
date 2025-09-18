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
// Shared function to process wallet transactions
async function processWalletTransaction(txRef, flwRef, status, currency) {
    console.log("Processing wallet transaction for reference:", txRef);
    const walletTransaction = await prisma_1.default.walletTransaction.findFirst({
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
    if (!walletTransaction) {
        console.log("No matching wallet transaction found for txRef:", txRef);
        return null;
    }
    console.log("Found matching wallet transaction:", walletTransaction.id);
    if (status === "successful" && walletTransaction.status !== "COMPLETED") {
        const newBalance = walletTransaction.wallet.balance + walletTransaction.amount;
        await prisma_1.default.$transaction([
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
        await prisma_1.default.walletTransaction.update({
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
        console.log(`Wallet top-up failed: ${walletTransaction.id}`);
    }
    else {
        console.log(`Transaction already processed or status unchanged: ${walletTransaction.status}`);
    }
    return walletTransaction;
}
// Shared function to process checkout payments
async function processCheckoutPayment(txRef, flwRef, status, paymentProvider = "FLUTTERWAVE", eventType, data) {
    console.log("Processing checkout payment for reference:", txRef);
    const whereClause = paymentProvider === "PAYPACK"
        ? { paymentReference: txRef, paymentProvider: "PAYPACK" }
        : { OR: [{ txRef: txRef }, { paymentReference: txRef }] };
    const checkout = await prisma_1.default.cHECKOUT.findFirst({
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
        await prisma_1.default.cHECKOUT.update({
            where: { id: checkout.id },
            data: updateData,
        });
        // Send appropriate notification based on payment method
        if (paymentProvider === "PAYPACK" ||
            checkout.paymentMethod === "MOBILE_MONEY") {
            await (0, sms_utility_1.sendMessage)(`Payment completed: ${checkout.chargedAmount || checkout.totalAmount} ${checkout.currency}. Thank you!`, checkout.billingPhone || "");
        }
        else {
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
                    name: checkout.billingName || "",
                    email: checkout.billingEmail || "",
                },
                checkoutId: checkout.id,
            });
        }
        console.log(`Checkout payment completed: ${checkout.id}`);
    }
    else if (status === "failed") {
        await prisma_1.default.cHECKOUT.update({
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
        console.log(`Checkout payment failed: ${checkout.id}`);
    }
    // Create order from checkout
    await (0, order_services_1.createOrderFromCheckoutService)({
        checkoutId: checkout.id,
        restaurantId: checkout.restaurantId,
        status: status === "successful" ? "CONFIRMED" : "CANCELLED",
    });
    // Clear the cart by setting its status to COMPLETED
    await (0, cart_service_1.clearCartService)(checkout.restaurantId);
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
                console.error("Unauthorized Flutterwave webhook attempt");
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
                console.error("PayPack webhook secret not configured");
                return res.status(500).json({ error: "Webhook configuration error" });
            }
            if (!paypackSignature) {
                console.error("Missing PayPack signature header");
                return res.status(401).json({ error: "Missing signature header" });
            }
            const expectedSignature = crypto_1.default
                .createHmac("sha256", paypackSecret)
                .update(payload)
                .digest("base64");
            if (paypackSignature !== expectedSignature) {
                console.error("Invalid PayPack webhook signature");
                return res.status(401).json({ error: "Invalid webhook signature" });
            }
            console.log("PayPack Webhook received:", JSON.stringify(payload, null, 2));
            const paymentStatus = payload?.data?.status;
            const txRef = payload.data?.ref;
            const flwRef = payload.data?.ref;
            if (!txRef) {
                console.error("No transaction reference found in PayPack webhook");
                return res
                    .status(400)
                    .json({ error: "No transaction reference provided" });
            }
            console.log("PayPack Transaction reference:", txRef);
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
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
exports.handlePaymentWebhook = handlePaymentWebhook;
