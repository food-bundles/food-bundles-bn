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
  processVoucherPayment,
  makeRepayment,
  getOutstandingBalance,
  calculatePenalties,
  getVoucherPenalties,
  waivePenalty,
  getRestaurantCreditSummary,
  getVoucherByCode,
} from "../controllers/voucher.controller";
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
  createVoucher
);

/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
voucherRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllVouchers
);

/**
 * Get voucher by ID
 * GET /vouchers/:id
 */
voucherRoutes.get("/:id", isAuthenticated, getVoucherById);

/**
 * Get restaurant's vouchers
 * GET /vouchers/restaurant/:restaurantId
 */
voucherRoutes.get(
  "/restaurant/:restaurantId",
  isAuthenticated,
  getRestaurantVouchers
);

/**
 * Get available vouchers for checkout
 * GET /vouchers/available
 */
voucherRoutes.get(
  "/available",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getAvailableVouchers
);

/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
voucherRoutes.patch(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateVoucher
);

/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
voucherRoutes.delete(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  deactivateVoucher
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
  checkPermission("RESTAURANT"),
  applyForLoan
);

/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
voucherRoutes.get(
  "/loans/my-applications",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyLoanApplications
);

/**
 * Get all loan applications (Admin only)
 * GET /vouchers/loans/applications
 */
voucherRoutes.get(
  "/loans/applications",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllLoanApplications
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
  approveLoan
);

/**
 * Disburse loan (Admin only)
 * POST /vouchers/loans/:id/disburse
 */
voucherRoutes.post(
  "/loans/:id/disburse",
  isAuthenticated,
  checkPermission("ADMIN"),
  disburseLoan
);

/**
 * Reject loan application (Admin only)
 * PATCH /vouchers/loans/:id/reject
 */
voucherRoutes.patch(
  "/loans/:id/reject",
  isAuthenticated,
  checkPermission("ADMIN"),
  rejectLoan
);

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
  checkPermission("RESTAURANT"),
  processVoucherPayment
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
  checkPermission("RESTAURANT"),
  makeRepayment
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
  calculatePenalties
);

/**
 * Waive penalty (Admin only)
 * POST /vouchers/penalties/:id/waive
 */
voucherRoutes.post(
  "/penalties/:id/waive",
  isAuthenticated,
  checkPermission("ADMIN"),
  waivePenalty
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
  checkPermission("RESTAURANT"),
  getRestaurantCreditSummary
);

voucherRoutes.get("/code/:voucherCode", isAuthenticated, getVoucherByCode);

export default voucherRoutes;
