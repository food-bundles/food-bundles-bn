"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const walletRoutes = (0, express_1.Router)();
// ========================================
// RESTAURANT WALLET ROUTES
// ========================================
/**
 * Create wallet for restaurant
 * POST /wallets
 * Access: Restaurant only
 */
walletRoutes.post("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), wallet_controller_1.createWallet);
/**
 * Get current restaurant's wallet
 * GET /wallets/my-wallet
 * Access: Restaurant only
 */
walletRoutes.get("/my-wallet", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), wallet_controller_1.getMyWallet);
/**
 * Top up wallet using Flutterwave
 * POST /wallets/top-up
 * Access: Restaurant only
 */
walletRoutes.post("/top-up", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), wallet_controller_1.topUpWallet);
/**
 * Get current restaurant's wallet transactions
 * GET /wallets/transactions
 * Access: Restaurant only
 */
walletRoutes.get("/transactions", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), wallet_controller_1.getMyWalletTransactions);
/**
 * Verify wallet top-up payment
 * GET /wallets/verify-topup/:transactionId
 * Access: Restaurant only
 */
walletRoutes.get("/verify-topup/:transactionId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), wallet_controller_1.verifyWalletTopUp);
/**
 * Get wallet transaction by ID
 * GET /wallets/transactions/:transactionId
 * Access: Restaurant (own transactions) or Admin (any transaction)
 */
walletRoutes.get("/transactions/:transactionId", authMiddleware_1.isAuthenticated, wallet_controller_1.getWalletTransactionById);
// ========================================
// ADMIN WALLET ROUTES
// ========================================
/**
 * Get all wallets with filtering and pagination
 * GET /wallets
 * Access: Admin only
 */
walletRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), wallet_controller_1.getAllWallets);
/**
 * Get wallet by ID
 * GET /wallets/:walletId
 * Access: Admin only
 */
walletRoutes.get("/:walletId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), wallet_controller_1.getWalletById);
/**
 * Update wallet status (activate/deactivate)
 * PATCH /wallets/:walletId/status
 * Access: Admin only
 */
walletRoutes.patch("/:walletId/status", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), wallet_controller_1.updateWalletStatus);
/**
 * Manual wallet balance adjustment
 * POST /wallets/:walletId/adjust
 * Access: Admin only
 */
walletRoutes.post("/:walletId/adjust", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), wallet_controller_1.adjustWalletBalance);
exports.default = walletRoutes;
