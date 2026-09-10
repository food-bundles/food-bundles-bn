import { Router } from "express";
import {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  getRestaurantVouchers,
  getAvailableVouchers,
  updateVoucher,
  deactivateVoucher,
  getVoucherTransactions,
  applyForLoan,
  getMyLoanApplications,
  getAllLoanApplications,
  getLoanApplicationById,
  approveLoan,
  disburseLoan,
  rejectLoan,
  deleteLoanApplication,
  processVoucherPayment,
  makeRepayment,
  makeVoucherTopUp,
  verifyVoucherTopUp,
  getOutstandingBalance,
  calculatePenalties,
  getVoucherPenalties,
  waivePenalty,
  getRestaurantCreditSummary,
  getVoucherByCode,
  getMyVouchers,
  markLoanApplicationAsAccepted,
  sendVoucherReminders,
} from "../controllers/voucher.controller";
import {
  requestVoucherCard,
  issueVoucherCard,
  getMyVoucherCard,
  getAllVoucherCards,
  getVoucherCardByPan,
  getCardEnrollmentRequests,
  getMyCardEnrollmentRequest,
  requestLoanSession,
  approveLoanSession,
  rejectLoanSession,
  acceptLoanSession,
  getLoanTraders,
  getLoanTerms,
  acceptLoanTerms,
  getTraderLoanSessions,
  traderApproveLoanSession,
  adminApproveLoanSessionOnBehalf,
  payUnlockFee,
  verifyUnlockFeePayment,
  getMyLoanSessions,
  getAllLoanSessions,
  getLoanSessionById,
  getVoucherCardStats,
  updateVoucherCardUnlockFee,
  getRecentActivities,
} from "../controllers/voucher-card.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const voucherRoutes = Router();

// ========================================
// VOUCHER MANAGEMENT ROUTES
// ========================================

/**
 * Create voucher (Admin only)
 * POST /vouchers
 */
voucherRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  createVoucher,
);

/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
voucherRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllVouchers,
);

/**
 * Get current restaurant's vouchers
 * GET /vouchers/my-vouchers
 */
voucherRoutes.get(
  "/my-vouchers",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "ADMIN", "HOTEL"),
  getMyVouchers,
);

/**
 * Get restaurant's vouchers
 * GET /vouchers/restaurant/:restaurantId
 */
voucherRoutes.get(
  "/restaurant/:restaurantId",
  isAuthenticated,
  getRestaurantVouchers,
);

/**
 * Get available vouchers for checkout
 * GET /vouchers/available
 */
voucherRoutes.get(
  "/available",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "ADMIN", "HOTEL"),
  getAvailableVouchers,
);

/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
voucherRoutes.patch(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateVoucher,
);

/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
voucherRoutes.delete(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  deactivateVoucher,
);

/**
 * Get voucher transaction history
 * GET /vouchers/:id/transactions
 */
voucherRoutes.get("/:id/transactions", isAuthenticated, getVoucherTransactions);

// ========================================
// LOAN MANAGEMENT ROUTES
// ========================================

/**
 * Submit loan application (Restaurant)
 * POST /vouchers/loans/apply
 */
voucherRoutes.post(
  "/loans/apply",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "ADMIN", "HOTEL"),
  applyForLoan,
);

/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
voucherRoutes.get(
  "/loans/my-applications",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  getMyLoanApplications,
);

/**
 * Get all loan applications (Admin only)
 * GET /vouchers/loans/applications
 */
voucherRoutes.get(
  "/loans/applications",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllLoanApplications,
);

/**
 * Get loan application by ID
 * GET /vouchers/loans/:id
 */
voucherRoutes.get("/loans/:id", isAuthenticated, getLoanApplicationById);

/**
 * Approve loan application (Admin only)
 * PATCH /vouchers/loans/:id/approve
 */
voucherRoutes.patch(
  "/loans/:id/approve",
  isAuthenticated,
  checkPermission("ADMIN"),
  approveLoan,
);

/**
 * Disburse loan (Admin only)
 * POST /vouchers/loans/:id/disburse
 */
voucherRoutes.post(
  "/loans/:id/disburse",
  isAuthenticated,
  checkPermission("ADMIN"),
  disburseLoan,
);

/**
 * Reject loan application (Admin only)
 * PATCH /vouchers/loans/:id/reject
 */
voucherRoutes.patch(
  "/loans/:id/reject",
  isAuthenticated,
  checkPermission("ADMIN"),
  rejectLoan,
);

/**
 * Delete loan application
 * DELETE /vouchers/loans/:id
 */
voucherRoutes.delete("/loans/:id", isAuthenticated, deleteLoanApplication);

// ========================================
// VOUCHER PAYMENT ROUTES
// ========================================

/**
 * Process voucher payment (used during checkout)
 * POST /vouchers/checkout/voucher
 */
voucherRoutes.post(
  "/checkout/voucher",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  processVoucherPayment,
);

// ========================================
// REPAYMENT & PENALTY ROUTES
// ========================================

/**
 * Make repayment (Restaurant)
 * POST /vouchers/:id/repay
 */
voucherRoutes.post(
  "/:id/repay",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  makeRepayment,
);

/**
 * Initiate voucher credit top-up (Restaurant)
 * POST /vouchers/:id/top-up
 */
voucherRoutes.post(
  "/:id/top-up",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  makeVoucherTopUp,
);

/**
 * Verify voucher credit top-up status (Restaurant)
 * POST /vouchers/top-ups/:topUpId/verify
 */
voucherRoutes.post(
  "/top-ups/:topUpId/verify",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  verifyVoucherTopUp,
);

/**
 * Get outstanding balance
 * GET /vouchers/:id/outstanding
 */
voucherRoutes.get("/:id/outstanding", isAuthenticated, getOutstandingBalance);

/**
 * Get penalties for voucher
 * GET /vouchers/:id/penalties
 */
voucherRoutes.get("/:id/penalties", isAuthenticated, getVoucherPenalties);

/**
 * Calculate penalties (Admin/System)
 * POST /vouchers/penalties/calculate
 */
voucherRoutes.post(
  "/penalties/calculate",
  isAuthenticated,
  checkPermission("ADMIN"),
  calculatePenalties,
);

/**
 * Waive penalty (Admin only)
 * POST /vouchers/penalties/:id/waive
 */
voucherRoutes.post(
  "/penalties/:id/waive",
  isAuthenticated,
  checkPermission("ADMIN"),
  waivePenalty,
);

// ========================================
// CREDIT SUMMARY ROUTES
// ========================================

/**
 * Get restaurant credit summary
 * GET /vouchers/credit-summary
 */
voucherRoutes.get(
  "/credit-summary",
  isAuthenticated,
  checkPermission("RESTAURANT", "AFFILIATOR", "HOTEL", "ADMIN"),
  getRestaurantCreditSummary,
);

/**
 * Mark loan application as accepted
 * PATCH /vouchers/loans/:id/accept
 */
voucherRoutes.patch(
  "/loans/:id/accept",
  isAuthenticated,
  checkPermission("ADMIN"),
  markLoanApplicationAsAccepted,
);

voucherRoutes.get("/code/:voucherCode", isAuthenticated, getVoucherByCode);

/**
 * Send voucher maturity reminders (Admin/System)
 * POST /vouchers/reminders/send
 */
voucherRoutes.post(
  "/reminders/send",
  isAuthenticated,
  checkPermission("ADMIN"),
  sendVoucherReminders,
);

// ========================================
// NEW VOUCHER CARD SYSTEM (PAN-based)
// ========================================

// Card enrollment (restaurant requests a card)
voucherRoutes.post(
  "/card/request",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  requestVoucherCard,
);

// Get my voucher card (restaurant)
voucherRoutes.get(
  "/card/my-card",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  getMyVoucherCard,
);

// Get my card enrollment request status (restaurant)
voucherRoutes.get(
  "/card/my-request",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  getMyCardEnrollmentRequest,
);

// Issue a card to a restaurant (admin)
voucherRoutes.post(
  "/card/issue",
  isAuthenticated,
  checkPermission("ADMIN"),
  issueVoucherCard,
);

// Get all voucher cards (admin)
voucherRoutes.get(
  "/cards",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllVoucherCards,
);

// Get card enrollment requests (admin)
voucherRoutes.get(
  "/card/enrollment-requests",
  isAuthenticated,
  checkPermission("ADMIN"),
  getCardEnrollmentRequests,
);

// Get card by PAN (admin)
voucherRoutes.get(
  "/card/pan/:pan",
  isAuthenticated,
  checkPermission("ADMIN"),
  getVoucherCardByPan,
);

// Configure a card's unlock fee (admin) — no default fee; admin decides if/when it applies
voucherRoutes.patch(
  "/card/:cardId/unlock-fee",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateVoucherCardUnlockFee,
);

// Recent activities feed (admin) — new card applications + new loan requests
voucherRoutes.get(
  "/activities",
  isAuthenticated,
  checkPermission("ADMIN"),
  getRecentActivities,
);

// Loan sessions — restaurant requests a loan
voucherRoutes.post(
  "/sessions/request",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  requestLoanSession,
);

// Traders a restaurant can pick as loan provider (static route — must be before /sessions/:id)
voucherRoutes.get(
  "/sessions/loan-traders",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  getLoanTraders,
);

// T&C for a provider + acceptance status (static route — must be before /sessions/:id)
voucherRoutes.get(
  "/sessions/loan-terms",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  getLoanTerms,
);

// First-time T&C acceptance (static route — must be before /sessions/:id)
voucherRoutes.post(
  "/sessions/loan-terms/accept",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  acceptLoanTerms,
);

// Trader loan session inbox (static route — must be before /sessions/:id)
voucherRoutes.get(
  "/sessions/trader/inbox",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderLoanSessions,
);

// Get my loan sessions (restaurant)
voucherRoutes.get(
  "/sessions/my-sessions",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  getMyLoanSessions,
);

// Get all loan sessions (admin)
voucherRoutes.get(
  "/sessions",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllLoanSessions,
);

// Get session by ID
voucherRoutes.get(
  "/sessions/:id",
  isAuthenticated,
  getLoanSessionById,
);

// Approve loan session (admin)
voucherRoutes.patch(
  "/sessions/:id/approve",
  isAuthenticated,
  checkPermission("ADMIN"),
  approveLoanSession,
);

// Reject loan session (admin)
voucherRoutes.patch(
  "/sessions/:id/reject",
  isAuthenticated,
  checkPermission("ADMIN"),
  rejectLoanSession,
);

// Accept loan session — makes it visible to the selected trader so they can approve (admin)
voucherRoutes.patch(
  "/sessions/:id/accept",
  isAuthenticated,
  checkPermission("ADMIN"),
  acceptLoanSession,
);

// Approve loan session as the selected trader / provider (trader)
voucherRoutes.post(
  "/sessions/:id/trader-approve",
  isAuthenticated,
  checkPermission("TRADER"),
  traderApproveLoanSession,
);

// Approve loan session on behalf of a delegation trader (admin)
voucherRoutes.post(
  "/sessions/:id/trader-approve-on-behalf/:traderId",
  isAuthenticated,
  checkPermission("ADMIN"),
  adminApproveLoanSessionOnBehalf,
);

// Pay unlock fee (restaurant)
voucherRoutes.post(
  "/sessions/:id/pay-unlock-fee",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  payUnlockFee,
);

// Verify unlock fee payment status (restaurant)
voucherRoutes.post(
  "/sessions/:id/unlock-fee/verify",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  verifyUnlockFeePayment,
);

// Voucher card system stats (admin)
voucherRoutes.get(
  "/card-stats",
  isAuthenticated,
  checkPermission("ADMIN"),
  getVoucherCardStats,
);

/**
 * Get voucher by ID — MUST be last to avoid swallowing static paths
 * GET /vouchers/:id
 */
voucherRoutes.get("/:id", isAuthenticated, getVoucherById);

export default voucherRoutes;
