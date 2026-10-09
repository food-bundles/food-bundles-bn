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
  submitKycConsent,
  getMyKycConsent,
  requestLoanSession,
  approveLoanSession,
  rejectLoanSession,
  acceptLoanSession,
  getLoanTraders,
  checkTraderLoanCapacity,
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
  convertLoanSessionToWallet,
  repayLoanSession,
  verifyLoanRepayment,
  getVoucherCardStats,
  getRecentActivities,
} from "../controllers/voucher-card.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";

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
  allow("vouchers"),
  createVoucher,
);

/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
voucherRoutes.get(
  "/",
  isAuthenticated,
  allow("vouchers"),
  getAllVouchers,
);

/**
 * Get current restaurant's vouchers
 * GET /vouchers/my-vouchers
 */
voucherRoutes.get(
  "/my-vouchers",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
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
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  getAvailableVouchers,
);

/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
voucherRoutes.patch(
  "/:id",
  isAuthenticated,
  allow("vouchers"),
  updateVoucher,
);

/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
voucherRoutes.delete(
  "/:id",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  applyForLoan,
);

/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
voucherRoutes.get(
  "/loans/my-applications",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  getMyLoanApplications,
);

/**
 * Get all loan applications (Admin only)
 * GET /vouchers/loans/applications
 */
voucherRoutes.get(
  "/loans/applications",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers"),
  approveLoan,
);

/**
 * Disburse loan (Admin only)
 * POST /vouchers/loans/:id/disburse
 */
voucherRoutes.post(
  "/loans/:id/disburse",
  isAuthenticated,
  allow("vouchers"),
  disburseLoan,
);

/**
 * Reject loan application (Admin only)
 * PATCH /vouchers/loans/:id/reject
 */
voucherRoutes.patch(
  "/loans/:id/reject",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
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
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  makeRepayment,
);

/**
 * Initiate voucher credit top-up (Restaurant)
 * POST /vouchers/:id/top-up
 */
voucherRoutes.post(
  "/:id/top-up",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  makeVoucherTopUp,
);

/**
 * Verify voucher credit top-up status (Restaurant)
 * POST /vouchers/top-ups/:topUpId/verify
 */
voucherRoutes.post(
  "/top-ups/:topUpId/verify",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
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
  allow("vouchers"),
  calculatePenalties,
);

/**
 * Waive penalty (Admin only)
 * POST /vouchers/penalties/:id/waive
 */
voucherRoutes.post(
  "/penalties/:id/waive",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers", "RESTAURANT", "AFFILIATOR", "HOTEL"),
  getRestaurantCreditSummary,
);

/**
 * Mark loan application as accepted
 * PATCH /vouchers/loans/:id/accept
 */
voucherRoutes.patch(
  "/loans/:id/accept",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers"),
  sendVoucherReminders,
);

// ========================================
// NEW VOUCHER CARD SYSTEM (PAN-based)
// ========================================

// KYC consent — restaurant submits before requesting a card
voucherRoutes.post(
  "/card/kyc-consent",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  submitKycConsent,
);

voucherRoutes.get(
  "/card/kyc-consent",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL"),
  getMyKycConsent,
);

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
  allow("vouchers"),
  issueVoucherCard,
);

// Get all voucher cards (admin)
voucherRoutes.get(
  "/cards",
  isAuthenticated,
  allow("vouchers"),
  getAllVoucherCards,
);

// Get card enrollment requests (admin)
voucherRoutes.get(
  "/card/enrollment-requests",
  isAuthenticated,
  allow("vouchers"),
  getCardEnrollmentRequests,
);

// Get card by PAN (admin)
voucherRoutes.get(
  "/card/pan/:pan",
  isAuthenticated,
  allow("vouchers"),
  getVoucherCardByPan,
);

// Recent activities feed (admin) — new card applications + new loan requests
voucherRoutes.get(
  "/activities",
  isAuthenticated,
  allow("vouchers"),
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
  allow("vouchers", "RESTAURANT", "HOTEL", "AFFILIATOR"),
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
  allow("vouchers"),
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
  allow("vouchers"),
  approveLoanSession,
);

// Reject loan session (admin)
voucherRoutes.patch(
  "/sessions/:id/reject",
  isAuthenticated,
  allow("vouchers"),
  rejectLoanSession,
);

// Accept loan session — makes it visible to the selected trader so they can approve (admin)
voucherRoutes.patch(
  "/sessions/:id/accept",
  isAuthenticated,
  allow("vouchers"),
  acceptLoanSession,
);

// Live trader loan-capacity check (admin) — verify a trader can fund an amount before accepting
voucherRoutes.get(
  "/sessions/trader-capacity/:traderId",
  isAuthenticated,
  allow("vouchers"),
  checkTraderLoanCapacity,
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
  allow("vouchers"),
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

// Convert a loan session's remaining credit to the restaurant's prepaid wallet
// (consumes the voucher — user flow when the order total exceeds the loan).
voucherRoutes.post(
  "/sessions/:rrn/convert-to-wallet",
  isAuthenticated,
  checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"),
  convertLoanSessionToWallet,
);

// Repay the outstanding credit on a voucher loan session ("Pay Voucher")
voucherRoutes.post(
  "/sessions/:sessionId/repay",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "HOTEL", "AFFILIATOR"),
  repayLoanSession,
);

// Verify a pending voucher repayment status (restaurant)
voucherRoutes.get(
  "/sessions/:sessionId/repay/verify",
  isAuthenticated,
  allow("vouchers", "RESTAURANT", "HOTEL", "AFFILIATOR"),
  verifyLoanRepayment,
);

// Voucher card system stats (admin)
voucherRoutes.get(
  "/card-stats",
  isAuthenticated,
  allow("vouchers"),
  getVoucherCardStats,
);

/**
 * Get voucher by ID — MUST be last to avoid swallowing static paths
 * GET /vouchers/:id
 */
voucherRoutes.get("/:id", isAuthenticated, getVoucherById);

export default voucherRoutes;
