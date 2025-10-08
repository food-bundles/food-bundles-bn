"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const voucher_controller_1 = require("../controllers/voucher.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const voucherRoutes = (0, express_1.Router)();
// ========================================
// VOUCHER MANAGEMENT ROUTES
// ========================================
/**
 * Create voucher (Admin only)
 * POST /vouchers
 */
voucherRoutes.post("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.createVoucher);
/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
voucherRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.getAllVouchers);
/**
 * Get voucher by ID
 * GET /vouchers/:id
 */
voucherRoutes.get("/:id", authMiddleware_1.isAuthenticated, voucher_controller_1.getVoucherById);
/**
 * Get restaurant's vouchers
 * GET /vouchers/restaurant/:restaurantId
 */
voucherRoutes.get("/restaurant/:restaurantId", authMiddleware_1.isAuthenticated, voucher_controller_1.getRestaurantVouchers);
/**
 * Get available vouchers for checkout
 * GET /vouchers/available
 */
voucherRoutes.get("/available", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.getAvailableVouchers);
/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
voucherRoutes.patch("/:id", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.updateVoucher);
/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
voucherRoutes.delete("/:id", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.deactivateVoucher);
/**
 * Get voucher transaction history
 * GET /vouchers/:id/transactions
 */
voucherRoutes.get("/:id/transactions", authMiddleware_1.isAuthenticated, voucher_controller_1.getVoucherTransactions);
// ========================================
// LOAN MANAGEMENT ROUTES
// ========================================
/**
 * Submit loan application (Restaurant)
 * POST /vouchers/loans/apply
 */
voucherRoutes.post("/loans/apply", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.applyForLoan);
/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
voucherRoutes.get("/loans/my-applications", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.getMyLoanApplications);
/**
 * Get all loan applications (Admin only)
 * GET /vouchers/loans/applications
 */
voucherRoutes.get("/loans/applications", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.getAllLoanApplications);
/**
 * Get loan application by ID
 * GET /vouchers/loans/:id
 */
voucherRoutes.get("/loans/:id", authMiddleware_1.isAuthenticated, voucher_controller_1.getLoanApplicationById);
/**
 * Approve loan application (Admin only)
 * PATCH /vouchers/loans/:id/approve
 */
voucherRoutes.patch("/loans/:id/approve", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.approveLoan);
/**
 * Disburse loan (Admin only)
 * POST /vouchers/loans/:id/disburse
 */
voucherRoutes.post("/loans/:id/disburse", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.disburseLoan);
/**
 * Reject loan application (Admin only)
 * PATCH /vouchers/loans/:id/reject
 */
voucherRoutes.patch("/loans/:id/reject", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.rejectLoan);
// ========================================
// VOUCHER PAYMENT ROUTES
// ========================================
/**
 * Process voucher payment (used during checkout)
 * POST /vouchers/checkout/voucher
 */
voucherRoutes.post("/checkout/voucher", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.processVoucherPayment);
// ========================================
// REPAYMENT & PENALTY ROUTES
// ========================================
/**
 * Make repayment (Restaurant)
 * POST /vouchers/:id/repay
 */
voucherRoutes.post("/:id/repay", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.makeRepayment);
/**
 * Get outstanding balance
 * GET /vouchers/:id/outstanding
 */
voucherRoutes.get("/:id/outstanding", authMiddleware_1.isAuthenticated, voucher_controller_1.getOutstandingBalance);
/**
 * Get penalties for voucher
 * GET /vouchers/:id/penalties
 */
voucherRoutes.get("/:id/penalties", authMiddleware_1.isAuthenticated, voucher_controller_1.getVoucherPenalties);
/**
 * Calculate penalties (Admin/System)
 * POST /vouchers/penalties/calculate
 */
voucherRoutes.post("/penalties/calculate", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.calculatePenalties);
/**
 * Waive penalty (Admin only)
 * POST /vouchers/penalties/:id/waive
 */
voucherRoutes.post("/penalties/:id/waive", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), voucher_controller_1.waivePenalty);
// ========================================
// CREDIT SUMMARY ROUTES
// ========================================
/**
 * Get restaurant credit summary
 * GET /vouchers/credit-summary
 */
voucherRoutes.get("/credit-summary", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), voucher_controller_1.getRestaurantCreditSummary);
voucherRoutes.get("/code/:voucherCode", authMiddleware_1.isAuthenticated, voucher_controller_1.getVoucherByCode);
exports.default = voucherRoutes;
