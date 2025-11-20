import prisma from "../prisma";
import {
  VoucherStatus,
  LoanStatus,
  PaymentMethod,
  PenaltyStatus,
  SubscriptionStatus,
  OrderStatus,
  PaymentStatus,
} from "@prisma/client";
import { wsManager } from "../index";
import { createNotificationService } from "./notification.services";

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
  approvedBy?: string;
}

interface CreateLoanApplicationData {
  restaurantId: string;
  requestedAmount: number;
  purpose?: string;
  voucherDays?: number;
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
    approvedBy,
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
      approvedBy,
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
 * Get all vouchers with filtering and pagination (Admin only)
 */
export const getAllVouchersService = async (filters?: {
  status?: VoucherStatus;
  restaurantId?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, restaurantId, page = 1, limit = 10 } = filters || {};

  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (restaurantId) {
    where.restaurantId = restaurantId;
  }

  const [vouchers, totalCount] = await Promise.all([
    prisma.voucher.findMany({
      where,
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
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.voucher.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    vouchers,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/**
 * Get current restaurant's vouchers (using authenticated restaurant ID)
 */
export const getMyVouchersService = async (
  restaurantId: string,
  filters?: {
    status?: VoucherStatus;
    activeOnly?: boolean;
  }
) => {
  const where: any = { restaurantId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.activeOnly) {
    where.status = VoucherStatus.ACTIVE;
    where.OR = [{ expiryDate: null }, { expiryDate: { gte: new Date() } }];
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

  return vouchers;
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
  const { restaurantId, requestedAmount, purpose, voucherDays } = data;

  // Check loan eligibility
  const eligibility = await checkLoanEligibilityService(restaurantId);

  if (!eligibility.isEligible) {
    throw new Error(eligibility.reason);
  }

  // Get subscription info to validate voucher days
  const subscriptionInfo = await checkRestaurantSubscription(restaurantId);
  const maxVoucherDays = subscriptionInfo.plan.voucherPaymentDays;

  // Validate voucherDays against subscription limit
  if (voucherDays && voucherDays > maxVoucherDays) {
    throw new Error(
      `Voucher days cannot exceed ${maxVoucherDays} days as per your subscription plan`
    );
  }

  // Check for existing loans with repayment due dates (approved/disbursed loans)
  const loansWithDueDates = await prisma.loanApplication.findMany({
    where: {
      restaurantId,
      status: { in: [LoanStatus.APPROVED, LoanStatus.PAID] },
      repaymentDueDate: { not: null },
    },
    orderBy: { createdAt: "asc" }, // Get first loan created
  });

  // Also check if there are any active loans that would conflict
  const pendingLoans = await prisma.loanApplication.findMany({
    where: {
      restaurantId,
      status: {
        in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.DISBURSED],
      },
      voucherDays: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });

  // Priority 1: Check loans with actual due dates (approved/disbursed)
  if (loansWithDueDates.length > 0 && voucherDays) {
    const firstLoan = loansWithDueDates[0];
    const now = new Date();
    const dueDate = new Date(firstLoan.repaymentDueDate!);
    const diffMs = dueDate.getTime() - now.getTime();

    if (diffMs > 0) {
      const remainingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const remainingHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const remainingMinutes = Math.floor(
        (diffMs % (1000 * 60 * 60)) / (1000 * 60)
      );

      if (voucherDays > remainingDays) {
        throw new Error(
          `You can only request up to ${remainingDays} days (${remainingHours}h ${remainingMinutes}m) based on your active voucher.`
        );
      }
    }
  }
  // Priority 2: If no approved loans, check pending loans
  else if (pendingLoans.length > 0 && voucherDays) {
    const firstPendingLoan = pendingLoans[0];
    if (
      firstPendingLoan.voucherDays &&
      voucherDays > firstPendingLoan.voucherDays
    ) {
      throw new Error(
        `You can only request up to ${firstPendingLoan.voucherDays} days to match your first unpaid loan application.`
      );
    }
  }

  // Validate restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Validate requested amount
  if (requestedAmount <= 0) {
    throw new Error("Requested amount must be greater than zero");
  }

  // Create loan application
  const loanApplication = await prisma.loanApplication.create({
    data: {
      restaurantId,
      requestedAmount,
      purpose,
      voucherDays,
      status: LoanStatus.PENDING,
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  // Broadcast loan application submission (if wsManager is available)
  try {
    const { wsManager } = await import("../index");
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
  const { approvedAmount, approvedBy, repaymentDays, voucherType, notes } =
    approvalData;

  // Get loan details
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
    include: {
      restaurant: true,
    },
  });

  if (!loan) throw new Error("Loan not found");

  if (loan.status !== LoanStatus.PENDING) {
    throw new Error(`Cannot approve loan with status: ${loan.status}`);
  }

  // Get subscription info to use voucherPaymentDays
  const subscriptionInfo = await checkRestaurantSubscription(loan.restaurantId);

  // Use loan's voucherDays, then repaymentDays, then subscription's voucherPaymentDays
  const finalRepaymentDays =
    loan.voucherDays ||
    repaymentDays ||
    subscriptionInfo.plan.voucherPaymentDays;

  // For multiple loans, ensure they all have the same deadline as the first loan
  const existingActiveLoans = await prisma.loanApplication.findMany({
    where: {
      restaurantId: loan.restaurantId,
      status: {
        in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.PAID],
      },
      id: { not: loanId }, // Exclude current loan
    },
    orderBy: { createdAt: "asc" },
  });

  let repaymentDueDate;
  if (
    existingActiveLoans.length > 0 &&
    existingActiveLoans[0].repaymentDueDate
  ) {
    // Use the same due date as the first loan
    repaymentDueDate = new Date(existingActiveLoans[0].repaymentDueDate);
  } else {
    // Calculate new due date based on finalRepaymentDays
    repaymentDueDate = new Date();
    repaymentDueDate.setDate(repaymentDueDate.getDate() + finalRepaymentDays);
  }

  // Calculate dates
  const disbursementDate = new Date();

  // Set voucher expiry: 3 months from now or custom
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 3);

  // Approve loan + create voucher in a transaction
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

    // Create voucher automatically
    const voucherCode = await generateVoucherCode();
    const discountMap = {
      DISCOUNT_10: 10,
      DISCOUNT_20: 20,
      DISCOUNT_50: 50,
      DISCOUNT_80: 80,
      DISCOUNT_100: 100,
    };
    const discountPercentage = discountMap[voucherType];

    const voucher = await tx.voucher.create({
      data: {
        voucherCode,
        voucherType,
        discountPercentage,
        creditLimit: approvedAmount,
        totalCredit: approvedAmount,
        remainingCredit: approvedAmount,
        minTransactionAmount: 0,
        expiryDate,
        restaurantId: updatedLoan.restaurantId,
        loanId: updatedLoan.id,
        status: VoucherStatus.ACTIVE,
        approvedBy: updatedLoan.approvedBy,
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

    await createNotificationService({
      title: "Voucher Issued",
      message: `A ${voucher.discountPercentage}% discount voucher worth ${voucher.creditLimit} RWF has been issued`,
      eventType: "VOUCHER_ISSUED",
      targetType: "SPECIFIC_USER",
      targetId: voucher.restaurantId,
      metadata: {
        voucherId: voucher.id,
        voucherCode: voucher.voucherCode,
        creditLimit: voucher.creditLimit,
        discountPercentage: voucher.discountPercentage,
      },
    });

    return { updatedLoan, voucher };
  });

  // Broadcast loan approval
  try {
    const { wsManager } = await import("../index");
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
        status: LoanStatus.PAID,
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
      action: "PAID",
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

  // Voucher MUST cover the full amount - NO PARTIAL PAYMENTS
  if (voucher.remainingCredit < totalDeducted) {
    throw new Error(
      `Insufficient voucher credit. Required: ${totalDeducted.toFixed(2)} ${
        voucher.currency || "RWF"
      }, Available: ${voucher.remainingCredit.toFixed(2)} ${
        voucher.currency || "RWF"
      }. Voucher cannot be used for partial payments.`
    );
  }

  // Use the exact order total amount (totalDeducted) instead of minimum
  const actualDeduction = totalDeducted;

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
        totalDeducted: actualDeduction,
      },
    });

    // Calculate new remaining credit
    const newRemainingCredit = voucher.remainingCredit - actualDeduction;

    // DON'T mark voucher as USED here - only when order is successful
    // Update voucher balance but keep status as ACTIVE
    const updatedVoucher = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        usedCredit: { increment: actualDeduction },
        remainingCredit: newRemainingCredit,
        usedAt: new Date(), // Track last usage time
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
          paymentMethod: "VOUCHER",
          paymentReference: transaction.id,
          allocatedToPrincipal: amountCharged,
          allocatedToServiceFee: serviceFee,
          allocatedToPenalty: 0,
        },
      });
    }

    // ✅ Order payment status is set to COMPLETED
    // Order status is set to CONFIRMED
    // Voucher status will be updated separately after confirming order success
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.CONFIRMED,
      },
    });

    return { transaction, voucher: updatedVoucher };
  });

  // ✅ BROADCAST VOUCHER USAGE
  try {
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

  if (loan.status !== LoanStatus.PAID) {
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
        status: LoanStatus.PAID,
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
    // Check subscription
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
        error:
          "Voucher has already been used. Each voucher can only be used once.",
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

    // Voucher MUST cover full amount - NO PARTIAL PAYMENTS
    const canCoverFullAmount = voucher.remainingCredit >= totalRequired;

    if (!canCoverFullAmount) {
      return {
        valid: false,
        error: `Insufficient voucher credit. Required: ${totalRequired.toFixed(
          2
        )} ${
          voucher.currency || "RWF"
        }, Available: ${voucher.remainingCredit.toFixed(2)} ${
          voucher.currency || "RWF"
        }. Voucher must cover the full order amount (no partial payments allowed).`,
      };
    }

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
        voucherCovers: totalRequired,
        canCoverFullAmount: true,
        remainingAfterPurchase: voucher.remainingCredit - totalRequired,
      },
      message: `Voucher will cover the full order amount of ${totalRequired.toFixed(
        2
      )} ${voucher.currency || "RWF"}. Remaining credit after this purchase: ${(
        voucher.remainingCredit - totalRequired
      ).toFixed(2)} ${voucher.currency || "RWF"}`,
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
        gte: new Date(),
      },
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          voucherAccess: true,
          voucherPaymentDays: true,
          features: true,
          price: true,
        },
      },
    },
  });

  if (!activeSubscription) {
    throw new Error(
      "No active subscription found. Please subscribe to access voucher features."
    );
  }

  // Check if plan has voucher access enabled
  if (!activeSubscription.plan.voucherAccess) {
    throw new Error(
      `Your current subscription plan (${activeSubscription.plan.name}) does not include voucher access. Please upgrade to a plan with voucher features.`
    );
  }

  // Check if voucherPaymentDays is set
  if (!activeSubscription.plan.voucherPaymentDays) {
    throw new Error(
      `Your subscription plan does not have voucher payment days configured. Please contact support.`
    );
  }

  return activeSubscription;
};

/**
 * Check if restaurant can request a new loan
 * Returns eligibility status and details
 */
export const checkLoanEligibilityService = async (restaurantId: string) => {
  // Check subscription and voucher access
  const subscriptionInfo = await checkRestaurantSubscription(restaurantId);

  // Get all active loans (PENDING, APPROVED, PAID - not REJECTED or SETTLED)
  const activeLoans = await prisma.loanApplication.findMany({
    where: {
      restaurantId,
      status: {
        in: [LoanStatus.PENDING, LoanStatus.APPROVED, LoanStatus.PAID],
      },
    },
    include: {
      vouchers: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const now = new Date();
  const voucherPaymentDays = subscriptionInfo.plan.voucherPaymentDays;

  // Check each loan's payment deadline
  const loansExceedingDeadline = activeLoans.filter((loan) => {
    if (!loan.repaymentDueDate) return false;

    const dueDate = new Date(loan.repaymentDueDate);
    const daysSinceDue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Use loan's voucherDays if available, otherwise use subscription's voucherPaymentDays
    const loanVoucherDays = loan.voucherDays || voucherPaymentDays;
    return daysSinceDue > loanVoucherDays;
  });

  const hasOverdueLoans = loansExceedingDeadline.length > 0;

  // Calculate statistics
  const totalActiveLoans = activeLoans.length;
  const pendingLoans = activeLoans.filter(
    (l) => l.status === LoanStatus.PENDING
  ).length;
  const approvedLoans = activeLoans.filter(
    (l) => l.status === LoanStatus.APPROVED
  ).length;
  const paidLoans = activeLoans.filter(
    (l) => l.status === LoanStatus.PAID
  ).length;

  // Eligibility decision
  const isEligible = !hasOverdueLoans;

  return {
    isEligible,
    reason: hasOverdueLoans
      ? `You have ${loansExceedingDeadline.length} loan(s) that exceeded the ${voucherPaymentDays}-day payment deadline. Please settle overdue loans before requesting new ones.`
      : "You are eligible to request a new loan.",
    subscription: {
      planName: subscriptionInfo.plan.name,
      voucherPaymentDays,
      hasVoucherAccess: subscriptionInfo.plan.voucherAccess,
    },
    loanStatistics: {
      totalActiveLoans,
      pendingLoans,
      approvedLoans,
      paidLoans,
      overdueLoans: loansExceedingDeadline.length,
    },
    overdueLoans: loansExceedingDeadline.map((loan) => ({
      id: loan.id,
      requestedAmount: loan.requestedAmount,
      approvedAmount: loan.approvedAmount,
      repaymentDueDate: loan.repaymentDueDate,
      daysSinceDue: loan.repaymentDueDate
        ? Math.floor(
            (now.getTime() - new Date(loan.repaymentDueDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0,
      status: loan.status,
    })),
    withinDeadlineLoans: activeLoans
      .filter((loan) => !loansExceedingDeadline.includes(loan))
      .map((loan) => ({
        id: loan.id,
        requestedAmount: loan.requestedAmount,
        approvedAmount: loan.approvedAmount,
        repaymentDueDate: loan.repaymentDueDate,
        daysRemaining: loan.repaymentDueDate
          ? Math.floor(
              (new Date(loan.repaymentDueDate).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
        status: loan.status,
      })),
  };
};

/**
 * Mark voucher as USED after successful order completion
 * This should be called ONLY when order is successfully delivered/completed
 */
export const markVoucherAsUsedService = async (
  voucherId: string,
  orderId: string
) => {
  // Verify the order was successful
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Only mark as USED if order is in a successful state
  const successfulStatuses: OrderStatus[] = [
    OrderStatus.DELIVERED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.IN_TRANSIT,
  ];

  if (!successfulStatuses.includes(order.status)) {
    throw new Error(
      `Cannot mark voucher as USED for order with status: ${order.status}`
    );
  }

  // Mark voucher as USED
  const updatedVoucher = await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      status: VoucherStatus.USED,
      usedAt: new Date(),
      usedCredit: order.totalAmount,
    },
  });

  // Broadcast voucher status update
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: updatedVoucher.id,
      voucherCode: updatedVoucher.voucherCode,
      action: "USED",
      timestamp: new Date().toISOString(),
      restaurantId: updatedVoucher.restaurantId,
      data: {
        status: VoucherStatus.USED,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher status update:", error);
  }

  return updatedVoucher;
};

/**
 * Rollback voucher credit if order fails or is cancelled
 */
export const rollbackVoucherPaymentService = async (
  voucherId: string,
  orderId: string
) => {
  // Get the voucher transaction
  const transaction = await prisma.voucherTransaction.findFirst({
    where: {
      voucherId,
      orderId,
    },
    include: {
      voucher: true,
    },
  });

  if (!transaction) {
    throw new Error("Voucher transaction not found");
  }

  // Rollback the voucher credit
  const result = await prisma.$transaction(async (tx) => {
    // Restore voucher credit
    const updatedVoucher = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        usedCredit: { decrement: transaction.totalDeducted },
        remainingCredit: { increment: transaction.totalDeducted },
        status: VoucherStatus.ACTIVE, // Reset to ACTIVE
      },
    });

    // Delete the voucher transaction
    await tx.voucherTransaction.delete({
      where: { id: transaction.id },
    });

    // Delete associated repayment if exists
    await tx.voucherRepayment.deleteMany({
      where: {
        voucherId,
        paymentReference: transaction.id,
      },
    });

    return updatedVoucher;
  });

  // Broadcast rollback
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: result.id,
      voucherCode: result.voucherCode,
      action: "SUSPENDED",
      timestamp: new Date().toISOString(),
      restaurantId: result.restaurantId,
      data: {
        remainingCredit: result.remainingCredit,
        status: result.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher rollback:", error);
  }

  return result;
};
