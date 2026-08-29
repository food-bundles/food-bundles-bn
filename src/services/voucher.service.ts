import axios from "axios";
import prisma from "../prisma";
import {
  VoucherStatus,
  LoanStatus,
  PenaltyStatus,
  SubscriptionStatus,
  OrderStatus,
  PaymentStatus,
  WalletTransactionType,
  TransactionStatus,
} from "@prisma/client";
import { wsManager } from "../index";

import { createNotificationService } from "./notification.services";
import {
  getWalletByRestaurantIdService,
  debitWalletService,
} from "./wallet.service";
import {
  sendAdminVoucherAppliedEmail,
  sendAdminVoucherApprovedEmail,
  sendWalletNotificationEmail,
} from "../utils/emailTemplates";
import { sendMessage } from "../utils/sms.utility";
import { getUserById } from "./userGets";
import { getRestaurantFromAffiliatorService } from "./affiliator.service";
import {
  createTraderTransactionService,
  processAllTradersCommissionService,
} from "./trader.service";
import { applyPromoCodeService } from "./promo.service";

// Payment processing functions
const flw = require("flutterwave-node-v3");
const paypack = require("paypack-js");

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
  repaymentDays: number;
  expiryDate?: Date;
  loanId?: string;
  approvedBy?: string;
}

interface CreateLoanApplicationData {
  restaurantId: string;
  requestedAmount: number;
  purpose?: string;
  voucherDays: number;
}

interface ApproveLoanData {
  approvedAmount: number;
  approvedBy: string;
  repaymentDays: number; // Default 30 days
  voucherType:
    | "DISCOUNT_10"
    | "DISCOUNT_20"
    | "DISCOUNT_50"
    | "DISCOUNT_80"
    | "DISCOUNT_100";
  notes?: string;
  managedBy?: string;
}

interface VoucherPaymentData {
  voucherId: string;
  orderId: string;
  restaurantId: string;
  originalAmount: number;
}

interface RepaymentData {
  restaurantId: string;
  paymentMethod: string;
  voucherId: string;
  paymentReference?: string;
}

interface LoanEligibilityCheck {
  isEligible: boolean;
  reason: string;
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
    repaymentDays,
    expiryDate,
    loanId,
    approvedBy,
  } = data;

  // CHECK SUBSCRIPTION FIRST
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

  // Create voucher and loan application in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Always create loan application for each voucher
    let finalLoanId = loanId;
    if (!finalLoanId) {
      const loanApplication = await tx.loanApplication.create({
        data: {
          restaurantId,
          requestedAmount: creditLimit,
          repaymentDays,
          status: LoanStatus.APPROVED,
          purpose: `Loan application for voucher ${voucherCode}`,
          approvedBy,
          approvedAt: new Date(),
          approvedAmount: creditLimit,
        },
        include: {
          approver: true,
          manager: true,
        },
      });
      finalLoanId = loanApplication.id;
    } else {
      // Update existing loan with repayment days if provided
      await tx.loanApplication.update({
        where: { id: loanId },
        data: { repaymentDays },
      });
    }

    // Create voucher
    const voucher = await tx.voucher.create({
      data: {
        voucherCode,
        voucherType,
        discountPercentage,
        creditLimit,
        totalCredit: creditLimit,
        remainingCredit: creditLimit,
        paidAmount: 0,
        remainingAmount: 0,
        repaymentDays,
        expiryDate,
        restaurantId,
        loanId: finalLoanId,
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

    return voucher;
  });

  // Broadcast voucher creation
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: result.id,
      voucherCode: result.voucherCode,
      action: "CREATED",
      timestamp: new Date().toISOString(),
      restaurantId: result.restaurantId || "",
      data: {
        remainingCredit: result.remainingCredit,
        totalCredit: result.totalCredit,
        discountPercentage: result.discountPercentage,
        status: result.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast voucher creation:", error);
  }

  return result;
};

/**
 * Check and update voucher status to MATURED if payment deadline exceeded
 */
const checkAndUpdateVoucherMaturity = async (voucher: any) => {
  const now = new Date();
  let newStatus = null;

  // Check if ACTIVE voucher has expired
  if (
    voucher.status === VoucherStatus.ACTIVE &&
    voucher.expiryDate &&
    now > new Date(voucher.expiryDate)
  ) {
    newStatus = VoucherStatus.EXPIRED;
  }
  // Check if USED voucher should be MATURED (payment deadline exceeded)
  else if (voucher.status === VoucherStatus.USED) {
    let shouldMature = false;

    // Calculate based on voucher's repaymentDays and usedAt date
    if (voucher.usedAt && voucher.repaymentDays > 0) {
      const usedDate = new Date(voucher.usedAt);
      const paymentDeadline = new Date(
        usedDate.getTime() + voucher.repaymentDays * 24 * 60 * 60 * 1000,
      );

      // Check if current date is past the payment deadline
      shouldMature = now.getTime() > paymentDeadline.getTime();

      console.log(
        `Voucher ${voucher.id}: Used at ${usedDate.toISOString()}, Deadline ${paymentDeadline.toISOString()}, Now ${now.toISOString()}, Should mature: ${shouldMature}`,
      );
    }

    if (shouldMature) {
      newStatus = VoucherStatus.MATURED;
    }
  }

  if (newStatus) {
    return await prisma.voucher.update({
      where: { id: voucher.id },
      data: { status: newStatus },
    });
  }

  return voucher;
};

/**
 * Get all vouchers with filtering and pagination (Admin only)
 */
export const getAllVouchersService = async (filters?: {
  status?: VoucherStatus;
  restaurantId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, restaurantId, search, page = 1, limit = 10 } = filters || {};

  const skip = (page - 1) * limit;

  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (restaurantId) {
    where.restaurantId = restaurantId;
  }

  if (search) {
    where.restaurant = {
      name: {
        contains: search,
        mode: "insensitive",
      },
    };
  }

  const [vouchers, totalCount, voucherStats] = await Promise.all([
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
        approver: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.voucher.count({ where }),
    // Get voucher statistics
    prisma.voucher.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
      _sum: {
        totalCredit: true,
        usedCredit: true,
      },
      where: restaurantId ? { restaurantId } : {},
    }),
  ]);

  // Process matured vouchers auto-deduction
  try {
    await processMaturedVouchersAutoDeductionService();
  } catch (error) {
    console.error("Failed to process matured vouchers auto-deduction:", error);
  }

  const totalPages = Math.ceil(totalCount / limit);

  // Process statistics
  const stats = {
    totalVouchers: totalCount,
    activeVouchers: 0,
    usedVouchers: { count: 0, totalAmount: 0 },
    suspendedVouchers: 0,
    expiredVouchers: 0,
    maturedVouchers: { count: 0, totalAmount: 0 },
    settledVouchers: { count: 0, totalAmount: 0 },
  };

  voucherStats.forEach((stat) => {
    switch (stat.status) {
      case "ACTIVE":
        stats.activeVouchers = stat._count.id;
        break;
      case "USED":
        stats.usedVouchers.count = stat._count.id;
        stats.usedVouchers.totalAmount = stat._sum.usedCredit || 0;
        break;
      case "SUSPENDED":
        stats.suspendedVouchers = stat._count.id;
        break;
      case "EXPIRED":
        stats.expiredVouchers = stat._count.id;
        break;
      case "MATURED":
        stats.maturedVouchers.count = stat._count.id;
        stats.maturedVouchers.totalAmount = stat._sum.usedCredit || 0;
        break;
      case "SETTLED":
        stats.settledVouchers.count = stat._count.id;
        stats.settledVouchers.totalAmount = stat._sum.usedCredit || 0;
        break;
    }
  });

  return {
    vouchers,
    statistics: stats,
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
  restaurantId: string | undefined,
  affiliatorId?: string,
  filters?: {
    status?: VoucherStatus;
    activeOnly?: boolean;
  },
) => {
  if (affiliatorId) {
    const restaurant = await getRestaurantFromAffiliatorService(affiliatorId);
    restaurantId = restaurant.id;
  }
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
      penalties: {
        where: { status: PenaltyStatus.PENDING },
      },
      approver: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Process matured vouchers auto-deduction
  try {
    await processMaturedVouchersAutoDeductionService();
  } catch (error) {
    console.error("Failed to process matured vouchers auto-deduction:", error);
  }

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
      approver: true,
    },
  });

  if (!voucher) {
    throw new Error("Voucher not found");
  }

  // Check and update maturity status
  const updatedVoucher = await checkAndUpdateVoucherMaturity(voucher);

  return updatedVoucher;
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
      approver: true,
    },
  });

  if (!voucher) {
    throw new Error("Voucher not found");
  }

  // Check and update maturity status
  const updatedVoucher = await checkAndUpdateVoucherMaturity(voucher);

  return updatedVoucher;
};

/**
 * Get restaurant's vouchers
 */

export const getRestaurantVouchersService = async (
  restaurantId: string,
  filters?: {
    status?: VoucherStatus;
    activeOnly?: boolean;
  },
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
      approver: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Process matured vouchers auto-deduction
  try {
    await processMaturedVouchersAutoDeductionService();
  } catch (error) {
    console.error("Failed to process matured vouchers auto-deduction:", error);
  }

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
  orderAmount: number,
) => {
  const vouchers = await prisma.voucher.findMany({
    where: {
      restaurantId,
      status: VoucherStatus.ACTIVE,
      remainingCredit: { gte: orderAmount },
      OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
    },
    include: {
      loan: true,
      approver: true,
    },
    orderBy: { discountPercentage: "desc" }, // Show highest discount first
  });

  // Filter out matured vouchers from available ones
  return vouchers.filter((voucher) => voucher.status === VoucherStatus.ACTIVE);
};

/**
 * Update voucher
 */
export const updateVoucherService = async (
  voucherId: string,
  data: {
    status?: VoucherStatus;
    expiryDate?: Date;
  },
) => {
  const voucher = await prisma.voucher.update({
    where: { id: voucherId },
    data,
    include: {
      restaurant: true,
      loan: true,
    },
  });

  // Find and update associated loan application if exists
  if (voucher.loan) {
    await prisma.loanApplication.update({
      where: { id: voucher.loan.id },
      data: {
        status:
          voucher.status === VoucherStatus.ACTIVE
            ? LoanStatus.APPROVED
            : voucher.status === VoucherStatus.SUSPENDED
              ? LoanStatus.REJECTED
              : voucher.status === VoucherStatus.SETTLED
                ? LoanStatus.SETTLED
                : voucher.loan.status,
      },
    });
  }

  return voucher;
};

/**
 * Deactivate/Suspend voucher
 */
export const deactivateVoucherService = async (
  voucherId: string,
  reason?: string,
) => {
  const voucher = await prisma.voucher.update({
    where: { id: voucherId },
    data: {
      status: VoucherStatus.SUSPENDED,
    },
  });

  // BROADCAST VOUCHER SUSPENSION
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: voucher.id,
      voucherCode: voucher.voucherCode,
      action: "SUSPENDED",
      timestamp: new Date().toISOString(),
      restaurantId: voucher.restaurantId || "",
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
  data: CreateLoanApplicationData,
) => {
  const { restaurantId, requestedAmount, purpose, voucherDays } = data;

  // Check loan eligibility
  const eligibility = await checkLoanEligibilityService(
    restaurantId,
    voucherDays,
  );

  if (!eligibility.isEligible) {
    throw new Error(eligibility.reason);
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
      repaymentDays: voucherDays,
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

  try {
    await sendMessage(
      `A new Loan Application worth ${
        loanApplication.requestedAmount
      } RWF has been applied by restaurant: ${
        loanApplication.restaurant?.name || ""
      } with ${loanApplication.repaymentDays} days of repayment. Thank you!`,
      process.env.PRIVATE_RECEIVER || "",
    );
  } catch (error) {
    console.error("Failed to send loan application notification:", error);
  }

  await createNotificationService({
    title: "New Voucher Application Submitted",
    message: `The restaurant ${restaurant.name} has submitted a new voucher application for RWF ${requestedAmount}. Please review and approve or reject the application.`,
    eventType: "VOUCHER_APPLIED",
    targetType: "ROLE_BASED",
    targetRole: "ADMIN",
    metadata: {
      loanApplicationId: loanApplication.id,
      restaurantId: loanApplication.restaurantId,
      requestedAmount: loanApplication.requestedAmount,
      purpose: loanApplication.purpose,
      voucherDays: loanApplication.repaymentDays,
    },
  });

  await sendAdminVoucherAppliedEmail({
    userType: "RESTAURANT",
    userName: restaurant.name,
    userEmail: restaurant.email || "",
    restaurantName: restaurant.name,
    voucherAmount: requestedAmount,
    appliedBy: restaurant.name,
  });

  // Broadcast loan application submission (if wsManager is available)
  try {
    wsManager.broadcastLoanUpdate({
      loanId: loanApplication.id,
      action: "SUBMITTED",
      timestamp: new Date().toISOString(),
      restaurantId: loanApplication.restaurantId || "",
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
      approver: true,
      manager: true,
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
  restaurantId: string,
) => {
  const loans = await prisma.loanApplication.findMany({
    where: { restaurantId },
    include: {
      vouchers: true,
      repayments: {
        orderBy: { createdAt: "desc" },
      },
      approver: true,
      manager: true,
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
      approver: true,
      manager: true,
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
  approvalData: ApproveLoanData,
) => {
  const {
    approvedAmount,
    approvedBy,
    repaymentDays,
    voucherType,
    notes,
    managedBy,
  } = approvalData;

  // Get loan details
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
    include: {
      restaurant: true,
    },
  });

  if (!loan) throw new Error("Loan not found");

  if (
    loan.status !== LoanStatus.PENDING &&
    loan.status !== LoanStatus.ACCEPTED
  ) {
    throw new Error(`Cannot approve loan with status: ${loan.status}`);
  }

  // Current date
  const currentDate = new Date();
  // Calculate due date using the provided repaymentDays
  const repaymentDueDate = new Date();
  repaymentDueDate.setDate(currentDate.getDate() + repaymentDays);

  // Calculate dates
  const disbursementDate = new Date();

  // Set voucher expiry: 48 hours from now or custom
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 2); // Voucher valid for 2 days

  // Approve loan + create voucher in a transaction

  const result = await prisma.$transaction(async (tx) => {
    // Update loan to approved with custom approved amount and repayment days
    const updatedLoan = await tx.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.APPROVED,
        approvedAmount, // Use custom approved amount
        approvedBy,
        managedBy,
        approvedAt: new Date(),
        notes,
        disbursementDate,
        repaymentDueDate,
        repaymentDays, // Use custom repayment days
      },
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
            email: true,
          },
        },
        manager: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    // Create voucher automatically with approved amount and repayment days
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
        creditLimit: approvedAmount, // Use approved amount as credit limit
        totalCredit: approvedAmount,
        remainingCredit: approvedAmount,
        paidAmount: 0,
        remainingAmount: 0,
        repaymentDays, // Use custom repayment days
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
        approver: true,
      },
    });

    try {
      await sendMessage(
        `A new ${voucher.discountPercentage}% discount voucher worth ${
          voucher.creditLimit
        } RWF has been issued for restaurant: ${
          updatedLoan.restaurant?.name || ""
        } by ${
          updatedLoan.approver?.username || voucher.approver?.username || ""
        }. Thank you!`,
        process.env.PRIVATE_RECEIVER || "",
      );
    } catch (error) {
      console.error("Failed to send subscription notification:", error);
    }

    await createNotificationService({
      title: "Voucher Issued",
      message: `A ${voucher.discountPercentage}% discount voucher worth ${voucher.creditLimit} RWF has been issued`,
      eventType: "VOUCHER_ISSUED",
      targetType: "SPECIFIC_USER",
      targetId: voucher.restaurantId || "",
      metadata: {
        voucherId: voucher.id,
        voucherCode: voucher.voucherCode,
        creditLimit: voucher.creditLimit,
        discountPercentage: voucher.discountPercentage,
      },
    });

    return { updatedLoan, voucher };
  });

  const approvedByName = await getUserById(approvedBy);
  // Send notifications
  try {
    await sendMessage(
      `A ${result.voucher.discountPercentage}% discount voucher worth ${
        result.voucher.creditLimit
      } RWF has been issued and approved by ${
        approvedByName?.name
      } for restaurant: ${result.updatedLoan.restaurant?.name || ""}.`,
      process.env.PRIVATE_RECEIVER || "",
    );
  } catch (smsError) {
    console.error("Failed to send SMS notification:", smsError);
  }

  await sendAdminVoucherApprovedEmail({
    userType: "RESTAURANT",
    userName: result.updatedLoan.restaurant?.name || "",
    userEmail: result.updatedLoan.restaurant?.email || "",
    restaurantName: result.updatedLoan.restaurant?.name,
    voucherAmount: result.voucher.creditLimit,
    appliedBy: result.updatedLoan.restaurant?.name,
    approvedBy: approvedByName?.name,
  });

  // Broadcast loan approval
  try {
    const { wsManager } = await import("../index");
    wsManager.broadcastLoanUpdate({
      loanId: result.updatedLoan.id,
      action: "APPROVED",
      timestamp: new Date().toISOString(),
      restaurantId: result.updatedLoan.restaurantId || "",
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
      restaurantId: result.voucher.restaurantId || "",
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
      restaurantId: loan.restaurantId || "",
      voucherType,
      creditLimit: loan.approvedAmount ?? 0,
      repaymentDays: loan.repaymentDays ?? 0,
      expiryDate,
      loanId: loan.id,
      approvedBy: adminId,
    });

    // Update loan status
    const updatedLoan = await tx.loanApplication.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.SETTLED,
        disbursementDate: new Date(),
        repaymentDueDate,
      },
      include: {
        restaurant: true,
        approver: true,
        manager: true,
        vouchers: true,
      },
    });

    return { loan: updatedLoan, voucher };
  });

  // BROADCAST LOAN DISBURSEMENT
  try {
    wsManager.broadcastLoanUpdate({
      loanId: result.loan.id,
      action: "PAID",
      timestamp: new Date().toISOString(),
      restaurantId: result.loan.restaurantId || "",
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
  reason?: string,
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
      approver: true,
      manager: true,
    },
  });

  // BROADCAST LOAN REJECTION
  try {
    wsManager.broadcastLoanUpdate({
      loanId: updatedLoan.id,
      action: "REJECTED",
      timestamp: new Date().toISOString(),
      restaurantId: updatedLoan.restaurantId || "",
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
  data: VoucherPaymentData,
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
      }. Voucher cannot be used for partial payments.`,
    );
  }

  // For voucher tracking, always deduct the full original amount (including fees)
  // This ensures delivery and packaging fees are also covered by the voucher
  const actualDeduction = originalAmount;

  // Get trader commission rate
  let commissionAmount = 0;
  if (voucher.approvedBy) {
    const traderWallet = await prisma.wallet.findUnique({
      where: { traderId: voucher.approvedBy },
    });
    if (traderWallet) {
      const commissionRate = traderWallet.commission / 100;
      commissionAmount = actualDeduction * commissionRate;
    }
  }

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

    // Calculate new values
    const newUsedCredit = actualDeduction; // Full amount used including fees
    const newTotalCredit = newUsedCredit; // Only the amount used, no penalties
    const newRemainingCredit = 0; // Always 0 since single-use

    // Update voucher - mark as USED after single use and save commission
    const updatedVoucher = await tx.voucher.update({
      where: { id: voucherId },
      data: {
        usedCredit: newUsedCredit,
        totalCredit: newTotalCredit,
        remainingCredit: newRemainingCredit,
        remainingAmount: newUsedCredit, // Set remaining amount to be paid
        usedAt: new Date(),
        status: VoucherStatus.USED, // Always mark as USED after single use
        commission: commissionAmount, // Save commission on voucher
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

    // Order payment status is set to VOUCHER_CREDIT (credit-based payment)
    // Order status is set to CONFIRMED
    // Payment will be COMPLETED when voucher is SETTLED (paid)
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.VOUCHER_CREDIT,
        status: OrderStatus.CONFIRMED,
      },
    });

    return { transaction, voucher: updatedVoucher };
  });

  // BROADCAST VOUCHER USAGE
  try {
    wsManager.broadcastVoucherUpdate({
      voucherId: result.voucher.id,
      voucherCode: result.voucher.voucherCode,
      action: "CREATED",
      timestamp: new Date().toISOString(),
      restaurantId: result.voucher.restaurantId || "",
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
  restaurantId: string,
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
  const { restaurantId, paymentMethod, voucherId, paymentReference } = data;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Get voucher details first
  const voucher = await getVoucherByIdService(voucherId);

  if (voucher.restaurantId !== restaurantId) {
    throw new Error("Voucher does not belong to this restaurant");
  }

  // Check if voucher has been used
  if (voucher.usedCredit <= 0) {
    throw new Error("Voucher has no used credit to repay");
  }

  // Use voucher's used credit as the repayment amount
  const amount = voucher.usedCredit;

  // Process payment for voucher repayment
  const paymentResult = await processRepaymentPaymentService({
    amount,
    paymentMethod,
    restaurantId,
    voucherId,
    paymentReference,
    email: restaurant.email || "",
    fullname: restaurant.name,
  });

  console.log("paymentResult------", paymentResult);

  if (!paymentResult.success) {
    throw new Error(`Payment failed: ${paymentResult.message}`);
  }

  // Create repayment record and update voucher status to SETTLED
  const result = await prisma.$transaction(async (tx) => {
    const repayment = await tx.voucherRepayment.create({
      data: {
        voucherId,
        restaurantId,
        loanId: voucher.loanId,
        amount,
        paymentMethod,
        paymentReference: paymentResult.reference || "",
        allocatedToPrincipal: amount,
        allocatedToServiceFee: 0,
        allocatedToPenalty: 0,
      },
      include: {
        voucher: true,
        loan: true,
      },
    });

    // Update voucher and loan status to SETTLED when repayment is made
    await tx.voucher.update({
      where: { id: voucherId },
      data: {
        status: VoucherStatus.SETTLED,
      },
    });

    // If there's an associated loan, check if fully repaid
    if (voucher.loanId) {
      // Calculate outstanding balance
      const transactions = await tx.voucherTransaction.findMany({
        where: { voucher: { loanId: voucher.loanId } },
      });

      const repayments = await tx.voucherRepayment.findMany({
        where: { loanId: voucher.loanId },
      });

      const penalties = await tx.voucherPenalty.findMany({
        where: {
          voucher: { loanId: voucher.loanId },
          status: "PENDING",
        },
      });

      const totalUsed = transactions.reduce(
        (sum, t) => sum + t.amountCharged,
        0,
      );
      const totalServiceFees = transactions.reduce(
        (sum, t) => sum + t.serviceFee,
        0,
      );
      const totalPenalties = penalties.reduce(
        (sum, p) => sum + p.penaltyAmount,
        0,
      );
      const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);

      const outstanding =
        totalUsed + totalServiceFees + totalPenalties - totalRepayments;

      // If fully paid, update loan and voucher status
      if (outstanding <= 0) {
        await tx.loanApplication.update({
          where: { id: voucher.loanId },
          data: { status: "SETTLED" },
        });

        await tx.voucher.updateMany({
          where: { loanId: voucher.loanId },
          data: { status: "SETTLED" },
        });
      }
    }

    // Update all orders with this voucher to COMPLETED payment status
    await tx.order.updateMany({
      where: {
        voucherId: voucherId,
        paymentStatus: PaymentStatus.VOUCHER_CREDIT,
      },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      },
    });

    return repayment;
  });

  return { repayment: result, paymentResult };
};

/**
 * Calculate outstanding balance
 */
export const calculateOutstandingBalanceService = async (loanId: string) => {
  const loan = await getLoanApplicationByIdService(loanId);

  if (!loan.approvedAmount) {
    throw new Error("Loan has no approved amount");
  }

  // Get voucher for this loan (single voucher per loan)
  const voucher = await prisma.voucher.findFirst({
    where: { loanId },
  });

  if (!voucher) {
    return {
      totalCredit: loan.approvedAmount,
      totalUsed: 0,
      totalRepayments: 0,
      total: 0,
    };
  }

  // Get repayments
  const repayments = await prisma.voucherRepayment.findMany({
    where: { loanId },
  });

  const totalRepayments = repayments.reduce((sum, r) => sum + r.amount, 0);
  const totalUsed = voucher.usedCredit;
  const outstanding = totalUsed - totalRepayments;

  return {
    totalCredit: loan.approvedAmount,
    totalUsed,
    totalRepayments,
    total: Math.max(0, outstanding),
  };
};

// ============================================
// PENALTY SERVICES
// ============================================

/**
 * Calculate and apply penalties for overdue loans
 */
export const calculatePenaltiesService = async (
  loanId?: string,
  penaltyRatePerMonth: number = 2, // 2% per month default
) => {
  let loans;

  if (loanId) {
    loans = [await getLoanApplicationByIdService(loanId)];
  } else {
    // Get all disbursed loans
    loans = await prisma.loanApplication.findMany({
      where: {
        status: LoanStatus.SETTLED,
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
        (1000 * 60 * 60 * 24),
    );

    if (daysOverdue <= 0) continue; // Not overdue

    // Calculate outstanding balance
    const outstanding = await calculateOutstandingBalanceService(loan.id);

    if (outstanding.total <= 0) continue; // Already paid

    // Calculate penalty based on total outstanding amount
    const monthsOverdue = daysOverdue / 30;
    const penaltyAmount =
      outstanding.total * (penaltyRatePerMonth / 100) * monthsOverdue;

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
            2,
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

      // BROADCAST PENALTY APPLICATION
      try {
        wsManager.broadcastPenaltyUpdate({
          penaltyId: penalty.id,
          loanId: loan.id,
          voucherId: voucher.id,
          action: "APPLIED",
          timestamp: new Date().toISOString(),
          restaurantId: loan.restaurantId || "",
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

      // BROADCAST VOUCHER SUSPENSION
      try {
        for (const voucher of loan.vouchers) {
          wsManager.broadcastVoucherUpdate({
            voucherId: voucher.id,
            voucherCode: voucher.voucherCode,
            action: "SUSPENDED",
            timestamp: new Date().toISOString(),
            restaurantId: loan.restaurantId || "",
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
  reason?: string,
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

  // BROADCAST PENALTY WAIVER
  try {
    wsManager.broadcastPenaltyUpdate({
      penaltyId: penalty.id,
      loanId: existingPenalty.voucher.restaurantId || "", // This should be loanId from voucher
      voucherId: penalty.voucherId,
      action: "WAIVED",
      timestamp: new Date().toISOString(),
      restaurantId: existingPenalty.voucher.restaurantId || "",
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
  voucherId: string,
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
  restaurantId: string,
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
      approver: true,
    },
  });

  // Calculate totals
  const totalCreditIssued = vouchers.reduce((sum, v) => sum + v.totalCredit, 0);
  const totalUsed = vouchers.reduce((sum, v) => sum + v.usedCredit, 0);
  const totalRemaining = vouchers.reduce(
    (sum, v) => sum + v.remainingCredit,
    0,
  );

  // Get all transactions
  const allTransactions = vouchers.flatMap((v) => v.transactions);
  const totalServiceFees = allTransactions.reduce(
    (sum, t) => sum + t.serviceFee,
    0,
  );

  // Get all penalties
  const allPenalties = vouchers.flatMap((v) => v.penalties);
  const totalPenalties = allPenalties.reduce(
    (sum, p) => sum + p.penaltyAmount,
    0,
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
  restaurantId: string,
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
  orderAmount: number,
  restaurantId?: string,
  affiliatorId?: string,
  promoCode?: string,
) => {
  try {
    if (affiliatorId) {
      const restaurant = await getRestaurantFromAffiliatorService(affiliatorId);
      restaurantId = restaurant.id;
    }

    // Check subscription
    await checkRestaurantSubscription(restaurantId!);

    let finalOrderAmount = orderAmount;
    let promoDetails = null;

    // Apply promo code if provided
    if (promoCode) {
      try {
        // Get cart items for promo validation
        const cart = await prisma.cart.findFirst({
          where: {
            restaurantId,
            status: "ACTIVE",
          },
          include: { cartItems: true },
        });

        if (!cart || cart.cartItems.length === 0) {
          return {
            valid: false,
            error: "Cart not found or empty",
          };
        }

        const items = cart.cartItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        }));

        const promoResult = await applyPromoCodeService(
          promoCode,
          restaurantId!,
          "temp_voucher_validation",
          items,
        );
        finalOrderAmount = promoResult.finalAmount;
        promoDetails = {
          code: promoResult.promoCode.code,
          discountAmount: promoResult.discountAmount,
          originalAmount: orderAmount,
          finalAmount: finalOrderAmount,
        };
      } catch (promoError: any) {
        return {
          valid: false,
          error: `Promo code error: ${promoError.message}`,
        };
      }
    }

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

    // Check credit limit against final amount (after promo discount)
    if (voucher.creditLimit < finalOrderAmount) {
      return {
        valid: false,
        error: `Voucher credit limit (${voucher.creditLimit}) is less than order amount (${finalOrderAmount})`,
      };
    }

    // Check remaining credit
    if (voucher.remainingCredit <= 0) {
      return {
        valid: false,
        error: "Voucher has no remaining credit",
      };
    }

    // Calculate coverage based on final amount
    const discountAmount =
      finalOrderAmount * (voucher.discountPercentage / 100);
    const amountCharged = finalOrderAmount - discountAmount;
    const serviceFee = amountCharged * (voucher.serviceFeeRate / 100);
    const totalRequired = amountCharged + serviceFee;

    // Voucher MUST cover full amount - NO PARTIAL PAYMENTS
    const canCoverFullAmount = voucher.remainingCredit >= totalRequired;

    if (!canCoverFullAmount) {
      return {
        valid: false,
        error: `Insufficient voucher credit. Required: ${totalRequired.toFixed(
          2,
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
      promoDetails,
      coverage: {
        originalOrderAmount: orderAmount,
        finalOrderAmount,
        discountAmount,
        amountAfterDiscount: amountCharged,
        serviceFee,
        totalRequired,
        voucherCovers: totalRequired,
        canCoverFullAmount: true,
        remainingAfterPurchase: voucher.remainingCredit - totalRequired,
      },
      message: `Voucher will cover the full order amount of ${totalRequired.toFixed(
        2,
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
    (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
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
      "No active subscription found. Please subscribe to access voucher features.",
    );
  }

  // Check if plan has voucher access enabled
  if (!activeSubscription.plan.voucherAccess) {
    throw new Error(
      `Your current subscription plan (${activeSubscription.plan.name}) does not include voucher access. Please upgrade to a plan with voucher features.`,
    );
  }

  // Check if voucherPaymentDays is set
  if (!activeSubscription.plan.voucherPaymentDays) {
    throw new Error(
      `Your subscription plan does not have voucher payment days configured. Please contact support.`,
    );
  }

  return activeSubscription;
};

/**
 * Check if restaurant can request a new loan
 * Returns eligibility status and details
 */
export const checkLoanEligibilityService = async (
  restaurantId: string,
  requestedRepaymentDays: number,
): Promise<LoanEligibilityCheck> => {
  // Get subscription info to validate voucher days
  const subscriptionInfo = await checkRestaurantSubscription(restaurantId);
  const maxVoucherDays = subscriptionInfo.plan.voucherPaymentDays;

  // Validate voucherDays against subscription limit
  if (requestedRepaymentDays && requestedRepaymentDays > maxVoucherDays) {
    return {
      isEligible: false,
      reason: `Requested repayment days (${requestedRepaymentDays}) exceeds the maximum voucher payment days (${maxVoucherDays}). Please choose a lower number of repayment days.`,
    };
  }

  // Get all vouchers for the restaurant excluding EXPIRED, SETTLED, SUSPENDED
  const vouchers = await prisma.voucher.findMany({
    where: {
      restaurantId,
      status: {
        notIn: ["EXPIRED", "SETTLED", "SUSPENDED"],
      },
    },
    include: {
      loan: {
        select: {
          id: true,
          status: true,
          repaymentDueDate: true,
          repaymentDays: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc", // Get oldest first for comparison
    },
  });

  // Check and update maturity status for each voucher
  for (const voucher of vouchers) {
    await checkAndUpdateVoucherMaturity(voucher);
  }

  // Re-fetch vouchers after maturity check to get updated statuses
  const updatedVouchers = await prisma.voucher.findMany({
    where: {
      restaurantId,
      status: {
        notIn: ["EXPIRED", "SETTLED", "SUSPENDED"],
      },
    },
    include: {
      loan: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (updatedVouchers.length === 0) {
    return {
      isEligible: true,
      reason: "No existing vouchers found. Eligible for new voucher.",
    };
  }

  // Count vouchers by status
  const maturedVouchers = updatedVouchers.filter((v) => v.status === "MATURED");

  // Check for any MATURED vouchers - these must be settled first
  if (maturedVouchers.length > 0) {
    const maturedCodes = maturedVouchers.map((v) => v.voucherCode).join(", ");
    return {
      isEligible: false,
      reason: `You have ${maturedVouchers.length} matured voucher(s) that need to be settled: ${maturedCodes}. Please settle these before requesting new credit.`,
    };
  }

  // Check for vouchers with repayment days
  const vouchersWithRepaymentDays = updatedVouchers.filter(
    (v) => v.repaymentDays && v.repaymentDays > 0,
  );

  // Get the first voucher with repayment days (oldest)
  const firstVoucher = vouchersWithRepaymentDays[0];
  const firstVoucherRepaymentDays = firstVoucher.repaymentDays;

  // Check repayment days limitation based on first voucher
  if (requestedRepaymentDays >= firstVoucherRepaymentDays) {
    return {
      isEligible: false,
      reason: `Cannot request voucher with ${requestedRepaymentDays} repayment days. Maximum allowed is ${
        firstVoucherRepaymentDays - 1
      } days (less than your first voucher's ${firstVoucherRepaymentDays} days).`,
    };
  }

  // If no repayment days specified, provide guidance
  return {
    isEligible: true,
    reason: `You can request a new voucher with repayment days less than ${firstVoucherRepaymentDays} days (your first voucher's repayment period). Recommended: ${Math.max(
      15,
      Math.floor(firstVoucherRepaymentDays * 0.7),
    )} days.`,
  };
};

/**
 * Mark voucher as USED after successful order completion
 * This should be called ONLY when order is successfully delivered/completed
 */
export const markVoucherAsUsedService = async (
  voucherId: string,
  orderId: string,
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
      `Cannot mark voucher as USED for order with status: ${order.status}`,
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
      restaurantId: updatedVoucher.restaurantId || "",
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
  orderId: string,
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
        usedCredit: Math.max(
          0,
          transaction.voucher.usedCredit - transaction.totalDeducted,
        ),
        remainingCredit: Math.min(
          transaction.voucher.totalCredit,
          transaction.voucher.remainingCredit + transaction.totalDeducted,
        ),
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
      restaurantId: result.restaurantId || "",
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

/**
 * Mark loan application as accepted
 */
export const markLoanApplicationAsAcceptedService = async (
  loanId: string,
  acceptanceData?: { acceptedAmount?: number; paymentDays?: number },
) => {
  const updateData: any = {
    status: LoanStatus.ACCEPTED,
  };

  // If admin provides accepted amount and payment days, update them
  if (acceptanceData?.acceptedAmount) {
    updateData.approvedAmount = acceptanceData.acceptedAmount;
  }
  if (acceptanceData?.paymentDays) {
    updateData.repaymentDays = acceptanceData.paymentDays;
  }

  const loan = await prisma.loanApplication.update({
    where: { id: loanId },
    data: updateData,
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

  // Broadcast loan status update
  try {
    wsManager.broadcastLoanUpdate({
      loanId: loan.id,
      action: "ACCEPTED",
      timestamp: new Date().toISOString(),
      restaurantId: loan.restaurantId || "",
      data: {
        status: loan.status,
        requestedAmount: loan.requestedAmount,
        approvedAmount: loan.approvedAmount || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast loan acceptance:", error);
  }

  return loan;
};

/**
 * Delete loan application (only if no voucher assigned)
 */
export const deleteLoanApplicationService = async (
  loanId: string,
  userId: string,
  userRole: string,
) => {
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
    include: {
      vouchers: true,
      restaurant: true,
    },
  });

  if (!loan) {
    throw new Error("Loan application not found");
  }

  // Check authorization
  if (userRole === "RESTAURANT" && loan.restaurantId !== userId) {
    throw new Error(
      "Unauthorized: Cannot delete other restaurant's loan application",
    );
  }

  // Check if loan has vouchers assigned
  if (loan.vouchers && loan.vouchers.length > 0) {
    throw new Error(
      "Cannot delete loan application: Voucher has been assigned",
    );
  }

  // Only allow deletion of pending or rejected loans
  const deletableStatuses: LoanStatus[] = [
    LoanStatus.PENDING,
    LoanStatus.REJECTED,
  ];
  if (!deletableStatuses.includes(loan.status)) {
    throw new Error(
      `Cannot delete loan application with status: ${loan.status}`,
    );
  }

  // Delete the loan application
  await prisma.loanApplication.delete({
    where: { id: loanId },
  });

  // Broadcast loan deletion
  try {
    wsManager.broadcastLoanUpdate({
      loanId: loan.id,
      action: "SETTLED",
      timestamp: new Date().toISOString(),
      restaurantId: loan.restaurantId || "",
      data: {
        requestedAmount: loan.requestedAmount,
        status: loan.status,
      },
    });
  } catch (error) {
    console.error("Failed to broadcast loan deletion:", error);
  }

  return { message: "Loan application deleted successfully" };
};

/**
 * Process actual payment for repayments
 */
export const processRepaymentPaymentService = async (data: {
  amount: number;
  paymentMethod: string;
  restaurantId: string;
  voucherId: string;
  paymentReference?: string;
  email?: string;
  fullname?: string;
}) => {
  console.log("Processing repayment payment with data:", data);

  const { amount, paymentMethod, restaurantId } = data;
  const txRef = data.paymentReference || `repay_${Date.now()}`;

  try {
    switch (paymentMethod) {
      case "MOBILE_MONEY":
      case "CARD":
        // Use Flutterwave's hosted checkout for both mobile money and card payments
        return await processFlutterwaveHostedPayment({
          amount,
          txRef,
          email: data.email || "",
          fullname: data.fullname || "",
          currency: "RWF",
          paymentMethod,
        });

      case "BANK_TRANSFER":
        return await processBankTransfer({
          amount,
          txRef,
          email: data.email || "",
          phoneNumber: "",
          currency: "RWF",
          clientIp: "",
          deviceFingerprint: "62wd23423rq324323qew1",
        });

      case "CASH":
        const wallet = await getWalletByRestaurantIdService(restaurantId);

        if (!wallet.isActive) {
          throw new Error("Wallet is inactive. Please contact support.");
        }

        if (wallet.balance < amount) {
          throw new Error(
            `Insufficient wallet balance. Available: ${wallet.balance} ${wallet.currency}, Required: ${amount} RWF`,
          );
        }

        const walletDebitResult = await debitWalletService({
          walletId: wallet.id,
          amount,
          description: `Voucher repayment for ${data.voucherId}`,
          reference: `repay_${data.voucherId}`,
          voucherId: `repay_${data.voucherId}`,
        });

        return {
          success: true,
          transactionId: `WALLET_${Date.now()}`,
          reference: `WALLET-${Date.now()}`,
          message: "Repayment completed using wallet balance",
          walletDetails: {
            previousBalance: walletDebitResult.transaction.previousBalance,
            newBalance: walletDebitResult.newBalance,
            transactionId: walletDebitResult.transaction.id,
          },
        };

      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Payment processing failed",
    };
  }
};

async function processFlutterwaveHostedPayment({
  amount,
  txRef,
  email,
  fullname,
  currency = "RWF",
  paymentMethod,
}: any) {
  try {
    // Determine payment options based on method
    let paymentOptions = "";
    if (paymentMethod === "MOBILE_MONEY") {
      paymentOptions = "mobilemoney";
    } else if (paymentMethod === "CARD") {
      paymentOptions = "card";
    }

    const standardPayload = {
      tx_ref: txRef,
      amount: amount.toString(),
      currency: currency,
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/confirmation`,
      customer: {
        email: email,
        name: fullname,
      },
      payment_options: paymentOptions,
    };

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      standardPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data?.status === "success" && response.data?.data?.link) {
      return {
        success: true,
        transactionId: txRef,
        reference: txRef,
        status: "pending",
        message: "Redirect to complete payment",
        redirectUrl: response.data.data.link,
      };
    }
    throw new Error(`${paymentMethod} payment failed`);
  } catch (error: any) {
    return {
      success: false,
      transactionId: "",
      reference: "",
      status: "failed",
      message: error.message || `${paymentMethod} payment failed`,
    };
  }
}

async function processBankTransfer({
  amount,
  txRef,
  email,
  phoneNumber,
  currency = "RWF",
  clientIp,
  deviceFingerprint,
}: any) {
  try {
    const payload = {
      tx_ref: txRef,
      amount: amount.toString(),
      email: email,
      phone_number: phoneNumber,
      currency: currency,
      client_ip: clientIp,
      device_fingerprint: deviceFingerprint,
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/confirmation`,
    };

    const Flutterwave = require("flutterwave-node-v3");
    const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
    const response = await flw.Charge.bank_transfer(payload);
    if (response.status === "success") {
      return {
        success: true,
        transactionId: response.data?.flw_ref || txRef,
        reference: response.data?.tx_ref || txRef,
        status: response.data?.status || "pending",
        message: response.message || "Bank transfer initiated",
      };
    }
    throw new Error("Bank transfer failed");
  } catch (error: any) {
    return {
      success: false,
      transactionId: "",
      reference: "",
      status: "failed",
      message: error.message || "Bank transfer failed",
    };
  }
}

/**
 * Auto-deduction service for matured vouchers
 */
export const processMaturedVouchersAutoDeductionService = async () => {
  try {
    // First, check and update voucher maturity status for all vouchers
    const allVouchers = await prisma.voucher.findMany({
      where: {
        status: {
          in: [VoucherStatus.ACTIVE, VoucherStatus.USED],
        },
      },
    });

    for (const voucher of allVouchers) {
      await checkAndUpdateVoucherMaturity(voucher);
    }

    // Initialize remaining amounts for existing vouchers that don't have them set
    const vouchersToUpdate = await prisma.voucher.findMany({
      where: {
        remainingAmount: 0,
        usedCredit: { gt: 0 },
      },
    });

    for (const voucher of vouchersToUpdate) {
      await prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          remainingAmount: voucher.usedCredit,
        },
      });
    }

    const restaurantsWithMaturedVouchers = await prisma.restaurant.findMany({
      where: {
        Voucher: {
          some: {
            status: VoucherStatus.MATURED,
            remainingAmount: { gt: 0 },
          },
        },
      },
      include: {
        Wallet: true,
        Voucher: {
          where: {
            status: VoucherStatus.MATURED,
            remainingAmount: { gt: 0 },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (restaurantsWithMaturedVouchers.length === 0) {
      return { processed: 0, message: "No matured vouchers to process" };
    }

    let totalProcessed = 0;
    for (const restaurant of restaurantsWithMaturedVouchers) {
      if (!restaurant.Wallet) continue;

      let currentBalance = restaurant.Wallet.balance;
      let totalDeducted = 0;
      const processedVouchers = [];

      for (const voucher of restaurant.Voucher) {
        const remainingAmount = voucher.remainingAmount;
        if (remainingAmount <= 0) continue;

        if (currentBalance >= remainingAmount) {
          // Full payment
          currentBalance -= remainingAmount;
          totalDeducted += remainingAmount;

          await prisma.voucher.update({
            where: { id: voucher.id },
            data: {
              status: VoucherStatus.SETTLED,
              paidAmount: voucher.usedCredit,
              remainingAmount: 0,
            },
          });

          processedVouchers.push({
            voucherId: voucher.id,
            amount: remainingAmount,
            status: "SETTLED",
          });
          totalProcessed++;
        } else if (currentBalance > 0) {
          // Partial payment
          const deductedAmount = currentBalance;
          const newRemainingAmount = remainingAmount - deductedAmount;
          totalDeducted += deductedAmount;
          currentBalance = 0;

          await prisma.voucher.update({
            where: { id: voucher.id },
            data: {
              paidAmount: voucher.paidAmount + deductedAmount,
              remainingAmount: newRemainingAmount,
            },
          });

          processedVouchers.push({
            voucherId: voucher.id,
            amount: deductedAmount,
            status: "PARTIALLY_PAID",
          });
          totalProcessed++;
          break;
        } else {
          break;
        }

        await prisma.walletTransaction.create({
          data: {
            walletId: restaurant.Wallet.id,
            restaurantId: restaurant.id,
            type: WalletTransactionType.PAYMENT,
            amount: -processedVouchers[processedVouchers.length - 1].amount,
            previousBalance:
              currentBalance +
              processedVouchers[processedVouchers.length - 1].amount,
            newBalance: currentBalance,
            description: `Auto-deduction for matured voucher`,
            reference: voucher.id,
            status: TransactionStatus.COMPLETED,
          },
        });
      }

      if (totalDeducted > 0) {
        await prisma.wallet.update({
          where: { id: restaurant.Wallet.id },
          data: { balance: currentBalance },
        });

        // Send notifications
        try {
          await createNotificationService({
            title: "Matured Vouchers Auto-Deduction",
            message: `${totalDeducted.toLocaleString()} RWF deducted for ${processedVouchers.length} matured voucher(s)`,
            eventType: "VOUCHER_APPLIED",
            targetType: "ROLE_BASED",
            targetRole: "ADMIN",
          });

          await sendWalletNotificationEmail({
            email: process.env.ADMIN_EMAIL || "",
            restaurantName: "Admin",
            type: "PAYMENT",
            amount: totalDeducted,
            newBalance: currentBalance,
            transactionId: `AUTO_DEDUCTION_${Date.now()}`,
            description: `Auto-deduction completed for ${restaurant.name}: ${processedVouchers.length} matured voucher(s) processed`,
          });

          if (restaurant.phone) {
            await sendMessage(
              `Dear ${restaurant.name}, ${totalDeducted.toLocaleString()} RWF deducted for matured vouchers. New balance: ${currentBalance.toLocaleString()} RWF.`,
              restaurant.phone,
            );
          }

          if (restaurant.email) {
            await sendWalletNotificationEmail({
              email: restaurant.email,
              restaurantName: restaurant.name,
              type: "PAYMENT",
              amount: totalDeducted,
              newBalance: currentBalance,
              transactionId: `AUTO_DEDUCTION_${Date.now()}`,
              description: `Auto-deduction for ${processedVouchers.length} matured voucher(s)`,
            });
          }

          await sendMessage(
            `Auto-deduction: ${restaurant.name} - ${totalDeducted.toLocaleString()} RWF deducted for ${processedVouchers.length} voucher(s)`,
            process.env.PRIVATE_RECEIVER || "",
          );
        } catch (error) {
          console.error("Failed to send notifications:", error);
        }
      }
    }

    // Process commission to traders for settled vouchers
    try {
      await processAllTradersCommissionService();
    } catch (error) {
      console.error(
        "Failed to process commission to traders for settled vouchers:",
        error,
      );
    }

    return {
      processed: totalProcessed,
      message: `Processed ${totalProcessed} matured vouchers`,
    };
  } catch (error: any) {
    console.error("Auto-deduction error:", error);
    throw new Error(`Auto-deduction failed: ${error.message}`);
  }
};

// Process all expired vouchers and return trader's pending approved amounts
export const processExpiredVouchersService = async () => {
  try {
    const expiredVouchers = await prisma.voucher.findMany({
      where: {
        status: "EXPIRED",
        approvedBy: { not: null },
      },
      include: { approver: true, loan: true },
    });

    const results = [];

    for (const voucher of expiredVouchers) {
      if (!voucher.approvedBy || !voucher.loan) continue;

      const traderWallet = await prisma.wallet.findUnique({
        where: { traderId: voucher.approvedBy },
      });

      if (!traderWallet) continue;

      // Check if already processed
      const existingTransaction = await prisma.walletTransaction.findFirst({
        where: {
          walletId: traderWallet.id,
          reference: voucher.id,
          type: "REVERSAL",
          isReversed: true,
        },
      });

      if (existingTransaction) continue;

      const approvedAmount = voucher.loan.approvedAmount || voucher.creditLimit;

      await prisma.wallet.update({
        where: { id: traderWallet.id },
        data: {
          pendingApprovedAmount: Math.max(
            0,
            traderWallet.pendingApprovedAmount - approvedAmount,
          ),
        },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: traderWallet.id,
          adminId: voucher.approvedBy,
          type: "REVERSAL",
          amount: 0,
          previousBalance: traderWallet.balance,
          newBalance: traderWallet.balance,
          reference: voucher.id,
          isReversed: true,
          description: `Returned pending amount from expired voucher ${voucher.voucherCode}`,
          status: "COMPLETED",
        },
      });

      // Send notifications
      const trader = await prisma.admin.findUnique({
        where: { id: voucher.approvedBy },
      });

      if (trader) {
        await sendMessage(
          `Expired voucher ${voucher.voucherCode}: ${approvedAmount} RWF returned to available balance`,
          trader.phone || "",
        );

        await createNotificationService({
          title: "Expired Voucher Processed",
          message: `${approvedAmount} RWF from expired voucher ${voucher.voucherCode} returned to available balance`,
          eventType: "PAYMENT_PROCESSED",
          targetType: "SPECIFIC_USER",
          targetId: voucher.approvedBy,
          metadata: { voucherId: voucher.id, approvedAmount },
        });

        // Calculate correct pending approved amount based on voucher usage
        const activeVouchers = await prisma.voucher.findMany({
          where: {
            approvedBy: trader.id,
            status: { in: ["ACTIVE", "USED"] },
          },
        });

        // For used vouchers, available balance equals current balance since used amounts are already deducted
        // Only subtract unused amounts from ACTIVE vouchers (not yet used)
        const activeUnusedAmount = activeVouchers
          .filter((voucher) => voucher.status === "ACTIVE")
          .reduce((total, voucher) => {
            return total + (voucher.creditLimit - voucher.usedCredit);
          }, 0);

        // Create trader transaction record
        await createTraderTransactionService({
          traderId: trader.id,
          type: "LOAN_REVERSAL",
          amount: approvedAmount,
          loanId: voucher.loanId || voucher.loan?.id || undefined,
          description: `Loan reversal of ${approvedAmount} RWF for expired voucher ${voucher.voucherCode} and money is returned to the wallet. Your available balance is ${traderWallet.balance - activeUnusedAmount - traderWallet.pendingWithdrawBalance} RWF.`,
        });
      }

      await sendMessage(
        `Trader ${trader?.username} - expired voucher ${voucher.voucherCode}: ${approvedAmount} RWF returned`,
        process.env.PRIVATE_RECEIVER || "",
      );

      results.push({
        voucherId: voucher.id,
        voucherCode: voucher.voucherCode,
        traderId: voucher.approvedBy,
        approvedAmount,
        success: true,
      });
    }

    return results;
  } catch (error: any) {
    console.error("Error processing expired vouchers:", error.message);
    return [];
  }
};
