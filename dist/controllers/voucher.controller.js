"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRestaurantCreditSummary = exports.waivePenalty = exports.getVoucherPenalties = exports.calculatePenalties = exports.getOutstandingBalance = exports.makeRepayment = exports.processVoucherPayment = exports.rejectLoan = exports.disburseLoan = exports.approveLoan = exports.getLoanApplicationById = exports.getAllLoanApplications = exports.getMyLoanApplications = exports.applyForLoan = exports.getVoucherByCode = exports.getVoucherTransactions = exports.deactivateVoucher = exports.updateVoucher = exports.getAvailableVouchers = exports.getRestaurantVouchers = exports.getVoucherById = exports.getAllVouchers = exports.createVoucher = void 0;
const voucher_service_1 = require("../services/voucher.service");
// ============================================
// VOUCHER MANAGEMENT CONTROLLERS
// ============================================
/**
 * Create voucher (Admin only)
 * POST /vouchers
 */
const createVoucher = async (req, res) => {
    try {
        const { restaurantId, voucherType, creditLimit, minTransactionAmount, maxTransactionAmount, expiryDate, loanId, } = req.body;
        // Validate required fields
        if (!restaurantId || !voucherType || !creditLimit) {
            return res.status(400).json({
                message: "Restaurant ID, voucher type, and credit limit are required",
            });
        }
        // Validate voucher type
        const validTypes = [
            "DISCOUNT_10",
            "DISCOUNT_20",
            "DISCOUNT_50",
            "DISCOUNT_80",
        ];
        if (!validTypes.includes(voucherType)) {
            return res.status(400).json({
                message: "Invalid voucher type",
            });
        }
        const voucher = await (0, voucher_service_1.createVoucherService)({
            restaurantId,
            voucherType,
            creditLimit: parseFloat(creditLimit),
            minTransactionAmount: minTransactionAmount
                ? parseFloat(minTransactionAmount)
                : undefined,
            maxTransactionAmount: maxTransactionAmount
                ? parseFloat(maxTransactionAmount)
                : undefined,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            loanId,
        });
        res.status(201).json({
            message: "Voucher created successfully",
            data: voucher,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create voucher",
        });
    }
};
exports.createVoucher = createVoucher;
/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
const getAllVouchers = async (req, res) => {
    try {
        const { status, restaurantId } = req.query;
        // For admin, can filter by restaurant
        // For now, we'll implement a simple version
        const filters = {};
        if (status)
            filters.status = status;
        // This would need implementation in service
        res.status(200).json({
            message: "Feature to be implemented - use restaurant-specific endpoint",
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get vouchers",
        });
    }
};
exports.getAllVouchers = getAllVouchers;
/**
 * Get voucher by ID
 * GET /vouchers/:id
 */
const getVoucherById = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        const voucher = await (0, voucher_service_1.getVoucherByIdService)(id);
        // Check authorization
        if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Voucher does not belong to this restaurant",
            });
        }
        res.status(200).json({
            message: "Voucher retrieved successfully",
            data: voucher,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get voucher",
        });
    }
};
exports.getVoucherById = getVoucherById;
/**
 * Get restaurant's vouchers
 * GET /vouchers/restaurant/:restaurantId
 */
const getRestaurantVouchers = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { status, activeOnly } = req.query;
        const userRole = req.user.role;
        const userId = req.user.id;
        // Check authorization
        if (userRole === "RESTAURANT" && restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Cannot access other restaurant's vouchers",
            });
        }
        const filters = {};
        if (status)
            filters.status = status;
        if (activeOnly === "true")
            filters.activeOnly = true;
        const vouchers = await (0, voucher_service_1.getRestaurantVouchersService)(restaurantId, filters);
        res.status(200).json({
            message: "Vouchers retrieved successfully",
            data: vouchers,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get vouchers",
        });
    }
};
exports.getRestaurantVouchers = getRestaurantVouchers;
/**
 * Get available vouchers for checkout
 * GET /vouchers/available
 */
const getAvailableVouchers = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { amount } = req.query;
        if (!amount) {
            return res.status(400).json({
                message: "Order amount is required",
            });
        }
        const vouchers = await (0, voucher_service_1.getAvailableVouchersForCheckoutService)(restaurantId, parseFloat(amount));
        res.status(200).json({
            message: "Available vouchers retrieved successfully",
            data: vouchers,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get available vouchers",
        });
    }
};
exports.getAvailableVouchers = getAvailableVouchers;
/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
const updateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, expiryDate, maxTransactionAmount, minTransactionAmount } = req.body;
        const updateData = {};
        if (status)
            updateData.status = status;
        if (expiryDate)
            updateData.expiryDate = new Date(expiryDate);
        if (maxTransactionAmount)
            updateData.maxTransactionAmount = parseFloat(maxTransactionAmount);
        if (minTransactionAmount)
            updateData.minTransactionAmount = parseFloat(minTransactionAmount);
        const voucher = await (0, voucher_service_1.updateVoucherService)(id, updateData);
        res.status(200).json({
            message: "Voucher updated successfully",
            data: voucher,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update voucher",
        });
    }
};
exports.updateVoucher = updateVoucher;
/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
const deactivateVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const voucher = await (0, voucher_service_1.deactivateVoucherService)(id, reason);
        res.status(200).json({
            message: "Voucher deactivated successfully",
            data: voucher,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to deactivate voucher",
        });
    }
};
exports.deactivateVoucher = deactivateVoucher;
/**
 * Get voucher transaction history
 * GET /vouchers/:id/transactions
 */
const getVoucherTransactions = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        // Get voucher to check ownership
        const voucher = await (0, voucher_service_1.getVoucherByIdService)(id);
        // Check authorization
        if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Voucher does not belong to this restaurant",
            });
        }
        const transactions = await (0, voucher_service_1.getVoucherTransactionHistoryService)(id);
        res.status(200).json({
            message: "Transaction history retrieved successfully",
            data: transactions,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get transaction history",
        });
    }
};
exports.getVoucherTransactions = getVoucherTransactions;
/**
 * Get voucher by code
 * GET /vouchers/code/:voucherCode
 */
const getVoucherByCode = async (req, res) => {
    try {
        const { voucherCode } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        const voucher = await (0, voucher_service_1.getVoucherByCodeService)(voucherCode);
        // Check authorization - restaurants can only see their own vouchers
        if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Voucher does not belong to this restaurant",
            });
        }
        res.status(200).json({
            message: "Voucher retrieved successfully",
            data: voucher,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get voucher",
        });
    }
};
exports.getVoucherByCode = getVoucherByCode;
// ============================================
// LOAN APPLICATION CONTROLLERS
// ============================================
/**
 * Submit loan application (Restaurant)
 * POST /vouchers/loans/apply
 */
const applyForLoan = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { requestedAmount, purpose, terms } = req.body;
        if (!requestedAmount) {
            return res.status(400).json({
                message: "Requested amount is required",
            });
        }
        const loanApplication = await (0, voucher_service_1.submitLoanApplicationService)({
            restaurantId,
            requestedAmount: parseFloat(requestedAmount),
            purpose,
            terms,
        });
        res.status(201).json({
            message: "Loan application submitted successfully",
            data: loanApplication,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to submit loan application",
        });
    }
};
exports.applyForLoan = applyForLoan;
/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
const getMyLoanApplications = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const loans = await (0, voucher_service_1.getRestaurantLoanApplicationsService)(restaurantId);
        res.status(200).json({
            message: "Loan applications retrieved successfully",
            data: loans,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get loan applications",
        });
    }
};
exports.getMyLoanApplications = getMyLoanApplications;
/**
 * Get all loan applications (Admin)
 * GET /vouchers/loans/applications
 */
const getAllLoanApplications = async (req, res) => {
    try {
        const { status, restaurantId } = req.query;
        const filters = {};
        if (status)
            filters.status = status;
        if (restaurantId)
            filters.restaurantId = restaurantId;
        const loans = await (0, voucher_service_1.getAllLoanApplicationsService)(filters);
        res.status(200).json({
            message: "Loan applications retrieved successfully",
            data: loans,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get loan applications",
        });
    }
};
exports.getAllLoanApplications = getAllLoanApplications;
/**
 * Get loan application by ID
 * GET /vouchers/loans/:id
 */
const getLoanApplicationById = async (req, res) => {
    try {
        const { id } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        const loan = await (0, voucher_service_1.getLoanApplicationByIdService)(id);
        // Check authorization
        if (userRole === "RESTAURANT" && loan.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Loan does not belong to this restaurant",
            });
        }
        res.status(200).json({
            message: "Loan application retrieved successfully",
            data: loan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get loan application",
        });
    }
};
exports.getLoanApplicationById = getLoanApplicationById;
/**
 * Approve loan application (Admin)
 * PATCH /vouchers/loans/:id/approve
 */
const approveLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const { approvedAmount, repaymentDays, voucherType, notes } = req.body;
        if (!approvedAmount || !voucherType) {
            return res.status(400).json({
                message: "Approved amount and voucher type are required",
            });
        }
        const loan = await (0, voucher_service_1.approveLoanApplicationService)(id, {
            approvedAmount: parseFloat(approvedAmount),
            approvedBy: adminId,
            repaymentDays: repaymentDays ? parseInt(repaymentDays) : 30,
            voucherType,
            notes,
        });
        res.status(200).json({
            message: "Loan approved successfully",
            data: loan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to approve loan",
        });
    }
};
exports.approveLoan = approveLoan;
/**
 * Disburse loan (Admin)
 * POST /vouchers/loans/:id/disburse
 */
const disburseLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const result = await (0, voucher_service_1.disburseLoanService)(id, adminId);
        res.status(200).json({
            message: "Loan disbursed successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to disburse loan",
        });
    }
};
exports.disburseLoan = disburseLoan;
/**
 * Reject loan application (Admin)
 * PATCH /vouchers/loans/:id/reject
 */
const rejectLoan = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const { reason } = req.body;
        const loan = await (0, voucher_service_1.rejectLoanApplicationService)(id, adminId, reason);
        res.status(200).json({
            message: "Loan rejected successfully",
            data: loan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to reject loan",
        });
    }
};
exports.rejectLoan = rejectLoan;
// ============================================
// VOUCHER PAYMENT CONTROLLERS
// ============================================
/**
 * Process voucher payment (used during checkout)
 * POST /vouchers/checkout/voucher
 */
const processVoucherPayment = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { voucherId, orderId, originalAmount } = req.body;
        if (!voucherId || !orderId || !originalAmount) {
            return res.status(400).json({
                message: "Voucher ID, order ID, and original amount are required",
            });
        }
        const result = await (0, voucher_service_1.processVoucherPaymentService)({
            voucherId,
            orderId,
            restaurantId,
            originalAmount: parseFloat(originalAmount),
        });
        res.status(200).json({
            message: "Voucher payment processed successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to process voucher payment",
        });
    }
};
exports.processVoucherPayment = processVoucherPayment;
// ============================================
// REPAYMENT CONTROLLERS
// ============================================
/**
 * Make repayment (Restaurant)
 * POST /vouchers/:id/repay
 */
const makeRepayment = async (req, res) => {
    try {
        const { id: voucherId } = req.params;
        const restaurantId = req.user.id;
        const { amount, paymentMethod, paymentReference, loanId } = req.body;
        if (!amount || !paymentMethod || !loanId) {
            return res.status(400).json({
                message: "Amount, payment method, and loan ID are required",
            });
        }
        const result = await (0, voucher_service_1.processRepaymentService)({
            restaurantId,
            loanId,
            amount: parseFloat(amount),
            paymentMethod,
            paymentReference,
            voucherId,
        });
        res.status(200).json({
            message: "Repayment processed successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to process repayment",
        });
    }
};
exports.makeRepayment = makeRepayment;
/**
 * Get outstanding balance
 * GET /vouchers/:id/outstanding
 */
const getOutstandingBalance = async (req, res) => {
    try {
        const { id: voucherId } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        // Get voucher to get loan ID
        const voucher = await (0, voucher_service_1.getVoucherByIdService)(voucherId);
        // Check authorization
        if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Voucher does not belong to this restaurant",
            });
        }
        if (!voucher.loanId) {
            return res.status(400).json({
                message: "Voucher is not associated with a loan",
            });
        }
        const outstanding = await (0, voucher_service_1.calculateOutstandingBalanceService)(voucher.loanId);
        res.status(200).json({
            message: "Outstanding balance retrieved successfully",
            data: outstanding,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get outstanding balance",
        });
    }
};
exports.getOutstandingBalance = getOutstandingBalance;
// ============================================
// PENALTY CONTROLLERS
// ============================================
/**
 * Calculate penalties (Admin/System)
 * POST /vouchers/penalties/calculate
 */
const calculatePenalties = async (req, res) => {
    try {
        const { loanId, penaltyRatePerMonth } = req.body;
        const results = await (0, voucher_service_1.calculatePenaltiesService)(loanId, penaltyRatePerMonth ? parseFloat(penaltyRatePerMonth) : 2);
        res.status(200).json({
            message: "Penalties calculated successfully",
            data: results,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to calculate penalties",
        });
    }
};
exports.calculatePenalties = calculatePenalties;
/**
 * Get penalties for voucher
 * GET /vouchers/:id/penalties
 */
const getVoucherPenalties = async (req, res) => {
    try {
        const { id: voucherId } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;
        // Get voucher to get loan ID
        const voucher = await (0, voucher_service_1.getVoucherByIdService)(voucherId);
        // Check authorization
        if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
            return res.status(403).json({
                message: "Unauthorized: Voucher does not belong to this restaurant",
            });
        }
        if (!voucher.loanId) {
            return res.status(400).json({
                message: "Voucher is not associated with a loan",
            });
        }
        const penalties = await (0, voucher_service_1.getLoanPenaltiesService)(voucher.loanId);
        res.status(200).json({
            message: "Penalties retrieved successfully",
            data: penalties,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get penalties",
        });
    }
};
exports.getVoucherPenalties = getVoucherPenalties;
/**
 * Waive penalty (Admin)
 * POST /vouchers/penalties/:id/waive
 */
const waivePenalty = async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;
        const { reason } = req.body;
        const penalty = await (0, voucher_service_1.waivePenaltyService)(id, adminId, reason);
        res.status(200).json({
            message: "Penalty waived successfully",
            data: penalty,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to waive penalty",
        });
    }
};
exports.waivePenalty = waivePenalty;
// ============================================
// CREDIT SUMMARY CONTROLLERS
// ============================================
/**
 * Get restaurant credit summary
 * GET /vouchers/credit-summary
 */
const getRestaurantCreditSummary = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const summary = await (0, voucher_service_1.getRestaurantCreditSummaryService)(restaurantId);
        res.status(200).json({
            message: "Credit summary retrieved successfully",
            data: summary,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get credit summary",
        });
    }
};
exports.getRestaurantCreditSummary = getRestaurantCreditSummary;
