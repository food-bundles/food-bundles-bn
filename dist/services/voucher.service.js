"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRestaurantCreditSummaryService = exports.getVoucherTransactionHistoryService = exports.waivePenaltyService = exports.getLoanPenaltiesService = exports.calculatePenaltiesService = exports.calculateOutstandingBalanceService = exports.processRepaymentService = exports.processVoucherPaymentService = exports.rejectLoanApplicationService = exports.disburseLoanService = exports.approveLoanApplicationService = exports.getAllLoanApplicationsService = exports.getRestaurantLoanApplicationsService = exports.getLoanApplicationByIdService = exports.submitLoanApplicationService = exports.deactivateVoucherService = exports.updateVoucherService = exports.getAvailableVouchersForCheckoutService = exports.getRestaurantVouchersService = exports.getVoucherByCodeService = exports.getVoucherByIdService = exports.createVoucherService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
// ============================================
// VOUCHER CRUD SERVICES
// ============================================
/**
 * Create a new voucher
 */
const createVoucherService = async (data) => {
    const { restaurantId, voucherType, creditLimit, minTransactionAmount = 0, maxTransactionAmount, expiryDate, loanId, } = data;
    // Validate restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Generate unique voucher code
    const voucherCode = await generateVoucherCode();
    // Determine discount percentage based on type
    const discountMap = {
        DISCOUNT_10: 10,
        DISCOUNT_20: 20,
        DISCOUNT_50: 50,
        DISCOUNT_80: 80,
    };
    const discountPercentage = discountMap[voucherType];
    // Create voucher
    const voucher = await prisma_1.default.voucher.create({
        data: {
            voucherCode,
            voucherType,
            discountPercentage,
            creditLimit,
            totalCredit: creditLimit,
            remainingCredit: creditLimit,
            minTransactionAmount,
            maxTransactionAmount,
            expiryDate,
            restaurantId,
            loanId,
            status: client_1.VoucherStatus.ACTIVE,
        },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            loan: true,
        },
    });
    return voucher;
};
exports.createVoucherService = createVoucherService;
/**
 * Get voucher by ID
 */
const getVoucherByIdService = async (voucherId) => {
    const voucher = await prisma_1.default.voucher.findUnique({
        where: { id: voucherId },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            loan: true,
            transactions: {
                orderBy: { createdAt: "desc" },
                take: 10,
            },
            repayments: {
                orderBy: { createdAt: "desc" },
                take: 10,
            },
            penalties: {
                where: { status: client_1.PenaltyStatus.PENDING },
            },
        },
    });
    if (!voucher) {
        throw new Error("Voucher not found");
    }
    return voucher;
};
exports.getVoucherByIdService = getVoucherByIdService;
/**
 * Get voucher by code
 */
const getVoucherByCodeService = async (voucherCode) => {
    const voucher = await prisma_1.default.voucher.findUnique({
        where: { voucherCode },
        include: {
            restaurant: true,
            loan: true,
        },
    });
    if (!voucher) {
        throw new Error("Voucher not found");
    }
    return voucher;
};
exports.getVoucherByCodeService = getVoucherByCodeService;
/**
 * Get restaurant's vouchers
 */
const getRestaurantVouchersService = async (restaurantId, filters) => {
    const where = { restaurantId };
    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.activeOnly) {
        where.status = client_1.VoucherStatus.ACTIVE;
        where.expiryDate = {
            gte: new Date(),
        };
    }
    const vouchers = await prisma_1.default.voucher.findMany({
        where,
        include: {
            loan: true,
            transactions: {
                orderBy: { createdAt: "desc" },
                take: 5,
            },
            penalties: {
                where: { status: client_1.PenaltyStatus.PENDING },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return vouchers;
};
exports.getRestaurantVouchersService = getRestaurantVouchersService;
/**
 * Get available vouchers for checkout
 */
const getAvailableVouchersForCheckoutService = async (restaurantId, orderAmount) => {
    const vouchers = await prisma_1.default.voucher.findMany({
        where: {
            restaurantId,
            status: client_1.VoucherStatus.ACTIVE,
            remainingCredit: { gte: orderAmount },
            minTransactionAmount: { lte: orderAmount },
            OR: [
                { maxTransactionAmount: null },
                { maxTransactionAmount: { gte: orderAmount } },
                { expiryDate: null },
                { expiryDate: { gte: new Date() } },
            ],
        },
        include: {
            loan: true,
        },
        orderBy: { discountPercentage: "desc" }, // Show highest discount first
    });
    return vouchers;
    return vouchers;
};
exports.getAvailableVouchersForCheckoutService = getAvailableVouchersForCheckoutService;
/**
 * Update voucher
 */
const updateVoucherService = async (voucherId, data) => {
    const voucher = await prisma_1.default.voucher.update({
        where: { id: voucherId },
        data,
        include: {
            restaurant: true,
            loan: true,
        },
    });
    return voucher;
};
exports.updateVoucherService = updateVoucherService;
/**
 * Deactivate/Suspend voucher
 */
const deactivateVoucherService = async (voucherId, reason) => {
    const voucher = await prisma_1.default.voucher.update({
        where: { id: voucherId },
        data: {
            status: client_1.VoucherStatus.SUSPENDED,
        },
    });
    return voucher;
};
exports.deactivateVoucherService = deactivateVoucherService;
// ============================================
// LOAN APPLICATION SERVICES
// ============================================
/**
 * Submit loan application
 */
const submitLoanApplicationService = async (data) => {
    const { restaurantId, requestedAmount, purpose, terms } = data;
    // Validate restaurant
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Check for pending applications
    const pendingApplication = await prisma_1.default.loanApplication.findFirst({
        where: {
            restaurantId,
            status: { in: [client_1.LoanStatus.PENDING, client_1.LoanStatus.APPROVED] },
        },
    });
    if (pendingApplication) {
        throw new Error("You already have a pending loan application");
    }
    // Create loan application
    const loanApplication = await prisma_1.default.loanApplication.create({
        data: {
            restaurantId,
            requestedAmount,
            purpose,
            terms,
            status: client_1.LoanStatus.PENDING,
        },
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });
    return loanApplication;
};
exports.submitLoanApplicationService = submitLoanApplicationService;
/**
 * Get loan application by ID
 */
const getLoanApplicationByIdService = async (loanId) => {
    const loan = await prisma_1.default.loanApplication.findUnique({
        where: { id: loanId },
        include: {
            restaurant: true,
            approver: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
            vouchers: true,
            repayments: {
                orderBy: { createdAt: "desc" },
            },
        },
    });
    if (!loan) {
        throw new Error("Loan application not found");
    }
    return loan;
};
exports.getLoanApplicationByIdService = getLoanApplicationByIdService;
/**
 * Get restaurant's loan applications
 */
const getRestaurantLoanApplicationsService = async (restaurantId) => {
    const loans = await prisma_1.default.loanApplication.findMany({
        where: { restaurantId },
        include: {
            vouchers: true,
            repayments: {
                orderBy: { createdAt: "desc" },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return loans;
};
exports.getRestaurantLoanApplicationsService = getRestaurantLoanApplicationsService;
/**
 * Get all loan applications (Admin)
 */
const getAllLoanApplicationsService = async (filters) => {
    const where = {};
    if (filters?.status) {
        where.status = filters.status;
    }
    if (filters?.restaurantId) {
        where.restaurantId = filters.restaurantId;
    }
    const loans = await prisma_1.default.loanApplication.findMany({
        where,
        include: {
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            approver: {
                select: {
                    id: true,
                    username: true,
                },
            },
            vouchers: true,
        },
        orderBy: { createdAt: "desc" },
    });
    return loans;
};
exports.getAllLoanApplicationsService = getAllLoanApplicationsService;
/**
 * Approve loan application
 */
const approveLoanApplicationService = async (loanId, approvalData) => {
    const { approvedAmount, approvedBy, repaymentDays = 30, voucherType, notes, } = approvalData;
    // Get loan application
    const loan = await (0, exports.getLoanApplicationByIdService)(loanId);
    if (loan.status !== client_1.LoanStatus.PENDING) {
        throw new Error(`Cannot approve loan with status: ${loan.status}`);
    }
    // Update loan to approved
    const disbursementDate = new Date();
    const repaymentDueDate = new Date();
    repaymentDueDate.setDate(repaymentDueDate.getDate() + repaymentDays);
    const updatedLoan = await prisma_1.default.loanApplication.update({
        where: { id: loanId },
        data: {
            status: client_1.LoanStatus.APPROVED,
            approvedAmount,
            approvedBy,
            approvedAt: new Date(),
            notes,
        },
        include: {
            restaurant: true,
        },
    });
    return updatedLoan;
};
exports.approveLoanApplicationService = approveLoanApplicationService;
/**
 * Disburse approved loan (creates voucher)
 */
const disburseLoanService = async (loanId, adminId) => {
    const loan = await (0, exports.getLoanApplicationByIdService)(loanId);
    if (loan.status !== client_1.LoanStatus.APPROVED) {
        throw new Error(`Cannot disburse loan with status: ${loan.status}`);
    }
    if (!loan.approvedAmount) {
        throw new Error("No approved amount found");
    }
    // Determine voucher type (admin should have set this during approval)
    // For now, use DISCOUNT_20 as default
    const voucherType = "DISCOUNT_20";
    // Calculate expiry date (3 months from now)
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 3);
    // Calculate repayment due date (30 days from disbursement)
    const repaymentDueDate = new Date();
    repaymentDueDate.setDate(repaymentDueDate.getDate() + 30);
    // Create voucher and update loan in transaction
    const result = await prisma_1.default.$transaction(async (tx) => {
        // Create voucher
        const voucher = await (0, exports.createVoucherService)({
            restaurantId: loan.restaurantId,
            voucherType,
            creditLimit: loan.approvedAmount ?? 0,
            expiryDate,
            loanId: loan.id,
        });
        // Update loan status
        const updatedLoan = await tx.loanApplication.update({
            where: { id: loanId },
            data: {
                status: client_1.LoanStatus.DISBURSED,
                disbursementDate: new Date(),
                repaymentDueDate,
            },
            include: {
                restaurant: true,
                vouchers: true,
            },
        });
        return { loan: updatedLoan, voucher };
    });
    return result;
};
exports.disburseLoanService = disburseLoanService;
/**
 * Reject loan application
 */
const rejectLoanApplicationService = async (loanId, adminId, reason) => {
    const loan = await (0, exports.getLoanApplicationByIdService)(loanId);
    if (loan.status !== client_1.LoanStatus.PENDING) {
        throw new Error(`Cannot reject loan with status: ${loan.status}`);
    }
    const updatedLoan = await prisma_1.default.loanApplication.update({
        where: { id: loanId },
        data: {
            status: client_1.LoanStatus.REJECTED,
            approvedBy: adminId,
            notes: reason,
            approvedAt: new Date(),
        },
        include: {
            restaurant: true,
        },
    });
    return updatedLoan;
};
exports.rejectLoanApplicationService = rejectLoanApplicationService;
// ============================================
// VOUCHER PAYMENT PROCESSING
// ============================================
/**
 * Process voucher payment
 */
const processVoucherPaymentService = async (data) => {
    const { voucherId, orderId, restaurantId, originalAmount } = data;
    // Get and validate voucher
    const voucher = await (0, exports.getVoucherByIdService)(voucherId);
    // Validate voucher eligibility
    validateVoucherEligibility(voucher, originalAmount, restaurantId);
    // Calculate payment amounts
    const discountAmount = originalAmount * (voucher.discountPercentage / 100);
    const amountCharged = originalAmount - discountAmount;
    const serviceFee = amountCharged * (voucher.serviceFeeRate / 100);
    const totalDeducted = amountCharged + serviceFee;
    // Check sufficient credit
    if (voucher.remainingCredit < totalDeducted) {
        throw new Error(`Insufficient voucher credit. Available: ${voucher.remainingCredit}, Required: ${totalDeducted}`);
    }
    // Process payment in transaction
    const result = await prisma_1.default.$transaction(async (tx) => {
        // Create voucher transaction
        const transaction = await tx.voucherTransaction.create({
            data: {
                voucherId,
                orderId,
                restaurantId,
                originalAmount,
                discountPercentage: voucher.discountPercentage,
                discountAmount,
                amountCharged,
                serviceFee,
                totalDeducted,
            },
        });
        // Update voucher balance
        const updatedVoucher = await tx.voucher.update({
            where: { id: voucherId },
            data: {
                usedCredit: { increment: totalDeducted },
                remainingCredit: { decrement: totalDeducted },
                status: voucher.remainingCredit - totalDeducted <= 0
                    ? client_1.VoucherStatus.USED
                    : client_1.VoucherStatus.ACTIVE,
            },
        });
        return { transaction, voucher: updatedVoucher };
    });
    return result;
};
exports.processVoucherPaymentService = processVoucherPaymentService;
/**
 * Validate voucher eligibility
 */
function validateVoucherEligibility(voucher, amount, restaurantId) {
    // Check restaurant ownership
    if (voucher.restaurantId !== restaurantId) {
        throw new Error("Voucher does not belong to this restaurant");
    }
    // Check status
    if (voucher.status !== client_1.VoucherStatus.ACTIVE) {
        throw new Error(`Voucher is ${voucher.status.toLowerCase()}`);
    }
    // Check expiry
    if (voucher.expiryDate && new Date() > new Date(voucher.expiryDate)) {
        throw new Error("Voucher has expired");
    }
    // Check min/max transaction amounts
    if (amount < voucher.minTransactionAmount) {
        throw new Error(`Transaction amount must be at least ${voucher.minTransactionAmount}`);
    }
    if (voucher.maxTransactionAmount && amount > voucher.maxTransactionAmount) {
        throw new Error(`Transaction amount cannot exceed ${voucher.maxTransactionAmount}`);
    }
    // Check remaining credit
    if (voucher.remainingCredit <= 0) {
        throw new Error("Voucher has no remaining credit");
    }
}
// ============================================
// REPAYMENT SERVICES
// ============================================
/**
 * Process repayment
 */
const processRepaymentService = async (data) => {
    const { restaurantId, loanId, amount, paymentMethod, paymentReference, voucherId, } = data;
    // Get loan details
    const loan = await (0, exports.getLoanApplicationByIdService)(loanId);
    if (loan.restaurantId !== restaurantId) {
        throw new Error("Loan does not belong to this restaurant");
    }
    if (loan.status !== client_1.LoanStatus.DISBURSED) {
        throw new Error(`Cannot make repayment for loan with status: ${loan.status}`);
    }
    // Calculate outstanding balance
    const outstanding = await (0, exports.calculateOutstandingBalanceService)(loanId);
    if (amount > outstanding.total) {
        throw new Error(`Repayment amount (${amount}) exceeds outstanding balance (${outstanding.total})`);
    }
    // Allocate payment (priority: penalties, service fees, principal)
    let remainingAmount = amount;
    let allocatedToPenalty = 0;
    let allocatedToServiceFee = 0;
    let allocatedToPrincipal = 0;
    // Allocate to penalties first
    if (outstanding.penalties > 0) {
        allocatedToPenalty = Math.min(remainingAmount, outstanding.penalties);
        remainingAmount -= allocatedToPenalty;
    }
    // Then to service fees
    if (remainingAmount > 0 && outstanding.totalServiceFees > 0) {
        allocatedToServiceFee = Math.min(remainingAmount, outstanding.totalServiceFees);
        remainingAmount -= allocatedToServiceFee;
    }
    // Finally to principal
    if (remainingAmount > 0) {
        allocatedToPrincipal = remainingAmount;
    }
    // Create repayment record
    const repayment = await prisma_1.default.voucherRepayment.create({
        data: {
            voucherId,
            restaurantId,
            loanId,
            amount,
            paymentMethod,
            paymentReference,
            allocatedToPrincipal,
            allocatedToServiceFee,
            allocatedToPenalty,
        },
        include: {
            voucher: true,
            loan: true,
        },
    });
    // Mark penalties as paid if fully covered
    if (allocatedToPenalty > 0) {
        await markPenaltiesAsPaid(loanId, allocatedToPenalty);
    }
    // Check if loan is fully paid
    const newOutstanding = await (0, exports.calculateOutstandingBalanceService)(loanId);
    if (newOutstanding.total <= 0) {
        await prisma_1.default.loanApplication.update({
            where: { id: loanId },
            data: { status: client_1.LoanStatus.SETTLED },
        });
        // Mark all vouchers as settled
        if (voucherId) {
            await prisma_1.default.voucher.update({
                where: { id: voucherId },
                data: { status: client_1.VoucherStatus.SETTLED },
            });
        }
    }
    return { repayment, newOutstanding };
};
exports.processRepaymentService = processRepaymentService;
/**
 * Calculate outstanding balance
 */
const calculateOutstandingBalanceService = async (loanId) => {
    const loan = await (0, exports.getLoanApplicationByIdService)(loanId);
    if (!loan.approvedAmount) {
        throw new Error("Loan has no approved amount");
    }
    // Get all voucher transactions for this loan
    const transactions = await prisma_1.default.voucherTransaction.findMany({
        where: {
            voucher: {
                loanId,
            },
        },
    });
    // Get all repayments
    const repayments = await prisma_1.default.voucherRepayment.findMany({
        where: { loanId },
    });
    // Get pending penalties
    const penalties = await prisma_1.default.voucherPenalty.findMany({
        where: {
            voucher: {
                loanId,
            },
            status: client_1.PenaltyStatus.PENDING,
        },
    });
    // Calculate totals
    const totalUsed = transactions.reduce((sum, t) => sum + t.amountCharged, 0);
    const totalServiceFees = transactions.reduce((sum, t) => sum + t.serviceFee, 0);
    const totalPenalties = penalties.reduce((sum, p) => sum + p.penaltyAmount, 0);
    const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
    const repaidPrincipal = repayments.reduce((sum, r) => sum + r.allocatedToPrincipal, 0);
    const repaidServiceFees = repayments.reduce((sum, r) => sum + r.allocatedToServiceFee, 0);
    const repaidPenalties = repayments.reduce((sum, r) => sum + r.allocatedToPenalty, 0);
    const outstandingPrincipal = totalUsed - repaidPrincipal;
    const outstandingServiceFees = totalServiceFees - repaidServiceFees;
    const outstandingPenalties = totalPenalties - repaidPenalties;
    const total = outstandingPrincipal + outstandingServiceFees + outstandingPenalties;
    return {
        totalCredit: loan.approvedAmount,
        totalUsed,
        totalServiceFees,
        totalPenalties,
        totalRepayments,
        outstandingPrincipal,
        outstandingServiceFees,
        outstandingPenalties,
        total,
        transactions: transactions.length,
        repayments: repayments.length,
        penalties: penalties.length,
    };
};
exports.calculateOutstandingBalanceService = calculateOutstandingBalanceService;
/**
 * Mark penalties as paid
 */
async function markPenaltiesAsPaid(loanId, amountPaid) {
    const penalties = await prisma_1.default.voucherPenalty.findMany({
        where: {
            voucher: { loanId },
            status: client_1.PenaltyStatus.PENDING,
        },
        orderBy: { appliedDate: "asc" }, // Pay oldest first
    });
    let remainingAmount = amountPaid;
    for (const penalty of penalties) {
        if (remainingAmount <= 0)
            break;
        if (remainingAmount >= penalty.penaltyAmount) {
            // Fully pay this penalty
            await prisma_1.default.voucherPenalty.update({
                where: { id: penalty.id },
                data: {
                    status: client_1.PenaltyStatus.PAID,
                    paidDate: new Date(),
                },
            });
            remainingAmount -= penalty.penaltyAmount;
        }
    }
}
// ============================================
// PENALTY SERVICES
// ============================================
/**
 * Calculate and apply penalties for overdue loans
 */
const calculatePenaltiesService = async (loanId, penaltyRatePerMonth = 2 // 2% per month default
) => {
    let loans;
    if (loanId) {
        loans = [await (0, exports.getLoanApplicationByIdService)(loanId)];
    }
    else {
        // Get all disbursed loans
        loans = await prisma_1.default.loanApplication.findMany({
            where: {
                status: client_1.LoanStatus.DISBURSED,
            },
            include: {
                vouchers: true,
            },
        });
    }
    const results = [];
    for (const loan of loans) {
        if (!loan.repaymentDueDate)
            continue;
        const daysOverdue = Math.floor((new Date().getTime() - new Date(loan.repaymentDueDate).getTime()) /
            (1000 * 60 * 60 * 24));
        if (daysOverdue <= 0)
            continue; // Not overdue
        // Calculate outstanding balance
        const outstanding = await (0, exports.calculateOutstandingBalanceService)(loan.id);
        if (outstanding.total <= 0)
            continue; // Already paid
        // Calculate penalty
        const monthsOverdue = daysOverdue / 30;
        const penaltyAmount = outstanding.outstandingPrincipal *
            (penaltyRatePerMonth / 100) *
            monthsOverdue;
        // Check if penalty already exists for this period
        const existingPenalty = await prisma_1.default.voucherPenalty.findFirst({
            where: {
                voucher: { loanId: loan.id },
                status: client_1.PenaltyStatus.PENDING,
                daysOverdue,
            },
        });
        if (existingPenalty)
            continue; // Already applied
        // Create penalty for each voucher in the loan
        for (const voucher of loan.vouchers) {
            const penalty = await prisma_1.default.voucherPenalty.create({
                data: {
                    voucherId: voucher.id,
                    restaurantId: loan.restaurantId,
                    penaltyAmount,
                    daysOverdue,
                    penaltyRate: penaltyRatePerMonth,
                    reason: `Penalty for ${daysOverdue} days overdue (${monthsOverdue.toFixed(2)} months)`,
                    status: client_1.PenaltyStatus.PENDING,
                },
            });
            results.push({
                loanId: loan.id,
                voucherId: voucher.id,
                penalty,
                daysOverdue,
            });
        }
        // Check for severe delinquency (>60 days) and suspend vouchers
        if (daysOverdue > 60) {
            await prisma_1.default.voucher.updateMany({
                where: { loanId: loan.id },
                data: { status: client_1.VoucherStatus.SUSPENDED },
            });
        }
    }
    return results;
};
exports.calculatePenaltiesService = calculatePenaltiesService;
/**
 * Get penalties for a loan
 */
const getLoanPenaltiesService = async (loanId) => {
    const penalties = await prisma_1.default.voucherPenalty.findMany({
        where: {
            voucher: { loanId },
        },
        include: {
            voucher: true,
        },
        orderBy: { appliedDate: "desc" },
    });
    const summary = {
        total: penalties.reduce((sum, p) => sum + p.penaltyAmount, 0),
        pending: penalties
            .filter((p) => p.status === client_1.PenaltyStatus.PENDING)
            .reduce((sum, p) => sum + p.penaltyAmount, 0),
        paid: penalties
            .filter((p) => p.status === client_1.PenaltyStatus.PAID)
            .reduce((sum, p) => sum + p.penaltyAmount, 0),
        penalties,
    };
    return summary;
};
exports.getLoanPenaltiesService = getLoanPenaltiesService;
/**
 * Waive penalty (Admin only)
 */
const waivePenaltyService = async (penaltyId, adminId, reason) => {
    const penalty = await prisma_1.default.voucherPenalty.update({
        where: { id: penaltyId },
        data: {
            status: client_1.PenaltyStatus.WAIVED,
        },
    });
    return penalty;
};
exports.waivePenaltyService = waivePenaltyService;
// ============================================
// UTILITY FUNCTIONS
// ============================================
/**
 * Generate unique voucher code
 */
async function generateVoucherCode() {
    const prefix = "VCH";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}-${timestamp}-${random}`;
    // Check if code exists
    const existing = await prisma_1.default.voucher.findUnique({
        where: { voucherCode: code },
    });
    if (existing) {
        return generateVoucherCode(); // Regenerate if collision
    }
    return code;
}
/**
 * Get voucher transaction history
 */
const getVoucherTransactionHistoryService = async (voucherId) => {
    const transactions = await prisma_1.default.voucherTransaction.findMany({
        where: { voucherId },
        include: {
            order: {
                select: {
                    id: true,
                    orderNumber: true,
                    totalAmount: true,
                    status: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return transactions;
};
exports.getVoucherTransactionHistoryService = getVoucherTransactionHistoryService;
/**
 * Get credit summary for restaurant
 */
const getRestaurantCreditSummaryService = async (restaurantId) => {
    // Get all vouchers
    const vouchers = await prisma_1.default.voucher.findMany({
        where: { restaurantId },
        include: {
            loan: true,
            transactions: true,
            penalties: {
                where: { status: client_1.PenaltyStatus.PENDING },
            },
        },
    });
    // Calculate totals
    const totalCreditIssued = vouchers.reduce((sum, v) => sum + v.totalCredit, 0);
    const totalUsed = vouchers.reduce((sum, v) => sum + v.usedCredit, 0);
    const totalRemaining = vouchers.reduce((sum, v) => sum + v.remainingCredit, 0);
    // Get all transactions
    const allTransactions = vouchers.flatMap((v) => v.transactions);
    const totalServiceFees = allTransactions.reduce((sum, t) => sum + t.serviceFee, 0);
    // Get all penalties
    const allPenalties = vouchers.flatMap((v) => v.penalties);
    const totalPenalties = allPenalties.reduce((sum, p) => sum + p.penaltyAmount, 0);
    // Get all repayments
    const repayments = await prisma_1.default.voucherRepayment.findMany({
        where: { restaurantId },
    });
    const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
    // Calculate outstanding
    const outstanding = totalUsed + totalServiceFees + totalPenalties - totalRepayments;
    return {
        totalCreditIssued,
        totalUsed,
        totalRemaining,
        totalServiceFees,
        totalPenalties,
        totalRepayments,
        outstanding,
        activeVouchers: vouchers.filter((v) => v.status === client_1.VoucherStatus.ACTIVE)
            .length,
        totalVouchers: vouchers.length,
        vouchers: vouchers.map((v) => ({
            id: v.id,
            voucherCode: v.voucherCode,
            status: v.status,
            remainingCredit: v.remainingCredit,
            discountPercentage: v.discountPercentage,
        })),
    };
};
exports.getRestaurantCreditSummaryService = getRestaurantCreditSummaryService;
