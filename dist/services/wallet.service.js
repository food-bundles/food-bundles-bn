"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWalletTopUpService = exports.getAllWalletsService = exports.updateWalletStatusService = exports.getWalletTransactionsService = exports.refundToWalletService = exports.debitWalletService = exports.topUpWalletService = exports.getWalletByIdService = exports.getWalletByRestaurantIdService = exports.createWalletService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("../prisma"));
const emailTemplates_1 = require("../utils/emailTemplates");
dotenv_1.default.config();
const Flutterwave = require("flutterwave-node-v3");
// Initialize Flutterwave
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
/**
 * Create a new wallet for restaurant
 */
const createWalletService = async (data) => {
    const { restaurantId, currency = "RWF" } = data;
    // Check if restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
        select: { id: true, name: true, email: true },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Check if wallet already exists
    const existingWallet = await prisma_1.default.wallet.findUnique({
        where: { restaurantId },
    });
    if (existingWallet) {
        throw new Error("Wallet already exists for this restaurant");
    }
    const wallet = await prisma_1.default.wallet.create({
        data: {
            restaurantId,
            currency,
            balance: 0,
        },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
    });
    return wallet;
};
exports.createWalletService = createWalletService;
/**
 * Get wallet by restaurant ID
 */
const getWalletByRestaurantIdService = async (restaurantId) => {
    const wallet = await prisma_1.default.wallet.findUnique({
        where: { restaurantId },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            _count: {
                select: {
                    transactions: true,
                },
            },
        },
    });
    if (!wallet) {
        throw new Error("Wallet not found");
    }
    return wallet;
};
exports.getWalletByRestaurantIdService = getWalletByRestaurantIdService;
/**
 * Get wallet by wallet ID
 */
const getWalletByIdService = async (walletId) => {
    const wallet = await prisma_1.default.wallet.findUnique({
        where: { id: walletId },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
    });
    if (!wallet) {
        throw new Error("Wallet not found");
    }
    return wallet;
};
exports.getWalletByIdService = getWalletByIdService;
/**
 * Top up wallet
 */
const topUpWalletService = async (data) => {
    const { walletId, amount, paymentMethod, phoneNumber, cardDetails, description, } = data;
    // Validate amount
    if (amount <= 0) {
        throw new Error("Top-up amount must be greater than 0");
    }
    // Get wallet details
    const wallet = await (0, exports.getWalletByIdService)(walletId);
    if (!wallet.isActive) {
        throw new Error("Wallet is inactive");
    }
    // Generate transaction reference
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000); // 4 random digits
    const txRef = `${timestamp}${random}`.slice(0, 15); // Ensure it's not too long
    // Create pending transaction record
    const pendingTransaction = await prisma_1.default.walletTransaction.create({
        data: {
            walletId,
            type: "TOP_UP",
            amount,
            previousBalance: wallet.balance,
            newBalance: wallet.balance, // Will be updated after payment
            description: description || `Wallet top-up via ${paymentMethod}`,
            flwTxRef: txRef,
            paymentMethod,
            status: "PENDING",
        },
    });
    try {
        let paymentResult;
        // Process payment based on method
        switch (paymentMethod.toUpperCase()) {
            case "MOBILE_MONEY":
                if (!phoneNumber) {
                    throw new Error("Phone number is required for mobile money");
                }
                const cleanedPhone = (0, emailTemplates_1.cleanPhoneNumber)(phoneNumber);
                if (!(0, emailTemplates_1.isValidRwandaPhone)(cleanedPhone)) {
                    throw new Error("Invalid Rwanda mobile number format");
                }
                paymentResult = await processMobileMoneyTopUp({
                    amount,
                    phoneNumber: cleanedPhone,
                    txRef,
                    orderId: pendingTransaction.id,
                    email: wallet.restaurant.email,
                    fullname: wallet.restaurant.name,
                    currency: wallet.currency,
                });
                break;
            case "CARD":
                if (!cardDetails) {
                    throw new Error("Card details are required for card payment");
                }
                paymentResult = await processCardTopUp({
                    amount,
                    txRef,
                    email: wallet.restaurant.email,
                    fullname: wallet.restaurant.name,
                    phoneNumber: wallet.restaurant.phone || "",
                    currency: wallet.currency,
                    cardDetails,
                });
                break;
            default:
                throw new Error(`Unsupported payment method: ${paymentMethod}`);
        }
        // Update transaction with payment result
        const updatedTransaction = await prisma_1.default.walletTransaction.update({
            where: { id: pendingTransaction.id },
            data: {
                flwRef: paymentResult.flwRef,
                flwStatus: paymentResult.status,
                flwMessage: paymentResult.message,
                externalTxId: paymentResult.transactionId,
                status: paymentResult.success
                    ? paymentResult.status === "successful"
                        ? "COMPLETED"
                        : "PROCESSING"
                    : "FAILED",
                metadata: {
                    paymentResponse: paymentResult,
                },
            },
        });
        // If payment is successful, update wallet balance
        if (paymentResult.success && paymentResult.status === "successful") {
            const newBalance = wallet.balance + amount;
            await prisma_1.default.$transaction([
                prisma_1.default.wallet.update({
                    where: { id: walletId },
                    data: {
                        balance: newBalance,
                        updatedAt: new Date(),
                    },
                }),
                prisma_1.default.walletTransaction.update({
                    where: { id: pendingTransaction.id },
                    data: {
                        newBalance,
                        status: "COMPLETED",
                    },
                }),
            ]);
            // Send notification email
            if (wallet.restaurant.email) {
                try {
                    await (0, emailTemplates_1.sendWalletNotificationEmail)({
                        email: wallet.restaurant.email,
                        restaurantName: wallet.restaurant.name,
                        type: "TOP_UP",
                        amount,
                        newBalance,
                        transactionId: txRef,
                        paymentMethod,
                    });
                }
                catch (emailError) {
                    console.log("Failed to send wallet notification email:", emailError);
                }
            }
        }
        return {
            success: paymentResult.success,
            transaction: updatedTransaction,
            wallet: await (0, exports.getWalletByIdService)(walletId),
            redirectUrl: paymentResult.redirectUrl,
            transferDetails: paymentResult.transferDetails,
            status: paymentResult.status,
            message: paymentResult.message,
        };
    }
    catch (error) {
        // Update transaction as failed
        await prisma_1.default.walletTransaction.update({
            where: { id: pendingTransaction.id },
            data: {
                status: "FAILED",
                flwMessage: error.message,
            },
        });
        throw new Error(`Wallet top-up failed: ${error.message}`);
    }
};
exports.topUpWalletService = topUpWalletService;
/**
 * Debit wallet for payments (CASH payment method)
 */
const debitWalletService = async (data) => {
    const { walletId, amount, description, reference, orderId } = data;
    // Validate amount
    if (amount <= 0) {
        throw new Error("Debit amount must be greater than 0");
    }
    // Get wallet details
    const wallet = await (0, exports.getWalletByIdService)(walletId);
    if (!wallet.isActive) {
        throw new Error("Wallet is inactive");
    }
    // Check sufficient balance
    if (wallet.balance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ${wallet.balance}, Required: ${amount}`);
    }
    const newBalance = wallet.balance - amount;
    // Create transaction and update wallet balance atomically
    const [updatedWallet, transaction] = await prisma_1.default.$transaction([
        prisma_1.default.wallet.update({
            where: { id: walletId },
            data: {
                balance: newBalance,
                updatedAt: new Date(),
            },
        }),
        prisma_1.default.walletTransaction.create({
            data: {
                walletId,
                type: "PAYMENT",
                amount: -amount, // Negative for debit
                previousBalance: wallet.balance,
                newBalance,
                description: description || "Payment deduction",
                reference,
                status: "COMPLETED",
                metadata: orderId ? { orderId } : undefined,
            },
        }),
    ]);
    // Send notification email
    if (wallet.restaurant.email) {
        try {
            await (0, emailTemplates_1.sendWalletNotificationEmail)({
                email: wallet.restaurant.email,
                restaurantName: wallet.restaurant.name,
                type: "PAYMENT",
                amount,
                newBalance,
                transactionId: transaction.id,
                description: description || "Payment deduction",
            });
        }
        catch (emailError) {
            console.log("Failed to send wallet notification email:", emailError);
        }
    }
    return {
        wallet: updatedWallet,
        transaction,
        newBalance,
    };
};
exports.debitWalletService = debitWalletService;
/**
 * Refund to wallet
 */
const refundToWalletService = async (data) => {
    const { walletId, amount, description, reference } = data;
    // Validate amount
    if (amount <= 0) {
        throw new Error("Refund amount must be greater than 0");
    }
    // Get wallet details
    const wallet = await (0, exports.getWalletByIdService)(walletId);
    if (!wallet.isActive) {
        throw new Error("Wallet is inactive");
    }
    const newBalance = wallet.balance + amount;
    // Create transaction and update wallet balance atomically
    const [updatedWallet, transaction] = await prisma_1.default.$transaction([
        prisma_1.default.wallet.update({
            where: { id: walletId },
            data: {
                balance: newBalance,
                updatedAt: new Date(),
            },
        }),
        prisma_1.default.walletTransaction.create({
            data: {
                walletId,
                type: "REFUND",
                amount, // Positive for credit
                previousBalance: wallet.balance,
                newBalance,
                description: description || "Refund credit",
                reference,
                status: "COMPLETED",
            },
        }),
    ]);
    // Send notification email
    if (wallet.restaurant.email) {
        try {
            await (0, emailTemplates_1.sendWalletNotificationEmail)({
                email: wallet.restaurant.email,
                restaurantName: wallet.restaurant.name,
                type: "REFUND",
                amount,
                newBalance,
                transactionId: transaction.id,
                description: description || "Refund credit",
            });
        }
        catch (emailError) {
            console.log("Failed to send wallet notification email:", emailError);
        }
    }
    return {
        wallet: updatedWallet,
        transaction,
        newBalance,
    };
};
exports.refundToWalletService = refundToWalletService;
/**
 * Get wallet transactions with filtering
 */
const getWalletTransactionsService = async (walletId, filters = {}) => {
    const { type, status, startDate, endDate, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where = { walletId };
    if (type)
        where.type = type;
    if (status)
        where.status = status;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = startDate;
        if (endDate)
            where.createdAt.lte = endDate;
    }
    const [transactions, total] = await Promise.all([
        prisma_1.default.walletTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                wallet: {
                    select: {
                        id: true,
                        currency: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma_1.default.walletTransaction.count({ where }),
    ]);
    return {
        transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getWalletTransactionsService = getWalletTransactionsService;
/**
 * Update wallet status (activate/deactivate)
 */
const updateWalletStatusService = async (walletId, isActive) => {
    const wallet = await prisma_1.default.wallet.update({
        where: { id: walletId },
        data: {
            isActive,
            updatedAt: new Date(),
        },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
        },
    });
    return wallet;
};
exports.updateWalletStatusService = updateWalletStatusService;
/**
 * Get all wallets (Admin only)
 */
const getAllWalletsService = async ({ page = 1, limit = 20, isActive, restaurantName, } = {}) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (isActive !== undefined)
        where.isActive = isActive;
    if (restaurantName) {
        where.restaurant = {
            name: {
                contains: restaurantName,
                mode: "insensitive",
            },
        };
    }
    const [wallets, total] = await Promise.all([
        prisma_1.default.wallet.findMany({
            where,
            skip,
            take: limit,
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                _count: {
                    select: {
                        transactions: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma_1.default.wallet.count({ where }),
    ]);
    return {
        wallets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllWalletsService = getAllWalletsService;
/**
 * Verify wallet top-up payment
 */
const verifyWalletTopUpService = async (transactionId) => {
    try {
        // Find the wallet transaction
        let walletTransaction = await prisma_1.default.walletTransaction.findFirst({
            where: {
                id: transactionId,
            },
            include: {
                wallet: {
                    include: { restaurant: true },
                },
            },
        });
        console.log("Verifying wallet transaction:", walletTransaction);
        if (!walletTransaction) {
            return {
                success: false,
                verified: false,
                error: "Transaction not found",
            };
        }
        // For mobile money, we need to check if we have a proper Flutterwave transaction ID
        // If the flwRef is still our custom tx_ref, we can't verify yet
        if (walletTransaction.flwRef &&
            walletTransaction.flwRef.startsWith("WALLET_TOPUP_")) {
            return {
                success: false,
                verified: false,
                error: "Transaction not yet processed by Flutterwave. Please wait for webhook or customer to complete payment.",
                status: "pending",
            };
        }
        // Only try to verify if we have a numeric transaction ID from Flutterwave
        if (!walletTransaction.externalTxId ||
            isNaN(Number(walletTransaction.externalTxId))) {
            return {
                success: false,
                verified: false,
                error: "No valid Flutterwave transaction ID available for verification",
                status: "pending",
            };
        }
        // Verify with Flutterwave using the numeric ID
        const response = await flw.Transaction.verify({
            id: Number(walletTransaction.externalTxId),
        });
        console.log("Flutterwave verification response:", response);
        if (response.status === "success" &&
            response.data.status === "successful") {
            // Update transaction if not already completed
            if (walletTransaction.status !== "COMPLETED") {
                const newBalance = walletTransaction.wallet.balance + walletTransaction.amount;
                // Update wallet balance and transaction status
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
                            flwMessage: "Payment verified and completed",
                            externalTxId: response.data.id?.toString(),
                            flwRef: response.data.flw_ref,
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
                        transactionId: response.data.flw_ref || walletTransaction.id,
                        paymentMethod: walletTransaction.paymentMethod || "Unknown",
                    });
                }
                catch (emailError) {
                    console.log("Failed to send wallet notification email:", emailError);
                }
            }
            return {
                success: true,
                verified: true,
                amount: response.data.amount,
                currency: response.data.currency,
                status: response.data.status,
                transactionId: response.data.id,
                flwRef: response.data.flw_ref,
            };
        }
        // Update transaction as failed if verification shows it failed
        if (walletTransaction.status === "PENDING" ||
            walletTransaction.status === "PROCESSING") {
            await prisma_1.default.walletTransaction.update({
                where: { id: walletTransaction.id },
                data: {
                    status: "FAILED",
                    flwStatus: response.data?.status || "failed",
                    flwMessage: response.message || "Payment verification failed",
                },
            });
        }
        return {
            success: false,
            verified: false,
            error: "Payment verification failed",
            status: response.data?.status,
            message: response.message,
        };
    }
    catch (error) {
        console.log("Error verifying wallet top-up:", error);
        return {
            success: false,
            verified: false,
            error: "Payment verification failed: " + error.message,
        };
    }
};
exports.verifyWalletTopUpService = verifyWalletTopUpService;
// Helper functions for payments
async function processMobileMoneyTopUp(params) {
    try {
        console.log("Processing mobile money top-up with params:", params);
        const payload = {
            tx_ref: params.txRef,
            order_id: params.orderId,
            amount: params.amount.toString(),
            currency: params.currency,
            email: params.email,
            phone_number: params.phoneNumber,
            fullname: params.fullname,
        };
        const response = await flw.MobileMoney.rwanda(payload);
        console.log("Mobile money top-up response:", response);
        return {
            success: response.status === "success",
            // For mobile money, we won't have a transaction ID until payment is completed
            transactionId: params.txRef, // Use tx_ref as temporary ID
            flwRef: params.txRef, // Use tx_ref as reference
            status: "pending", // Always pending for mobile money initially
            message: response.message || "Mobile money top-up initiated",
            redirectUrl: response.meta?.authorization?.redirect,
        };
    }
    catch (error) {
        console.log("Error processing mobile money top-up:", error);
        return {
            success: false,
            error: error.message,
            transactionId: "",
            flwRef: "",
            status: "failed",
            message: "Mobile money top-up failed",
        };
    }
}
async function processCardTopUp(params) {
    try {
        const payload = {
            card_number: params.cardDetails.cardNumber,
            cvv: params.cardDetails.cvv,
            expiry_month: params.cardDetails.expiryMonth,
            expiry_year: params.cardDetails.expiryYear,
            currency: params.currency,
            amount: params.amount.toString(),
            fullname: params.fullname,
            email: params.email,
            phone_number: params.phoneNumber,
            enckey: process.env.FLW_ENCRYPTION_KEY,
            tx_ref: params.txRef,
        };
        if (params.cardDetails.pin) {
            payload.authorization = {
                mode: "pin",
                pin: params.cardDetails.pin,
            };
        }
        const response = await flw.Charge.card(payload);
        return {
            success: response.status === "success",
            transactionId: response.data?.id?.toString() || response.data?.flw_ref || params.txRef,
            flwRef: response.data?.flw_ref || params.txRef,
            status: response.data?.status || "pending",
            message: response.message || "Card top-up initiated",
            redirectUrl: response.meta?.authorization?.redirect,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error.message,
            transactionId: "",
            flwRef: "",
            status: "failed",
            message: "Card top-up failed",
        };
    }
}
