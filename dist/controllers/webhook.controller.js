"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentWebhook = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const emailTemplates_1 = require("../utils/emailTemplates");
const sms_utility_1 = require("../utils/sms.utility");
const handlePaymentWebhook = async (req, res) => {
    try {
        // Verify webhook signature
        const secretHash = process.env.FLW_SECRET_HASH;
        const signature = req.headers["verif-hash"];
        if (!signature || signature !== secretHash) {
            return res.status(401).json({ error: "Unauthorized webhook" });
        }
        const payload = req.body;
        console.log("Flutterwave Webhook received:", JSON.stringify(payload, null, 2));
        // Handle different event types
        const eventType = payload["event.type"] || payload.event;
        switch (eventType) {
            case "MOBILEMONEYRW_TRANSACTION":
            case "CARD_TRANSACTION":
            case "charge.completed":
                await handleChargeCompleted(payload);
                break;
            case "transfer.completed":
                await handleTransferCompleted(payload);
                break;
            default:
                console.log(`Unhandled webhook event: ${eventType}`);
        }
        res.status(200).json({ message: "Webhook processed successfully" });
    }
    catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
exports.handlePaymentWebhook = handlePaymentWebhook;
const handleChargeCompleted = async (data) => {
    try {
        console.log("Processing charge.completed webhook:", data);
        // Extract transaction reference - FIX: Use 'txRef' instead of 'tx_ref'
        const txRef = data.txRef || data.tx_ref;
        const flwRef = data.flwRef || data.flw_ref;
        const status = data.status;
        const currency = data.currency;
        const appFee = data.appfee;
        const merchantFee = data.merchantfee;
        console.log(`Processing transaction: txRef=${txRef}, flwRef=${flwRef}, status=${status}`);
        const eventType = data["event.type"] || data.event;
        // Check if this is a wallet top-up transaction
        if (txRef && (txRef.includes("WALLET_TOPUP_") || txRef.startsWith("175"))) {
            console.log("Detected wallet top-up transaction");
            // Find the corresponding wallet transaction
            const walletTransaction = await prisma_1.default.walletTransaction.findFirst({
                where: {
                    OR: [
                        { flwTxRef: txRef },
                        { flwRef: txRef },
                        { id: txRef },
                        // Also check if txRef contains the wallet transaction ID
                        { flwTxRef: { contains: txRef.split("_").pop() || "" } },
                    ],
                },
                include: {
                    wallet: {
                        include: { restaurant: true },
                    },
                },
            });
            if (walletTransaction) {
                console.log("Found matching wallet transaction:", walletTransaction.id);
                if (status === "successful" &&
                    walletTransaction.status !== "COMPLETED") {
                    const newBalance = walletTransaction.wallet.balance + walletTransaction.amount;
                    // Update wallet balance and transaction
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
                                externalTxId: data.id?.toString(),
                                flwRef: flwRef,
                                updatedAt: new Date(),
                            },
                        }),
                    ]);
                    // Send notification email
                    try {
                        await (0, emailTemplates_1.sendWalletNotificationEmail)({
                            email: walletTransaction.wallet.restaurant.email,
                            restaurantName: walletTransaction.wallet.restaurant.name,
                            type: "TOP_UP",
                            amount: walletTransaction.amount,
                            newBalance,
                            transactionId: flwRef || walletTransaction.id,
                            paymentMethod: walletTransaction.paymentMethod || "MOBILE_MONEY",
                        });
                    }
                    catch (emailError) {
                        console.log("Failed to send wallet notification email:", emailError);
                    }
                    console.log(`Wallet top-up completed: ${walletTransaction.amount} ${currency} for wallet ${walletTransaction.walletId}`);
                }
                else if (status === "failed") {
                    // Update transaction as failed
                    await prisma_1.default.walletTransaction.update({
                        where: { id: walletTransaction.id },
                        data: {
                            status: "FAILED",
                            flwStatus: "failed",
                            flwMessage: "Payment failed via webhook",
                            externalTxId: data.id?.toString(),
                            flwRef: flwRef,
                            updatedAt: new Date(),
                        },
                    });
                    console.log(`Wallet top-up failed: ${walletTransaction.id}`);
                }
                else {
                    console.log(`Transaction already processed or status unchanged: ${walletTransaction.status}`);
                }
            }
            else {
                console.log("No matching wallet transaction found for txRef:", txRef);
                // Additional logging for debugging
                console.log("Available wallet transactions with similar refs:");
                const similarTransactions = await prisma_1.default.walletTransaction.findMany({
                    where: {
                        OR: [
                            { flwTxRef: { contains: txRef.substring(0, 10) } },
                            { status: "PENDING" },
                        ],
                    },
                    select: { id: true, flwTxRef: true, status: true, amount: true },
                    take: 5,
                });
                console.log(similarTransactions);
            }
        }
        // Check if this is a regular checkout payment
        const checkout = await prisma_1.default.cHECKOUT.findFirst({
            where: {
                OR: [{ txRef: txRef }, { paymentReference: txRef }],
            },
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
        if (checkout) {
            console.log("Found matching checkout:", checkout.id);
            if (status === "successful" && checkout.paymentStatus !== "COMPLETED") {
                await prisma_1.default.cHECKOUT.update({
                    where: { id: checkout.id },
                    data: {
                        paymentStatus: "COMPLETED",
                        flwStatus: "successful",
                        flwMessage: "Payment completed via webhook",
                        transactionId: data.id?.toString(),
                        flwRef: flwRef,
                        appFee: appFee,
                        merchantFee: merchantFee,
                        paidAt: new Date(),
                        updatedAt: new Date(),
                    },
                });
                await prisma_1.default.order.update({
                    where: { id: checkout.order?.id },
                    data: {
                        paymentStatus: "COMPLETED",
                        paymentReference: data.id?.toString(),
                        status: "CONFIRMED",
                    },
                });
                if (eventType === "MOBILEMONEYRW_TRANSACTION" ||
                    checkout.paymentMethod === "MOBILE_MONEY") {
                    await (0, sms_utility_1.sendMessage)(`Payment completed: ${checkout.chargedAmount || checkout.totalAmount} ${currency} for order ${checkout.orderId}. Thank you!`, checkout.billingPhone || "");
                }
                else {
                    await (0, emailTemplates_1.sendPaymentConfirmationEmail)({
                        amount: checkout.chargedAmount || checkout.totalAmount,
                        transactionId: data.id?.toString(),
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
                        flwMessage: "Payment failed via webhook",
                        transactionId: data.id?.toString(),
                        flwRef: flwRef,
                        updatedAt: new Date(),
                    },
                });
                console.log(`Checkout payment failed: ${checkout.id}`);
            }
        }
        else if (!txRef.includes("WALLET_TOPUP_") && !txRef.startsWith("175")) {
            console.log("No matching checkout found for txRef:", txRef);
        }
    }
    catch (error) {
        console.error("Error processing charge.completed webhook:", error);
        throw error;
    }
};
const handleTransferCompleted = async (data) => {
    // Handle transfer completion if needed
    console.log("Transfer completed:", data);
};
