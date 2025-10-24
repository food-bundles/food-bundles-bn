import prisma from "../prisma";
import {
  VoucherStatus,
  LoanStatus,
  PaymentMethod,
  PenaltyStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { wsManager } from "../index";

// ============================================
// TYPES AND INTERFACES
// ============================================

interface CreateVoucherData {
  restaurantId: string;
  voucherType:
    | "DISCOUNT_10"
    | "DISCOUNT_20"
    | "DISCOUNT_50"
    | "DISCOUNT_80"
    | "DISCOUNT_100";
  creditLimit: number;
  minTransactionAmount?: number;
  maxTransactionAmount?: number;
  expiryDate?: Date;
  loanId?: string;
}

interface CreateLoanApplicationData {
  restaurantId: string;
  requestedAmount: number;
  purpose?: string;
  terms?: string;
}

interface ApproveLoanData {
  approvedAmount: number;
  approvedBy: string;
  repaymentDays?: number; // Default 30 days
  voucherType:
    | "DISCOUNT_10"
    | "DISCOUNT_20"
    | "DISCOUNT_50"
    | "DISCOUNT_80"
    | "DISCOUNT_100";
  notes?: string;
}

interface VoucherPaymentData {
  voucherId: string;
  orderId: string;
  restaurantId: string;
  originalAmount: number;
}

interface RepaymentData {
  restaurantId: string;
  loanId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  voucherId?: string;
}

// ============================================
// VOUCHER CRUD SERVICES
// ============================================

/**
 * Create a new voucher
 */
export const createVoucherService = async (data: CreateVoucherData) => {
  const {
    restaurantId,
    voucherType,
    creditLimit,
    minTransactionAmount = 0,
    maxTransactionAmount,
    expiryDate,
    loanId,
  } = data;

  // ✅ CHECK SUBSCRIPTION FIRST
  await checkRestaurantSubscription(restaurantId);

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
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
    DISCOUNT_100: 100,
  };

  const discountPercentage = discountMap[voucherType];

  // Create voucher
  const voucher = await prisma.voucher.create({
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
      status: VoucherStatus.ACTIVE,
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

  // Broadcast voucher creation
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: voucher.id,
      voucherCode: voucher.voucherCode,
      action: "CREATED",
      timestamp: new Date().toISOString(),
      restaurantId: voucher.restaurantId,
      data: {
        remainingCredit: voucher.remainingCredit,
        totalCredit: voucher.totalCredit,
        discountPercentage: voucher.discountPercentage,
        status: voucher.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher creation:", error);
  }

  return voucher;
};

/**
 * Get voucher by ID
 */
export const getVoucherByIdService = async (voucherId: string) => {
  const voucher = await prisma.voucher.findUnique({
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
        where: { status: PenaltyStatus.PENDING },
      },
    },
  });

  if (!voucher) {
    throw new Error("Voucher not found");
  }

  return voucher;
};

/**
 * Get voucher by code
 */
export const getVoucherByCodeService = async (voucherCode: string) => {
  const voucher = await prisma.voucher.findUnique({
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

/**
 * Get restaurant's vouchers
 */

export const getRestaurantVouchersService = async (
  restaurantId: string,
  filters?: {
    status?: VoucherStatus;
    activeOnly?: boolean;
  }
) => {
  // Check subscription status (don't throw error, just return info)
  let subscriptionStatus;
  try {
    subscriptionStatus = await checkRestaurantSubscription(restaurantId);
  } catch (error: any) {
    subscriptionStatus = null;
  }

  const where: any = { restaurantId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.activeOnly) {
    where.status = VoucherStatus.ACTIVE;
    where.expiryDate = {
      gte: new Date(),
    };
  }

  const vouchers = await prisma.voucher.findMany({
    where,
    include: {
      loan: true,
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      penalties: {
        where: { status: PenaltyStatus.PENDING },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    vouchers,
    subscription: subscriptionStatus
      ? {
          isActive: true,
          planName: subscriptionStatus.plan.name,
          endDate: subscriptionStatus.endDate,
        }
      : {
          isActive: false,
          message: "No active subscription. Subscribe to create new vouchers.",
        },
  };
};

/**
 * Get available vouchers for checkout
 */
export const getAvailableVouchersForCheckoutService = async (
  restaurantId: string,
  orderAmount: number
) => {
  const vouchers = await prisma.voucher.findMany({
    where: {
      restaurantId,
      status: VoucherStatus.ACTIVE,
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

/**
 * Update voucher
 */
export const updateVoucherService = async (
  voucherId: string,
  data: {
    status?: VoucherStatus;
    expiryDate?: Date;
    maxTransactionAmount?: number;
    minTransactionAmount?: number;
  }
) => {
  const voucher = await prisma.voucher.update({
    where: { id: voucherId },
    data,
    include: {
      restaurant: true,
      loan: true,
    },
  });

  return voucher;
};

/**
 * Deactivate/Suspend voucher
 */
export const deactivateVoucherService = async (
  voucherId: string,
  reason?: string
) => {
  const voucher = await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      status: VoucherStatus.SUSPENDED,
    },
  });

  // ✅ BROADCAST VOUCHER SUSPENSION
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: voucher.id,
      voucherCode: voucher.voucherCode,
      action: "SUSPENDED",
      timestamp: new Date().toISOString(),
      restaurantId: voucher.restaurantId,
      data: {
        status: voucher.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher deactivation:", error);
  }

  return voucher;
};

// ============================================
// LOAN APPLICATION SERVICES
// ============================================

/**
 * Submit loan application
 */
export const submitLoanApplicationService = async (
  data: CreateLoanApplicationData
) => {
  const { restaurantId, requestedAmount, purpose, terms } = data;

  // ✅ CHECK SUBSCRIPTION FIRST
  const subscription = await checkRestaurantSubscription(restaurantId);

  // Validate restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Check for pending applications
  const pendingApplication = await prisma.loanApplication.findFirst({
    where: {
      restaurantId,
      status: { in: [LoanStatus.PENDING, LoanStatus.APPROVED] },
    },
  });

  if (pendingApplication) {
    throw new Error("You already have a pending loan application");
  }

  // Optional: Set loan limits based on subscription plan
  const maxLoanAmount = getMaxLoanAmountForPlan(subscription.plan.name);
  if (requestedAmount > maxLoanAmount) {
    throw new Error(
      `Your subscription plan allows a maximum loan of ${maxLoanAmount} RWF. Requested: ${requestedAmount} RWF. Please upgrade your plan for higher limits.`
    );
  }

  // Create loan application
  const loanApplication = await prisma.loanApplication.create({
    data: {
      restaurantId,
      requestedAmount,
      purpose,
      terms,
      status: LoanStatus.PENDING,
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

  // Broadcast loan application submission
  try {
    wsManager.broadcastLoanUpdate({
      loanId: loanApplication.id,
      action: "SUBMITTED",
      timestamp: new Date().toISOString(),
      restaurantId: loanApplication.restaurantId,
      data: {
        requestedAmount: loanApplication.requestedAmount,
        status: loanApplication.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast loan submission:", error);
  }

  return loanApplication;
};

/**
 * Get loan application by ID
 */
export const getLoanApplicationByIdService = async (loanId: string) => {
  const loan = await prisma.loanApplication.findUnique({
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

/**
 * Get restaurant's loan applications
 */
export const getRestaurantLoanApplicationsService = async (
  restaurantId: string
) => {
  const loans = await prisma.loanApplication.findMany({
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

/**
 * Get all loan applications (Admin)
 */
export const getAllLoanApplicationsService = async (filters?: {
  status?: LoanStatus;
  restaurantId?: string;
}) => {
  const where: any = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.restaurantId) {
    where.restaurantId = filters.restaurantId;
  }

  const loans = await prisma.loanApplication.findMany({
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

/**
 * Approve loan application and create voucher immediately
 */
export const approveLoanApplicationService = async (
  loanId: string,
  approvalData: ApproveLoanData
) => {
  const {
    approvedAmount,
    approvedBy,
    repaymentDays = 30,
    voucherType,
    notes,
  } = approvalData;

  // ✅ Get loan details
  const loan = await getLoanApplicationByIdService(loanId);

  if (!loan) throw new Error("Loan not found");

  if (loan.status !== LoanStatus.PENDING) {
    throw new Error(`Cannot approve loan with status: ${loan.status}`);
  }

  // ✅ Prepare loan update data
  const disbursementDate = new Date();
  const repaymentDueDate = new Date();
  repaymentDueDate.setDate(repaymentDueDate.getDate() + repaymentDays);

  // ✅ Set default expiry: 3 months from now
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 3);

  // ✅ Approve loan + create voucher in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update loan to approved
    const updatedLoan = await tx.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.APPROVED,
        approvedAmount,
        approvedBy,
        approvedAt: new Date(),
        notes,
        disbursementDate,
        repaymentDueDate,
      },
      include: {
        restaurant: true,
      },
    });

    // ✅ Create a voucher automatically for the approved loan
    const voucher = await createVoucherService({
      restaurantId: updatedLoan.restaurantId,
      voucherType,
      creditLimit: approvedAmount,
      expiryDate,
      loanId: updatedLoan.id,
    });

    return { updatedLoan, voucher };
  });

  // ✅ BROADCAST LOAN APPROVAL
  try {
    wsManager.broadcastLoanUpdate({
      loanId: result.updatedLoan.id,
      action: "APPROVED",
      timestamp: new Date().toISOString(),
      restaurantId: result.updatedLoan.restaurantId,
      data: {
        requestedAmount: result.updatedLoan.requestedAmount,
        approvedAmount: result.updatedLoan.approvedAmount ?? 0,
        status: result.updatedLoan.status,
        voucherId: result.voucher.id,
        voucherCode: result.voucher.voucherCode,
      },
    });

    // ✅ BROADCAST VOUCHER CREATION
    wsManager.broadcastVoucherUpdate({
      voucherId: result.voucher.id,
      voucherCode: result.voucher.voucherCode,
      action: "CREATED",
      timestamp: new Date().toISOString(),
      restaurantId: result.voucher.restaurantId,
      data: {
        remainingCredit: result.voucher.remainingCredit,
        totalCredit: result.voucher.totalCredit,
        discountPercentage: result.voucher.discountPercentage,
        status: result.voucher.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast approval or voucher creation:", error);
  }

  return {
    loan: result.updatedLoan,
    voucher: result.voucher,
  };
};

/**
 * Disburse approved loan (creates voucher)
 */
export const disburseLoanService = async (loanId: string, adminId: string) => {
  const loan = await getLoanApplicationByIdService(loanId);

  if (loan.status !== LoanStatus.APPROVED) {
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
  const result = await prisma.$transaction(async (tx) => {
    // Create voucher
    const voucher = await createVoucherService({
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
        status: LoanStatus.DISBURSED,
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

  // ✅ BROADCAST LOAN DISBURSEMENT
  try {
    wsManager.broadcastLoanUpdate({
      loanId: result.loan.id,
      action: "DISBURSED",
      timestamp: new Date().toISOString(),
      restaurantId: result.loan.restaurantId,
      data: {
        approvedAmount: result.loan.approvedAmount ?? 0,
        status: result.loan.status,
        voucherId: result.voucher.id,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast loan disbursement:", error);
  }

  return result;
};

/**
 * Reject loan application
 */
export const rejectLoanApplicationService = async (
  loanId: string,
  adminId: string,
  reason?: string
) => {
  const loan = await getLoanApplicationByIdService(loanId);

  if (loan.status !== LoanStatus.PENDING) {
    throw new Error(`Cannot reject loan with status: ${loan.status}`);
  }

  const updatedLoan = await prisma.loanApplication.update({
    where: { id: loanId },
    data: {
      status: LoanStatus.REJECTED,
      approvedBy: adminId,
      notes: reason,
      approvedAt: new Date(),
    },
    include: {
      restaurant: true,
    },
  });

  // ✅ BROADCAST LOAN REJECTION
  try {
    wsManager.broadcastLoanUpdate({
      loanId: updatedLoan.id,
      action: "REJECTED",
      timestamp: new Date().toISOString(),
      restaurantId: updatedLoan.restaurantId,
      data: {
        requestedAmount: updatedLoan.requestedAmount,
        status: updatedLoan.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast loan rejection:", error);
  }

  return updatedLoan;
};

// ============================================
// VOUCHER PAYMENT PROCESSING
// ============================================

/**
 * Process voucher payment
 */
export const processVoucherPaymentService = async (
  data: VoucherPaymentData
) => {
  const { voucherId, orderId, restaurantId, originalAmount } = data;

  // Get and validate voucher
  const voucher = await getVoucherByIdService(voucherId);

  // Validate voucher eligibility
  validateVoucherEligibility(voucher, originalAmount, restaurantId);

  // Calculate payment amounts
  const discountAmount = originalAmount * (voucher.discountPercentage / 100);
  const amountCharged = originalAmount - discountAmount;
  const serviceFee = amountCharged * (voucher.serviceFeeRate / 100);
  const totalDeducted = amountCharged + serviceFee;

  // Check sufficient credit
  if (voucher.remainingCredit < totalDeducted) {
    // Allow using all remaining credit even if insufficient
    console.log(
      `Using remaining voucher credit: ${voucher.remainingCredit} (Required: ${totalDeducted})`
    );
  }

  // Use minimum of totalDeducted or remaining credit
  const actualDeduction = Math.min(totalDeducted, voucher.remainingCredit);

  // Process payment in transaction
  const result = await prisma.$transaction(async (tx) => {
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
        totalDeducted: actualDeduction, // Use actual deduction
      },
    });

    // Calculate new remaining credit
    const newRemainingCredit = voucher.remainingCredit - actualDeduction;

    // Update voucher balance and mark as USED (one-time use)
    const updatedVoucher = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        usedCredit: { increment: actualDeduction },
        remainingCredit: newRemainingCredit,
        // Mark as USED after first use regardless of remaining credit
        status: VoucherStatus.USED,
        usedAt: new Date(), // Track when voucher was used
      },
    });

    // If there's a loan associated, create repayment record for credit tracking
    if (voucher.loanId && actualDeduction > 0) {
      await tx.voucherRepayment.create({
        data: {
          voucherId,
          restaurantId,
          loanId: voucher.loanId,
          amount: actualDeduction,
          paymentMethod: "VOUCHER", // Add VOUCHER as payment method in Prisma schema
          paymentReference: transaction.id,
          allocatedToPrincipal: amountCharged,
          allocatedToServiceFee: serviceFee,
          allocatedToPenalty: 0,
        },
      });
    }

    return { transaction, voucher: updatedVoucher };
  });

  // ✅ BROADCAST VOUCHER USAGE
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: result.voucher.id,
      voucherCode: result.voucher.voucherCode,
      action: "USED",
      timestamp: new Date().toISOString(),
      restaurantId: result.voucher.restaurantId,
      data: {
        remainingCredit: result.voucher.remainingCredit,
        totalCredit: result.voucher.totalCredit,
        discountPercentage: result.voucher.discountPercentage,
        status: result.voucher.status,
      },
    });

    // ✅ BROADCAST VOUCHER TRANSACTION
    wsManager.broadcastVoucherTransactionUpdate({
      transactionId: result.transaction.id,
      voucherId: result.voucher.id,
      orderId: orderId,
      action: "PAYMENT_PROCESSED",
      timestamp: new Date().toISOString(),
      restaurantId: restaurantId,
      data: {
        originalAmount: result.transaction.originalAmount,
        discountAmount: result.transaction.discountAmount,
        amountCharged: result.transaction.amountCharged,
        remainingCredit: result.voucher.remainingCredit,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher payment:", error);
  }

  return result;
};

/**
 * Validate voucher eligibility
 */
function validateVoucherEligibility(
  voucher: any,
  amount: number,
  restaurantId: string
) {
  // Check restaurant ownership
  if (voucher.restaurantId !== restaurantId) {
    throw new Error("Voucher does not belong to this restaurant");
  }

  // Check status
  if (voucher.status !== VoucherStatus.ACTIVE) {
    throw new Error(`Voucher is ${voucher.status.toLowerCase()}`);
  }

  // Check expiry
  if (voucher.expiryDate && new Date() > new Date(voucher.expiryDate)) {
    throw new Error("Voucher has expired");
  }

  // Check min/max transaction amounts
  if (amount < voucher.minTransactionAmount) {
    throw new Error(
      `Transaction amount must be at least ${voucher.minTransactionAmount}`
    );
  }

  if (voucher.maxTransactionAmount && amount > voucher.maxTransactionAmount) {
    throw new Error(
      `Transaction amount cannot exceed ${voucher.maxTransactionAmount}`
    );
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
export const processRepaymentService = async (data: RepaymentData) => {
  const {
    restaurantId,
    loanId,
    amount,
    paymentMethod,
    paymentReference,
    voucherId,
  } = data;

  // Get loan details
  const loan = await getLoanApplicationByIdService(loanId);

  if (loan.restaurantId !== restaurantId) {
    throw new Error("Loan does not belong to this restaurant");
  }

  if (loan.status !== LoanStatus.DISBURSED) {
    throw new Error(
      `Cannot make repayment for loan with status: ${loan.status}`
    );
  }

  // Calculate outstanding balance
  const outstanding = await calculateOutstandingBalanceService(loanId);

  if (amount > outstanding.total) {
    throw new Error(
      `Repayment amount (${amount}) exceeds outstanding balance (${outstanding.total})`
    );
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
    allocatedToServiceFee = Math.min(
      remainingAmount,
      outstanding.totalServiceFees
    );
    remainingAmount -= allocatedToServiceFee;
  }

  // Finally to principal
  if (remainingAmount > 0) {
    allocatedToPrincipal = remainingAmount;
  }

  // Create repayment record
  const repayment = await prisma.voucherRepayment.create({
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
  const newOutstanding = await calculateOutstandingBalanceService(loanId);
  if (newOutstanding.total <= 0) {
    await prisma.loanApplication.update({
      where: { id: loanId },
      data: { status: LoanStatus.SETTLED },
    });

    // Mark all vouchers as settled
    if (voucherId) {
      await prisma.voucher.update({
        where: { id: voucherId },
        data: { status: VoucherStatus.SETTLED },
      });
    }
  }

  // ✅ BROADCAST REPAYMENT
  try {
    wsManager.broadcastRepaymentUpdate({
      repaymentId: repayment.id,
      loanId: loanId,
      voucherId: voucherId,
      action: "PROCESSED",
      timestamp: new Date().toISOString(),
      restaurantId: restaurantId,
      data: {
        amount: amount,
        paymentMethod: paymentMethod,
        newOutstanding: newOutstanding.total,
      },
    });

    // If loan is settled, broadcast loan update
    if (newOutstanding.total <= 0) {
      wsManager.broadcastLoanUpdate({
        loanId: loanId,
        action: "SETTLED",
        timestamp: new Date().toISOString(),
        restaurantId: restaurantId,
        data: {
          status: "SETTLED",
        },
      });

      // Also broadcast voucher settlement
      if (voucherId) {
        wsManager.broadcastVoucherUpdate({
          voucherId: voucherId,
          voucherCode: repayment.voucher?.voucherCode || "",
          action: "SETTLED",
          timestamp: new Date().toISOString(),
          restaurantId: restaurantId,
          data: {
            status: "SETTLED",
          },
        });
      }
    }
  } catch (error) {
    console.error("Failed to broadcast repayment:", error);
  }

  return { repayment, newOutstanding };
};

/**
 * Calculate outstanding balance
 */
export const calculateOutstandingBalanceService = async (loanId: string) => {
  const loan = await getLoanApplicationByIdService(loanId);

  if (!loan.approvedAmount) {
    throw new Error("Loan has no approved amount");
  }

  // Get all voucher transactions for this loan
  const transactions = await prisma.voucherTransaction.findMany({
    where: {
      voucher: {
        loanId,
      },
    },
  });

  // Get all repayments
  const repayments = await prisma.voucherRepayment.findMany({
    where: { loanId },
  });

  // Get pending penalties
  const penalties = await prisma.voucherPenalty.findMany({
    where: {
      voucher: {
        loanId,
      },
      status: PenaltyStatus.PENDING,
    },
  });

  // Calculate totals
  const totalUsed = transactions.reduce((sum, t) => sum + t.amountCharged, 0);
  const totalServiceFees = transactions.reduce(
    (sum, t) => sum + t.serviceFee,
    0
  );
  const totalPenalties = penalties.reduce((sum, p) => sum + p.penaltyAmount, 0);

  const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
  const repaidPrincipal = repayments.reduce(
    (sum, r) => sum + r.allocatedToPrincipal,
    0
  );
  const repaidServiceFees = repayments.reduce(
    (sum, r) => sum + r.allocatedToServiceFee,
    0
  );
  const repaidPenalties = repayments.reduce(
    (sum, r) => sum + r.allocatedToPenalty,
    0
  );

  const outstandingPrincipal = totalUsed - repaidPrincipal;
  const outstandingServiceFees = totalServiceFees - repaidServiceFees;
  const outstandingPenalties = totalPenalties - repaidPenalties;

  const total =
    outstandingPrincipal + outstandingServiceFees + outstandingPenalties;

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

/**
 * Mark penalties as paid
 */
async function markPenaltiesAsPaid(loanId: string, amountPaid: number) {
  const penalties = await prisma.voucherPenalty.findMany({
    where: {
      voucher: { loanId },
      status: PenaltyStatus.PENDING,
    },
    orderBy: { appliedDate: "asc" }, // Pay oldest first
  });

  let remainingAmount = amountPaid;

  for (const penalty of penalties) {
    if (remainingAmount <= 0) break;

    if (remainingAmount >= penalty.penaltyAmount) {
      // Fully pay this penalty
      await prisma.voucherPenalty.update({
        where: { id: penalty.id },
        data: {
          status: PenaltyStatus.PAID,
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
export const calculatePenaltiesService = async (
  loanId?: string,
  penaltyRatePerMonth: number = 2 // 2% per month default
) => {
  let loans;

  if (loanId) {
    loans = [await getLoanApplicationByIdService(loanId)];
  } else {
    // Get all disbursed loans
    loans = await prisma.loanApplication.findMany({
      where: {
        status: LoanStatus.DISBURSED,
      },
      include: {
        vouchers: true,
      },
    });
  }

  const results = [];

  for (const loan of loans) {
    if (!loan.repaymentDueDate) continue;

    const daysOverdue = Math.floor(
      (new Date().getTime() - new Date(loan.repaymentDueDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysOverdue <= 0) continue; // Not overdue

    // Calculate outstanding balance
    const outstanding = await calculateOutstandingBalanceService(loan.id);

    if (outstanding.total <= 0) continue; // Already paid

    // Calculate penalty
    const monthsOverdue = daysOverdue / 30;
    const penaltyAmount =
      outstanding.outstandingPrincipal *
      (penaltyRatePerMonth / 100) *
      monthsOverdue;

    // Check if penalty already exists for this period
    const existingPenalty = await prisma.voucherPenalty.findFirst({
      where: {
        voucher: { loanId: loan.id },
        status: PenaltyStatus.PENDING,
        daysOverdue,
      },
    });

    if (existingPenalty) continue; // Already applied

    // Create penalty for each voucher in the loan
    for (const voucher of loan.vouchers) {
      const penalty = await prisma.voucherPenalty.create({
        data: {
          voucherId: voucher.id,
          restaurantId: loan.restaurantId,
          penaltyAmount,
          daysOverdue,
          penaltyRate: penaltyRatePerMonth,
          reason: `Penalty for ${daysOverdue} days overdue (${monthsOverdue.toFixed(
            2
          )} months)`,
          status: PenaltyStatus.PENDING,
        },
      });

      results.push({
        loanId: loan.id,
        voucherId: voucher.id,
        penalty,
        daysOverdue,
      });

      // ✅ BROADCAST PENALTY APPLICATION
      try {
        wsManager.broadcastPenaltyUpdate({
          penaltyId: penalty.id,
          loanId: loan.id,
          voucherId: voucher.id,
          action: "APPLIED",
          timestamp: new Date().toISOString(),
          restaurantId: loan.restaurantId,
          data: {
            penaltyAmount: penalty.penaltyAmount,
            reason: penalty.reason || "",
            daysOverdue: daysOverdue,
          },
        });
      } catch (error) {
        console.error("Failed to broadcast penalty application:", error);
      }
    }

    // Check for severe delinquency (>60 days) and suspend vouchers
    if (daysOverdue > 60) {
      await prisma.voucher.updateMany({
        where: { loanId: loan.id },
        data: { status: VoucherStatus.SUSPENDED },
      });

      // ✅ BROADCAST VOUCHER SUSPENSION
      try {
        for (const voucher of loan.vouchers) {
          wsManager.broadcastVoucherUpdate({
            voucherId: voucher.id,
            voucherCode: voucher.voucherCode,
            action: "SUSPENDED",
            timestamp: new Date().toISOString(),
            restaurantId: loan.restaurantId,
            data: {
              status: VoucherStatus.SUSPENDED,
            },
          });
        }
      } catch (error) {
        console.error("Failed to broadcast voucher suspension:", error);
      }
    }
  }

  return results;
};

/**
 * Get penalties for a loan
 */
export const getLoanPenaltiesService = async (loanId: string) => {
  const penalties = await prisma.voucherPenalty.findMany({
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
      .filter((p) => p.status === PenaltyStatus.PENDING)
      .reduce((sum, p) => sum + p.penaltyAmount, 0),
    paid: penalties
      .filter((p) => p.status === PenaltyStatus.PAID)
      .reduce((sum, p) => sum + p.penaltyAmount, 0),
    penalties,
  };

  return summary;
};

/**
 * Waive penalty (Admin only)
 */
export const waivePenaltyService = async (
  penaltyId: string,
  adminId: string,
  reason?: string
) => {
  // First get the penalty to access restaurant info
  const existingPenalty = await prisma.voucherPenalty.findUnique({
    where: { id: penaltyId },
    include: {
      voucher: {
        select: {
          restaurantId: true,
        },
      },
    },
  });

  if (!existingPenalty) {
    throw new Error("Penalty not found");
  }

  const penalty = await prisma.voucherPenalty.update({
    where: { id: penaltyId },
    data: {
      status: PenaltyStatus.WAIVED,
    },
  });

  // ✅ BROADCAST PENALTY WAIVER
  try {
    wsManager.broadcastPenaltyUpdate({
      penaltyId: penalty.id,
      loanId: existingPenalty.voucher.restaurantId, // This should be loanId from voucher
      voucherId: penalty.voucherId,
      action: "WAIVED",
      timestamp: new Date().toISOString(),
      restaurantId: existingPenalty.voucher.restaurantId,
      data: {
        penaltyAmount: penalty.penaltyAmount,
        reason: reason || "Waived by admin",
      },
    });
  } catch (error) {
    console.error("Failed to broadcast penalty waiver:", error);
  }

  return penalty;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique voucher code
 */
async function generateVoucherCode(): Promise<string> {
  const prefix = "VCH";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const code = `${prefix}-${timestamp}-${random}`;

  // Check if code exists
  const existing = await prisma.voucher.findUnique({
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
export const getVoucherTransactionHistoryService = async (
  voucherId: string
) => {
  const transactions = await prisma.voucherTransaction.findMany({
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

/**
 * Get credit summary for restaurant
 */
export const getRestaurantCreditSummaryService = async (
  restaurantId: string
) => {
  // Get all vouchers
  const vouchers = await prisma.voucher.findMany({
    where: { restaurantId },
    include: {
      loan: true,
      transactions: true,
      penalties: {
        where: { status: PenaltyStatus.PENDING },
      },
    },
  });

  // Calculate totals
  const totalCreditIssued = vouchers.reduce((sum, v) => sum + v.totalCredit, 0);
  const totalUsed = vouchers.reduce((sum, v) => sum + v.usedCredit, 0);
  const totalRemaining = vouchers.reduce(
    (sum, v) => sum + v.remainingCredit,
    0
  );

  // Get all transactions
  const allTransactions = vouchers.flatMap((v) => v.transactions);
  const totalServiceFees = allTransactions.reduce(
    (sum, t) => sum + t.serviceFee,
    0
  );

  // Get all penalties
  const allPenalties = vouchers.flatMap((v) => v.penalties);
  const totalPenalties = allPenalties.reduce(
    (sum, p) => sum + p.penaltyAmount,
    0
  );

  // Get all repayments
  const repayments = await prisma.voucherRepayment.findMany({
    where: { restaurantId },
  });
  const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);

  // Calculate outstanding
  const outstanding =
    totalUsed + totalServiceFees + totalPenalties - totalRepayments;

  return {
    totalCreditIssued,
    totalUsed,
    totalRemaining,
    totalServiceFees,
    totalPenalties,
    totalRepayments,
    outstanding,
    activeVouchers: vouchers.filter((v) => v.status === VoucherStatus.ACTIVE)
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

/**
 * Get voucher transaction history
 */
export const getRestaurantTransactionHistoryService = async (
  restaurantId: string
) => {
  const transactions = await prisma.voucherTransaction.findMany({
    where: {
      voucher: {
        restaurantId,
      },
    },
    include: {
      voucher: {
        select: {
          id: true,
          voucherCode: true,
          status: true,
        },
      },
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

/**
 * Get restaurant's vouchers
 */
export const validateVoucherForCheckoutService = async (
  voucherCode: string,
  restaurantId: string,
  orderAmount: number
) => {
  try {
    // ✅ CHECK SUBSCRIPTION
    await checkRestaurantSubscription(restaurantId);

    const voucher = await getVoucherByCodeService(voucherCode);

    // Check ownership
    if (voucher.restaurantId !== restaurantId) {
      return {
        valid: false,
        error: "Voucher does not belong to this restaurant",
      };
    }

    // Check if already used
    if (voucher.status === VoucherStatus.USED) {
      return {
        valid: false,
        error: "Voucher has already been used",
      };
    }

    // Check status
    if (voucher.status !== VoucherStatus.ACTIVE) {
      return {
        valid: false,
        error: `Voucher is ${voucher.status.toLowerCase()}`,
      };
    }

    // Check expiry
    if (voucher.expiryDate && new Date() > new Date(voucher.expiryDate)) {
      return {
        valid: false,
        error: "Voucher has expired",
      };
    }

    // Check min/max transaction amounts
    if (orderAmount < voucher.minTransactionAmount) {
      return {
        valid: false,
        error: `Minimum order amount is ${voucher.minTransactionAmount}`,
      };
    }

    if (
      voucher.maxTransactionAmount &&
      orderAmount > voucher.maxTransactionAmount
    ) {
      return {
        valid: false,
        error: `Maximum order amount is ${voucher.maxTransactionAmount}`,
      };
    }

    // Check remaining credit
    if (voucher.remainingCredit <= 0) {
      return {
        valid: false,
        error: "Voucher has no remaining credit",
      };
    }

    // Calculate coverage
    const discountAmount = orderAmount * (voucher.discountPercentage / 100);
    const amountCharged = orderAmount - discountAmount;
    const serviceFee = amountCharged * (voucher.serviceFeeRate / 100);
    const totalRequired = amountCharged + serviceFee;

    const coversFullAmount = totalRequired <= voucher.remainingCredit;
    const requiresAdditionalPayment = !coversFullAmount;
    const additionalPaymentRequired = requiresAdditionalPayment
      ? totalRequired - voucher.remainingCredit
      : 0;

    return {
      valid: true,
      voucher: {
        id: voucher.id,
        code: voucher.voucherCode,
        discountPercentage: voucher.discountPercentage,
        remainingCredit: voucher.remainingCredit,
        loanId: voucher.loanId,
      },
      coverage: {
        orderAmount,
        discountAmount,
        amountAfterDiscount: amountCharged,
        serviceFee,
        totalRequired,
        voucherCovers: Math.min(totalRequired, voucher.remainingCredit),
        coversFullAmount,
        requiresAdditionalPayment,
        additionalPaymentRequired,
      },
      warning: requiresAdditionalPayment
        ? `Voucher will cover ${voucher.remainingCredit} RWF. Additional payment of ${additionalPaymentRequired} required.`
        : null,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || "Failed to validate voucher",
    };
  }
};

/**
 * Get loan repayment info
 */
export const getLoanRepaymentInfoService = async (loanId: string) => {
  const loan = await getLoanApplicationByIdService(loanId);

  if (!loan.repaymentDueDate) {
    return {
      hasDeadline: false,
      message: "No repayment deadline set",
    };
  }

  const now = new Date();
  const dueDate = new Date(loan.repaymentDueDate);
  const daysRemaining = Math.ceil(
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isOverdue = daysRemaining < 0;
  const isPendingPenalty = isOverdue && daysRemaining > -60; // Before severe delinquency

  return {
    hasDeadline: true,
    repaymentDueDate: loan.repaymentDueDate,
    daysRemaining: Math.abs(daysRemaining),
    isOverdue,
    isPendingPenalty,
    status: isOverdue
      ? daysRemaining < -60
        ? "SEVERELY_OVERDUE"
        : "OVERDUE"
      : daysRemaining <= 7
      ? "DUE_SOON"
      : "ACTIVE",
    message: isOverdue
      ? `Payment is ${Math.abs(daysRemaining)} days overdue`
      : `Payment due in ${daysRemaining} days`,
  };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if restaurant has active subscription
 */
export const checkRestaurantSubscription = async (restaurantId: string) => {
  const activeSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
      status: SubscriptionStatus.ACTIVE,
      endDate: {
        gte: new Date(), // Subscription end date must be in the future
      },
    },
    include: {
      plan: {
        select: {
          name: true,
          features: true,
        },
      },
    },
  });

  if (!activeSubscription) {
    throw new Error(
      "Restaurant does not have an active subscription. Please subscribe to access voucher and loan features."
    );
  }

  // Optional: Check if the plan includes voucher/loan features
  const features = activeSubscription.plan.features as any;
  if (features && Array.isArray(features)) {
    const hasVoucherFeature = features.some(
      (f: string) =>
        f.toLowerCase().includes("voucher") ||
        f.toLowerCase().includes("loan") ||
        f.toLowerCase().includes("credit")
    );

    if (!hasVoucherFeature) {
      throw new Error(
        `Your current subscription plan (${activeSubscription.plan.name}) does not include voucher/loan features. Please upgrade your plan.`
      );
    }
  }

  return activeSubscription;
};

/**
 * Get maximum loan amount based on subscription plan
 */
function getMaxLoanAmountForPlan(planName: string): number {
  // Define loan limits per plan tier
  const loanLimits: Record<string, number> = {
    Basic: 500000, // 500K RWF
    Standard: 2000000, // 2M RWF
    Premium: 5000000, // 5M RWF
    Enterprise: 10000000, // 10M RWF
  };

  // Default limit if plan not found
  return loanLimits[planName] || 1000000; // 1M RWF default
}
