import { Router } from "express";
import {
  createWallet,
  getMyWallet,
  getWalletById,
  topUpWallet,
  getMyWalletTransactions,
  getAllWallets,
  getRestaurantWallets,
  getTraderWallets,
  updateWalletStatus,
  verifyWalletTopUp,
  adjustWalletBalance,
  getWalletTransactionById,
  adminDepositToWallet,
  getAdminWalletTransactions,
  getRestaurantTransactions,
  getTraderTransactions,
  requestAdminDepositOTP,
  verifyAdminDepositOTP,
  requestWalletAdjustmentOTP,
  verifyWalletAdjustmentOTP,
  transferToWallet,
  getAllWalletTransfers,
  getMyWalletTransfers,
} from "../controllers/wallet.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";

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
 * GET /wallets/my-transactions
 * Access: Restaurant only
 */
walletRoutes.get(
  "/my-transactions",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyWalletTransactions
);

/**
 * Verify wallet top-up payment
 * GET /wallets/verify-topup/:transactionId
 * Access: Restaurant, Affiliator, Hotel, Trader or Admin (owner-scoped by transaction id)
 */
walletRoutes.get(
  "/verify-topup/:transactionId",
  isAuthenticated,
  allow("deposits", "RESTAURANT", "AFFILIATOR", "HOTEL", "TRADER"),
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
// WALLET TRANSFER ROUTES (voucher amounts / Kayko)
// ========================================

/**
 * Transfer voucher amount to restaurant wallet (Admin/Kayko)
 * POST /wallets/transfers
 * Access: Admin only
 */
walletRoutes.post(
  "/transfers",
  isAuthenticated,
  allow("deposits"),
  transferToWallet
);

/**
 * Get all wallet transfers (Admin)
 * GET /wallets/transfers
 * Access: Admin only
 */
walletRoutes.get(
  "/transfers",
  isAuthenticated,
  allow("deposits"),
  getAllWalletTransfers
);

/**
 * Get my wallet transfers (Restaurant)
 * GET /wallets/my-transfers
 * Access: Restaurant / Hotel / Affiliator
 */
walletRoutes.get(
  "/my-transfers",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  getMyWalletTransfers
);

// ========================================
// ADMIN WALLET ROUTES
// ========================================

/**
 * Get all wallets with filtering and pagination
 * GET /wallets
 * Access: Admin only
 */
walletRoutes.get("/", isAuthenticated, allow("deposits"), getAllWallets);

/**
 * Get restaurant wallets only
 * GET /wallets/restaurants
 * Access: Admin only
 */
walletRoutes.get("/restaurants", isAuthenticated, allow("deposits"), getRestaurantWallets);

/**
 * Get trader wallets only
 * GET /wallets/traders
 * Access: Admin only
 */
walletRoutes.get("/traders", isAuthenticated, allow("deposits"), getTraderWallets);

/**
 * Get all wallet transactions
 * GET /wallets/transactions
 * Access: Admin only
 */
walletRoutes.get(
  "/transactions",
  isAuthenticated,
  allow("deposits"),
  getAdminWalletTransactions
);

/**
 * Get restaurant transactions only
 * GET /wallets/restaurants/transactions
 * Access: Admin only
 */
walletRoutes.get(
  "/restaurants/transactions",
  isAuthenticated,
  allow("deposits"),
  getRestaurantTransactions
);

/**
 * Get trader transactions only
 * GET /wallets/traders/transactions
 * Access: Admin only
 */
walletRoutes.get(
  "/traders/transactions",
  isAuthenticated,
  allow("deposits"),
  getTraderTransactions
);

/**
 * Get wallet by ID
 * GET /wallets/:walletId
 * Access: Admin only
 */
walletRoutes.get(
  "/:walletId",
  isAuthenticated,
  allow("deposits"),
  getWalletById
);

/**
 * Update wallet status (activate/deactivate)
 * PATCH /wallets/:walletId/status
 * Access: Admin only
 */
walletRoutes.patch(
  "/:walletId",
  isAuthenticated,
  allow("deposits"),
  updateWalletStatus
);

/**
 * Admin deposit to restaurant wallet
 * POST /wallets/admin-deposit
 * Access: Admin only
 */
walletRoutes.post(
  "/admin-deposit",
  isAuthenticated,
  allow("deposits"),
  adminDepositToWallet
);

/**
 * Request OTP for admin deposit
 * POST /wallets/admin-deposit/request-otp
 * Access: Admin only
 */
walletRoutes.post(
  "/admin-deposit/request-otp",
  isAuthenticated,
  allow("deposits"),
  requestAdminDepositOTP
);

/**
 * Verify OTP and process admin deposit
 * POST /wallets/admin-deposit/verify-otp
 * Access: Admin only
 */
walletRoutes.post(
  "/admin-deposit/verify-otp",
  isAuthenticated,
  allow("deposits"),
  verifyAdminDepositOTP
);

/**
 * Manual wallet balance adjustment
 * POST /wallets/:walletId/adjust
 * Access: Admin only
 */
walletRoutes.post(
  "/:walletId/adjust",
  isAuthenticated,
  allow("deposits"),
  adjustWalletBalance
);

/**
 * Request OTP for wallet adjustment
 * POST /wallets/:walletId/adjust/request-otp
 * Access: Admin only
 */
walletRoutes.post(
  "/:walletId/adjust/request-otp",
  isAuthenticated,
  allow("deposits"),
  requestWalletAdjustmentOTP
);

/**
 * Verify OTP and process wallet adjustment
 * POST /wallets/:walletId/adjust/verify-otp
 * Access: Admin only
 */
walletRoutes.post(
  "/:walletId/adjust/verify-otp",
  isAuthenticated,
  allow("deposits"),
  verifyWalletAdjustmentOTP
);

export default walletRoutes;
