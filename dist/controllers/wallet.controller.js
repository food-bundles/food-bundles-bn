"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWalletTopUp = exports.adjustWalletBalance = exports.updateWalletStatus = exports.getAllWallets = exports.getWalletTransactionById = exports.getMyWalletTransactions = exports.topUpWallet = exports.getWalletById = exports.getMyWallet = exports.createWallet = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const wallet_service_1 = require("../services/wallet.service");
const client_1 = require("@prisma/client");
/**
 * Create wallet for restaurant
 * POST /wallets
 */
const createWallet = async (req, res) => {
    try {
        const { currency } = req.body;
        const restaurantId = req.user.id;
        const wallet = await (0, wallet_service_1.createWalletService)({
            restaurantId,
            currency,
        });
        res.status(201).json({
            message: "Wallet created successfully",
            data: wallet,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create wallet",
        });
    }
};
exports.createWallet = createWallet;
/**
 * Get restaurant's wallet
 * GET /wallets/my-wallet
 */
const getMyWallet = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const wallet = await (0, wallet_service_1.getWalletByRestaurantIdService)(restaurantId);
        res.status(200).json({
            message: "Wallet retrieved successfully",
            data: wallet,
        });
    }
    catch (error) {
        if (error.message === "Wallet not found") {
            return res.status(404).json({
                message: "Wallet not found. Please create a wallet first.",
            });
        }
        res.status(500).json({
            message: error.message || "Failed to get wallet",
        });
    }
};
exports.getMyWallet = getMyWallet;
/**
 * Get wallet by ID (Admin only)
 * GET /wallets/:walletId
 */
const getWalletById = async (req, res) => {
    try {
        const { walletId } = req.params;
        const wallet = await (0, wallet_service_1.getWalletByIdService)(walletId);
        res.status(200).json({
            message: "Wallet retrieved successfully",
            data: wallet,
        });
    }
    catch (error) {
        if (error.message === "Wallet not found") {
            return res.status(404).json({
                message: "Wallet not found",
            });
        }
        res.status(500).json({
            message: error.message || "Failed to get wallet",
        });
    }
};
exports.getWalletById = getWalletById;
/**
 * Top up wallet using Flutterwave
 * POST /wallets/top-up
 */
const topUpWallet = async (req, res) => {
    try {
        const { amount, paymentMethod, phoneNumber, cardDetails, description } = req.body;
        const restaurantId = req.user.id;
        // Validate required fields
        if (!amount || amount <= 0) {
            return res.status(400).json({
                message: "Valid amount is required",
            });
        }
        if (!paymentMethod) {
            return res.status(400).json({
                message: "Payment method is required",
            });
        }
        // Validate payment method specific requirements
        if (paymentMethod.toUpperCase() === "MOBILE_MONEY" && !phoneNumber) {
            return res.status(400).json({
                message: "Phone number is required for mobile money payments",
            });
        }
        if (paymentMethod.toUpperCase() === "CARD" && !cardDetails) {
            return res.status(400).json({
                message: "Card details are required for card payments",
            });
        }
        // Get wallet by restaurant ID
        let wallet;
        try {
            wallet = await (0, wallet_service_1.getWalletByRestaurantIdService)(restaurantId);
        }
        catch (error) {
            // If wallet doesn't exist, create one
            wallet = await (0, wallet_service_1.createWalletService)({ restaurantId });
        }
        const result = await (0, wallet_service_1.topUpWalletService)({
            walletId: wallet.id,
            amount,
            paymentMethod,
            phoneNumber,
            cardDetails,
            description,
        });
        if (result.success) {
            if (result.redirectUrl) {
                res.status(200).json({
                    message: "Top-up initiated - redirect required",
                    data: {
                        wallet: result.wallet,
                        transaction: result.transaction,
                        redirectUrl: result.redirectUrl,
                        status: result.status,
                        requiresRedirect: true,
                    },
                });
            }
            else {
                res.status(200).json({
                    message: result.message || "Wallet top-up processed successfully",
                    data: {
                        wallet: result.wallet,
                        transaction: result.transaction,
                        status: result.status,
                    },
                });
            }
        }
        else {
            res.status(400).json({
                message: "Top-up failed",
                error: result.message,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to process wallet top-up",
        });
    }
};
exports.topUpWallet = topUpWallet;
/**
 * Get wallet transactions
 * GET /wallets/transactions
 */
const getMyWalletTransactions = async (req, res) => {
    try {
        const { type, status, startDate, endDate, page = 1, limit = 20, } = req.query;
        const restaurantId = req.user.id;
        // Get wallet
        const wallet = await (0, wallet_service_1.getWalletByRestaurantIdService)(restaurantId);
        // Validate filters
        if (type &&
            !Object.values(client_1.WalletTransactionType).includes(type)) {
            return res.status(400).json({
                message: "Invalid transaction type",
            });
        }
        if (status &&
            !Object.values(client_1.TransactionStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid transaction status",
            });
        }
        const filters = {
            type: type,
            status: status,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            page: parseInt(page),
            limit: parseInt(limit),
        };
        const result = await (0, wallet_service_1.getWalletTransactionsService)(wallet.id, filters);
        res.status(200).json({
            message: "Wallet transactions retrieved successfully",
            data: result.transactions,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get wallet transactions",
        });
    }
};
exports.getMyWalletTransactions = getMyWalletTransactions;
/**
 * Get wallet transaction by ID
 * GET /wallets/transactions/:transactionId
 */
const getWalletTransactionById = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const restaurantId = req.user.id;
        const transaction = await prisma_1.default.walletTransaction.findUnique({
            where: { id: transactionId },
            include: {
                wallet: {
                    include: {
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
        });
        if (!transaction) {
            return res.status(404).json({
                message: "Transaction not found",
            });
        }
        // Check if user owns this transaction or is admin
        if (transaction.wallet.restaurantId !== restaurantId &&
            req.user.role !== "ADMIN") {
            return res.status(403).json({
                message: "Unauthorized access to transaction",
            });
        }
        res.status(200).json({
            message: "Transaction retrieved successfully",
            data: transaction,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get transaction",
        });
    }
};
exports.getWalletTransactionById = getWalletTransactionById;
/**
 * Get all wallets (Admin only)
 * GET /wallets
 */
const getAllWallets = async (req, res) => {
    try {
        const { page = 1, limit = 20, isActive, restaurantName } = req.query;
        const result = await (0, wallet_service_1.getAllWalletsService)({
            page: parseInt(page),
            limit: parseInt(limit),
            isActive: isActive ? isActive === "true" : undefined,
            restaurantName: restaurantName,
        });
        res.status(200).json({
            message: "Wallets retrieved successfully",
            data: result.wallets,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get wallets",
        });
    }
};
exports.getAllWallets = getAllWallets;
/**
 * Update wallet status (Admin only)
 * PATCH /wallets/:walletId/status
 */
const updateWalletStatus = async (req, res) => {
    try {
        const { walletId } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                message: "isActive must be a boolean value",
            });
        }
        const wallet = await (0, wallet_service_1.updateWalletStatusService)(walletId, isActive);
        res.status(200).json({
            message: `Wallet ${isActive ? "activated" : "deactivated"} successfully`,
            data: wallet,
        });
    }
    catch (error) {
        if (error.message === "Wallet not found") {
            return res.status(404).json({
                message: "Wallet not found",
            });
        }
        res.status(500).json({
            message: error.message || "Failed to update wallet status",
        });
    }
};
exports.updateWalletStatus = updateWalletStatus;
/**
 * Adjust wallet balance (Admin only)
 * POST /wallets/:walletId/adjust
 */
const adjustWalletBalance = async (req, res) => {
    try {
        const { walletId } = req.params;
        const { amount, type, description } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({
                message: "Valid amount is required",
            });
        }
        if (!type || !["credit", "debit"].includes(type)) {
            return res.status(400).json({
                message: "Type must be either 'credit' or 'debit'",
            });
        }
        // Get wallet
        const wallet = await (0, wallet_service_1.getWalletByIdService)(walletId);
        if (!wallet.isActive) {
            return res.status(400).json({
                message: "Cannot adjust inactive wallet",
            });
        }
        let result;
        if (type === "debit") {
            // For debit, check sufficient balance
            if (wallet.balance < amount) {
                return res.status(400).json({
                    message: `Insufficient wallet balance. Available: ${wallet.balance}, Required: ${amount}`,
                });
            }
            result = await (0, wallet_service_1.debitWalletService)({
                walletId,
                amount,
                description: description || `Manual debit adjustment by admin`,
                reference: `ADMIN_ADJUSTMENT_${Date.now()}`,
            });
        }
        else {
            result = await (0, wallet_service_1.refundToWalletService)({
                walletId,
                amount,
                description: description || `Manual credit adjustment by admin`,
                reference: `ADMIN_ADJUSTMENT_${Date.now()}`,
            });
        }
        res.status(200).json({
            message: `Wallet ${type} adjustment successful`,
            data: result,
        });
    }
    catch (error) {
        if (error.message === "Wallet not found") {
            return res.status(404).json({
                message: "Wallet not found",
            });
        }
        res.status(500).json({
            message: error.message || "Failed to adjust wallet balance",
        });
    }
};
exports.adjustWalletBalance = adjustWalletBalance;
/**
 * Verify wallet top-up payment
 * GET /wallets/verify-topup/:transactionId
 */
const verifyWalletTopUp = async (req, res) => {
    try {
        const { transactionId } = req.params;
        const result = await (0, wallet_service_1.verifyWalletTopUpService)(transactionId);
        if (result.success && result.verified) {
            res.status(200).json({
                message: "Payment verified successfully",
                data: result,
            });
        }
        else {
            res.status(400).json({
                message: result.error || "Payment verification failed",
                data: result,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to verify payment",
        });
    }
};
exports.verifyWalletTopUp = verifyWalletTopUp;
