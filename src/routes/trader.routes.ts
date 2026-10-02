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
  sendCommissionOTP,
  setTraderWalletCommission,
  processAllTradersCommission,
  processExistingUsedVouchers,
  requestDelegation,
  approveDelegation,
  acceptDelegation,
  verifyDelegationOTP,
  revokeDelegation,
  getAllDelegationRequests,
  getTraderDelegationStatus,
  adminApproveLoanOnBehalf,
  reverseDelegation,
  requestWithdraw,
  adminApproveWithdraw,
  verifyWithdrawOTP,
  completeWithdraw,
  getTraderWithdrawRequests,
  getAllWithdrawRequests,
  cancelWithdrawRequest,
  getAdminTraderWallet,
  getAllDelegationHistory,
  getTraderDelegationHistory,
  getTradersWithAcceptedDelegations,
  toggleTraderCommissionMode,
  processAllFixedModeMonthlyCommissions,
  getAllTraders,
  getTraderByIdOrEmail,
  acceptTraderAgreement,
  getTraderAgreementStatus,
} from "../controllers/trader.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";

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
// Get trader wallet by ID (Admin)
traderRoutes.get(
  "/:traderId/wallet",
  isAuthenticated,
  allow("deposits"),
  getAdminTraderWallet,
);

traderRoutes.post(
  "/:traderId/commission/send-otp",
  isAuthenticated,
  allow("deposits"),
  sendCommissionOTP,
);

traderRoutes.patch(
  "/:traderId/commission",
  isAuthenticated,
  allow("deposits"),
  setTraderWalletCommission,
);

// Process all traders commission (Admin only)
traderRoutes.post(
  "/commission/process-all",
  isAuthenticated,
  allow("deposits"),
  processAllTradersCommission,
);

// Process existing used vouchers (Admin only)
traderRoutes.post(
  "/vouchers/process-existing",
  isAuthenticated,
  allow("vouchers"),
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
  allow("deposits"),
  approveDelegation,
);

traderRoutes.post(
  "/delegation/accept",
  isAuthenticated,
  checkPermission("TRADER"),
  acceptDelegation,
);

traderRoutes.post(
  "/delegation/verify-otp",
  isAuthenticated,
  allow("deposits"),
  verifyDelegationOTP,
);

traderRoutes.delete(
  "/delegation/:traderId/revoke",
  isAuthenticated,
  allow("deposits"),
  revokeDelegation,
);

// Get all delegation requests (Admin)
traderRoutes.get(
  "/delegation/requests",
  isAuthenticated,
  allow("deposits"),
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
  allow("vouchers"),
  adminApproveLoanOnBehalf,
);

// Reverse delegation status
traderRoutes.post(
  "/delegation/reverse",
  isAuthenticated,
  checkPermission("TRADER"),
  reverseDelegation,
);

// Withdraw Management
traderRoutes.post(
  "/withdraw/request",
  isAuthenticated,
  checkPermission("TRADER"),
  requestWithdraw,
);

traderRoutes.post(
  "/withdraw/:withdrawId/approve",
  isAuthenticated,
  allow("deposits"),
  adminApproveWithdraw,
);

traderRoutes.post(
  "/withdraw/verify-otp",
  isAuthenticated,
  allow("deposits"),
  verifyWithdrawOTP,
);

traderRoutes.post(
  "/withdraw/:withdrawId/complete",
  isAuthenticated,
  allow("deposits"),
  completeWithdraw,
);

traderRoutes.get(
  "/withdraw/my-requests",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderWithdrawRequests,
);

traderRoutes.get(
  "/withdraw/all-requests",
  isAuthenticated,
  allow("deposits"),
  getAllWithdrawRequests,
);

// Cancel withdraw request
traderRoutes.delete(
  "/withdraw/:withdrawId/cancel",
  isAuthenticated,
  checkPermission("TRADER"),
  cancelWithdrawRequest,
);
// Get all delegation history (Admin)
traderRoutes.get(
  "/delegation/history",
  isAuthenticated,
  allow("deposits"),
  getAllDelegationHistory,
);

// Get trader's own delegation history
traderRoutes.get(
  "/delegation/my-history",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderDelegationHistory,
);

// Get traders with accepted delegations (Admin)
traderRoutes.get(
  "/accepted-delegations",
  isAuthenticated,
  allow("deposits"),
  getTradersWithAcceptedDelegations,
);

// FIXED | NORMAL Commission Mode Toggle

traderRoutes.post(
  "/commission/toggle-mode",
  isAuthenticated,
  checkPermission("TRADER"),
  toggleTraderCommissionMode,
);

traderRoutes.post(
  "/commission/process-all-monthly",
  isAuthenticated,
  allow("deposits"),
  processAllFixedModeMonthlyCommissions,
);

// Get all traders (Admin only)
traderRoutes.get(
  "/all",
  isAuthenticated,
  allow("deposits"),
  getAllTraders,
);

// Get trader by ID or email (Admin only)
traderRoutes.get(
  "/search/:identifier",
  isAuthenticated,
  allow("deposits"),
  getTraderByIdOrEmail,
);

// Agreement
traderRoutes.post(
  "/agreement/accept",
  isAuthenticated,
  checkPermission("TRADER"),
  acceptTraderAgreement,
);

traderRoutes.get(
  "/agreement/status",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderAgreementStatus,
);

export default traderRoutes;
