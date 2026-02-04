import { Router } from "express";
import {
  createTraderWallet,
  getTraderWallet,
  topUpTraderWallet,
  getTraderLoanApplications,
  getTraderVouchers,
  traderApproveLoan,
  getTraderCommission,
  processTraderCommission,
  getTraderOrders,
  getTraderTransactionHistory,
  getTraderTransactionById,
  getTraderTransactionStats,
  getTraderDashboard,
  setTraderWalletCommission,
  processAllTradersCommission,
  processExistingUsedVouchers,
  requestDelegation,
  approveDelegation,
  verifyDelegationOTP,
  revokeDelegation,
  getAllDelegationRequests,
  getTraderDelegationStatus,
  adminApproveLoanOnBehalf,
  reverseDelegation,
} from "../controllers/trader.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const traderRoutes = Router();

// Wallet Management
traderRoutes.post(
  "/wallet",
  isAuthenticated,
  checkPermission("TRADER"),
  createTraderWallet,
);
traderRoutes.get(
  "/wallet",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderWallet,
);
traderRoutes.post(
  "/wallet/topup",
  isAuthenticated,
  checkPermission("TRADER"),
  topUpTraderWallet,
);

// Loan & Voucher Management
traderRoutes.get(
  "/loans",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderLoanApplications,
);
traderRoutes.get(
  "/vouchers",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderVouchers,
);
traderRoutes.post(
  "/loans/:loanId/approve",
  isAuthenticated,
  checkPermission("TRADER"),
  traderApproveLoan,
);

// Commission Management
traderRoutes.get(
  "/commission",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderCommission,
);
traderRoutes.post(
  "/commission/process",
  isAuthenticated,
  checkPermission("TRADER"),
  processTraderCommission,
);

// Orders & Transactions
traderRoutes.get(
  "/orders",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderOrders,
);
traderRoutes.get(
  "/transactions",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderTransactionHistory,
);
traderRoutes.get(
  "/transactions/stats",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderTransactionStats,
);
traderRoutes.get(
  "/transactions/:transactionId",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderTransactionById,
);

// Dashboard
traderRoutes.get(
  "/dashboard",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderDashboard,
);

// Admin routes for trader management
traderRoutes.patch(
  "/:traderId/commission",
  isAuthenticated,
  checkPermission("ADMIN"),
  setTraderWalletCommission,
);

// Process all traders commission (Admin only)
traderRoutes.post(
  "/commission/process-all",
  isAuthenticated,
  checkPermission("ADMIN"),
  processAllTradersCommission,
);

// Process existing used vouchers (Admin only)
traderRoutes.post(
  "/vouchers/process-existing",
  isAuthenticated,
  checkPermission("ADMIN"),
  processExistingUsedVouchers,
);

// Delegation Management
traderRoutes.post(
  "/delegation/request",
  isAuthenticated,
  checkPermission("TRADER"),
  requestDelegation,
);

traderRoutes.post(
  "/delegation/:traderId/approve",
  isAuthenticated,
  checkPermission("ADMIN"),
  approveDelegation,
);

traderRoutes.post(
  "/delegation/verify-otp",
  isAuthenticated,
  checkPermission("ADMIN"),
  verifyDelegationOTP,
);

traderRoutes.delete(
  "/delegation/:traderId/revoke",
  isAuthenticated,
  checkPermission("ADMIN"),
  revokeDelegation,
);

// Get all delegation requests (Admin)
traderRoutes.get(
  "/delegation/requests",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllDelegationRequests,
);

// Get trader's own delegation status
traderRoutes.get(
  "/delegation/status",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderDelegationStatus,
);

// Admin approve loan on behalf of trader
traderRoutes.post(
  "/admin/:traderId/approve-loan",
  isAuthenticated,
  checkPermission("ADMIN"),
  adminApproveLoanOnBehalf,
);

// Reverse delegation status
traderRoutes.post(
  "/delegation/reverse",
  isAuthenticated,
  checkPermission("TRADER"),
  reverseDelegation,
);

export default traderRoutes;
