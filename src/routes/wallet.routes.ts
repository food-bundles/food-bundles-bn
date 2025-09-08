import { Router } from "express";
import {
  createWallet,
  getMyWallet,
  getWalletById,
  topUpWallet,
  getMyWalletTransactions,
  getAllWallets,
  updateWalletStatus,
  verifyWalletTopUp,
  adjustWalletBalance,
  getWalletTransactionById,
} from "../controllers/wallet.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const walletRoutes = Router();

// ========================================
// RESTAURANT WALLET ROUTES
// ========================================

/**
 * Create wallet for restaurant
 * POST /wallets
 * Access: Restaurant only
 */
walletRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  createWallet
);

/**
 * Get current restaurant's wallet
 * GET /wallets/my-wallet
 * Access: Restaurant only
 */
walletRoutes.get(
  "/my-wallet",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyWallet
);

/**
 * Top up wallet using Flutterwave
 * POST /wallets/top-up
 * Access: Restaurant only
 */
walletRoutes.post(
  "/top-up",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  topUpWallet
);

/**
 * Get current restaurant's wallet transactions
 * GET /wallets/transactions
 * Access: Restaurant only
 */
walletRoutes.get(
  "/transactions",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyWalletTransactions
);

/**
 * Verify wallet top-up payment
 * GET /wallets/verify-topup/:transactionId
 * Access: Restaurant only
 */
walletRoutes.get(
  "/verify-topup/:transactionId",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  verifyWalletTopUp
);

/**
 * Get wallet transaction by ID
 * GET /wallets/transactions/:transactionId
 * Access: Restaurant (own transactions) or Admin (any transaction)
 */
walletRoutes.get(
  "/transactions/:transactionId",
  isAuthenticated,
  getWalletTransactionById
);

// ========================================
// ADMIN WALLET ROUTES
// ========================================

/**
 * Get all wallets with filtering and pagination
 * GET /wallets
 * Access: Admin only
 */
walletRoutes.get("/", isAuthenticated, checkPermission("ADMIN"), getAllWallets);

/**
 * Get wallet by ID
 * GET /wallets/:walletId
 * Access: Admin only
 */
walletRoutes.get(
  "/:walletId",
  isAuthenticated,
  checkPermission("ADMIN"),
  getWalletById
);

/**
 * Update wallet status (activate/deactivate)
 * PATCH /wallets/:walletId/status
 * Access: Admin only
 */
walletRoutes.patch(
  "/:walletId/status",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateWalletStatus
);

/**
 * Manual wallet balance adjustment
 * POST /wallets/:walletId/adjust
 * Access: Admin only
 */
walletRoutes.post(
  "/:walletId/adjust",
  isAuthenticated,
  checkPermission("ADMIN"),
  adjustWalletBalance
);

export default walletRoutes;
