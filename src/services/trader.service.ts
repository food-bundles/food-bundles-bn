import prisma from "../prisma";
import { topUpWalletService } from "./wallet.service";
import {
  getAllLoanApplicationsService,
  approveLoanApplicationService,
  getAllVouchersService,
} from "./voucher.service";
import { createNotificationService } from "./notification.services";
import { wsManager } from "../index";
import { sendMessage } from "../utils/sms.utility";
import {
  sendAdminVoucherApprovedEmail,
  sendTraderLoanApprovalEmail,
} from "../utils/emailTemplates";
import { VoucherType } from "@prisma/client";

// Create trader transaction record
const createTraderTransactionService = async (data: {
  traderId: string;
  type:
    | "LOAN_APPROVAL"
    | "COMMISSION_EARNED"
    | "COMMISSION_PAID"
    | "WALLET_TOPUP"
    | "WALLET_DEBIT";
  amount: number;
  orderId?: string;
  voucherId?: string;
  loanId?: string;
  reference?: string;
  description?: string;
  commissionRate?: number;
}) => {
  return await prisma.traderTransaction.create({
    data: {
      traderId: data.traderId,
      type: data.type,
      amount: data.amount,
      orderId: data.orderId,
      voucherId: data.voucherId,
      loanId: data.loanId,
      reference: data.reference,
      description: data.description,
      commissionRate: data.commissionRate,
      status: "COMPLETED",
    },
  });
};

// Create trader wallet
export const createTraderWalletService = async (traderId: string) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Check if wallet exists
  const existingWallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  if (existingWallet) {
    throw new Error("Trader wallet already exists");
  }

  const wallet = await prisma.wallet.create({
    data: {
      traderId,
      balance: 0,
      currency: "RWF",
    },
  });

  return wallet;
};

// Get trader wallet
export const getTraderWalletService = async (traderId: string) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: {
      trader: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  return wallet;
};

// Top up trader wallet
export const topUpTraderWalletService = async (data: {
  traderId: string;
  amount: number;
  paymentMethod: string;
  phoneNumber?: string;
  description?: string;
}) => {
  const traderWallet = await getTraderWalletService(data.traderId);

  return await topUpWalletService({
    walletId: traderWallet.id,
    traderId: data.traderId,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    phoneNumber: data.phoneNumber,
    description: data.description || "Trader wallet top-up",
  });
};

// Get loan applications for trader - only ACCEPTED loans and those approved by this trader
export const getTraderLoanApplicationsService = async (
  traderId: string,
  filters?: any,
) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Build pagination
  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause for trader-specific loans
  const where: any = {
    OR: [
      { status: "ACCEPTED" }, // All accepted loans
      { approvedBy: traderId }, // Loans approved by this trader
    ],
  };

  // Add additional filters
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.restaurantId) {
    where.restaurantId = filters.restaurantId;
  }

  const [loans, total] = await Promise.all([
    prisma.loanApplication.findMany({
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
        vouchers: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.loanApplication.count({ where }),
  ]);

  return {
    loans,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get vouchers for trader - loans with ACCEPTED status and those approved by him/her
export const getTraderVouchersService = async (
  traderId: string,
  filters?: any,
) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Build pagination
  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const skip = (page - 1) * limit;

  // Build where clause for trader-specific vouchers
  const where: any = {
    OR: [
      { loan: { status: "ACCEPTED" } }, // Vouchers from accepted loans
      { approvedBy: traderId }, // Vouchers approved by this trader
    ],
  };

  // Add additional filters
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.restaurantId) {
    where.restaurantId = filters.restaurantId;
  }

  const [vouchers, total] = await Promise.all([
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
        repayments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        penalties: {
          where: { status: "PENDING" },
        },
        approver: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.voucher.count({ where }),
  ]);

  return {
    vouchers,
    statistics: {
      totalVouchers: vouchers.length,
      acceptedLoanVouchers: vouchers.filter(
        (v) => (v as any).loan?.status === "ACCEPTED",
      ).length,
      approvedByTrader: vouchers.filter((v) => v.approvedBy === traderId)
        .length,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Approve loan with wallet balance check - only allow approving ACCEPTED loans
export const traderApproveLoanService = async (
  traderId: string,
  loanId: string,
) => {
  // Check if loan exists and is in ACCEPTED status
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new Error("Loan application not found");
  }

  // Only allow approving loans that are in ACCEPTED status
  if (loan.status !== "ACCEPTED") {
    throw new Error("Can only approve loans with ACCEPTED status");
  }

  // Get restaurant's active subscription for repayment days fallback
  let defaultRepaymentDays = 30;
  if (loan.restaurantId) {
    const activeSubscription = await prisma.restaurantSubscription.findFirst({
      where: {
        restaurantId: loan.restaurantId,
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
      include: { plan: true },
    });
    if (activeSubscription) {
      defaultRepaymentDays = activeSubscription.plan.voucherPaymentDays;
    }
  }

  // Use loan application data for approval
  const approvalData = {
    approvedAmount: loan.requestedAmount,
    repaymentDays: loan.repaymentDays || defaultRepaymentDays,
    voucherType: "DISCOUNT_100" as VoucherType,
    notes: loan.purpose || "Loan approved by trader",
  };

  const { approvedAmount } = approvalData;

  // Check trader wallet balance
  const traderWallet = await getTraderWalletService(traderId);

  if (traderWallet.balance < approvedAmount) {
    throw new Error(
      `Insufficient wallet balance. Available: ${traderWallet.balance} RWF, Required: ${approvedAmount} RWF`,
    );
  }

  // Deduct amount from trader wallet balance and add to pending approved amount
  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: {
      balance: traderWallet.balance - approvedAmount,
      pendingApprovedAmount:
        traderWallet.pendingApprovedAmount + approvedAmount,
    },
  });

  // Create wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId: traderId,
      type: "TRADING",
      amount: -approvedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance - approvedAmount,
      description: `Loan approval for ${loanId}`,
      status: "COMPLETED",
    },
  });

  // Create trader transaction record
  await createTraderTransactionService({
    traderId,
    type: "LOAN_APPROVAL",
    amount: -approvedAmount,
    loanId,
    description: `Loan approval for ${approvedAmount} RWF`,
  });

  // Approve the loan
  const result = await approveLoanApplicationService(loanId, {
    ...approvalData,
    approvedBy: traderId,
  });

  // Send notifications
  await sendLoanApprovalNotifications(traderId, result, approvedAmount);

  return result;
};

// Send loan approval notifications
async function sendLoanApprovalNotifications(
  traderId: string,
  result: any,
  approvedAmount: number,
) {
  try {
    // Get trader info
    const trader = await prisma.admin.findUnique({
      where: { id: traderId },
      select: { username: true, email: true, phone: true },
    });

    // Get restaurant info from the loan
    const loan = await prisma.loanApplication.findUnique({
      where: { id: result.loanId },
      include: {
        restaurant: {
          select: { name: true, email: true, phone: true },
        },
      },
    });

    // Get updated wallet balance
    const wallet = await getTraderWalletService(traderId);

    if (loan?.restaurant && trader) {
      // Send email to trader
      try {
        await sendTraderLoanApprovalEmail({
          traderEmail: trader.email || "",
          traderName: trader.username,
          restaurantName: loan.restaurant.name,
          approvedAmount,
          loanId: result.loanId,
          walletBalance: wallet.balance,
        });
      } catch (emailError) {
        console.error("Failed to send trader email notification:", emailError);
      }

      // Send SMS to restaurant
      try {
        await sendMessage(
          `Your loan application has been approved! Amount: ${approvedAmount} RWF. Voucher will be issued shortly.`,
          loan.restaurant.phone || "",
        );
      } catch (smsError) {
        console.error("Failed to send SMS to restaurant:", smsError);
      }

      // Send email notification to admin
      try {
        await sendAdminVoucherApprovedEmail({
          userType: "RESTAURANT",
          userName: loan.restaurant.name,
          userEmail: loan.restaurant.email || "",
          restaurantName: loan.restaurant.name,
          voucherAmount: approvedAmount,
          approvedBy: trader.username,
        });
      } catch (emailError) {
        console.error("Failed to send admin email notification:", emailError);
      }
    }

    // Send SMS notification to private receiver
    try {
      await sendMessage(
        `Loan approved by ${trader?.username || "Trader"}: ${approvedAmount} RWF for ${loan?.restaurant?.name || "Restaurant"}`,
        process.env.PRIVATE_RECEIVER || "",
      );
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }
  } catch (error) {
    console.error("Error sending loan approval notifications:", error);
  }
}

// Get trader commission from orders (for processing new commissions)
export const calculateTraderCommissionService = async (traderId: string) => {
  // Get MATURED and SETTLED vouchers approved by this trader
  const maturedVouchers = await prisma.voucher.findMany({
    where: {
      approvedBy: traderId,
      status: { in: ["SETTLED", "MATURED"] },
      usedCredit: { gt: 0 },
    },
  });

  // Check which vouchers already have commission earned records
  const existingCommissions = await prisma.traderTransaction.findMany({
    where: {
      traderId,
      type: "COMMISSION_EARNED",
      voucherId: { in: maturedVouchers.map((v) => v.id) },
    },
  });

  const earnedVoucherIds = new Set(
    existingCommissions.map((tx) => tx.voucherId),
  );
  const newVouchers = maturedVouchers.filter(
    (v) => !earnedVoucherIds.has(v.id),
  );

  let totalCommission = 0;
  const commissionDetails = [];

  for (const voucher of newVouchers) {
    const commission = voucher.usedCredit * 0.05; // 5% commission on used credit
    totalCommission += commission;

    // Create commission earned record
    await createTraderTransactionService({
      traderId,
      type: "COMMISSION_EARNED",
      amount: commission,
      voucherId: voucher.id,
      commissionRate: 0.05,
      description: `Commission earned from voucher ${voucher.voucherCode}`,
    });

    commissionDetails.push({
      voucherId: voucher.id,
      voucherCode: voucher.voucherCode,
      usedAmount: voucher.usedCredit,
      commission,
      voucherDate: voucher.createdAt,
    });
  }

  return { totalCommission, commissionDetails };
};

// Process trader commission payment
export const processTraderCommissionService = async (traderId: string) => {
  try {
    // Get unpaid commissions
    const unpaidCommissions = await prisma.traderTransaction.findMany({
      where: {
        traderId,
        type: "COMMISSION_EARNED",
        isCommissionPaid: false,
      },
    });

    if (unpaidCommissions.length === 0) {
      console.log(`No unpaid commissions available for trader ${traderId}`);
      return { totalCommission: 0, commissionCount: 0 };
    }

    const totalCommission = unpaidCommissions.reduce(
      (sum, tx) => sum + tx.amount,
      0,
    );
    const traderWallet = await getTraderWalletService(traderId);

    // Add commission to trader wallet
    await prisma.wallet.update({
      where: { id: traderWallet.id },
      data: { balance: traderWallet.balance + totalCommission },
    });

    // Mark commissions as paid
    await prisma.traderTransaction.updateMany({
      where: {
        id: { in: unpaidCommissions.map((tx) => tx.id) },
      },
      data: { isCommissionPaid: true },
    });

    // Create commission payment record
    const paymentTransaction = await createTraderTransactionService({
      traderId,
      type: "COMMISSION_PAID",
      amount: totalCommission,
      description: `Commission payment for ${unpaidCommissions.length} orders`,
      reference: unpaidCommissions.map((tx) => tx.orderId).join(","),
    });

    // Create wallet transaction
    const walletTransaction = await prisma.walletTransaction.create({
      data: {
        walletId: traderWallet.id,
        adminId: traderId,
        type: "TRADING",
        amount: totalCommission,
        previousBalance: traderWallet.balance,
        newBalance: traderWallet.balance + totalCommission,
        description: `Commission payment for ${unpaidCommissions.length} orders`,
        status: "COMPLETED",
      },
    });

    // Broadcast wallet update
    try {
      wsManager.broadcastWalletUpdate({
        walletId: traderWallet.id,
        restaurantId: "",
        action: "COMMISSION_RECEIVED",
        timestamp: new Date().toISOString(),
        data: {
          amount: totalCommission,
          newBalance: traderWallet.balance + totalCommission,
          transactionId: walletTransaction.id,
        },
      });
    } catch (error) {
      console.error("Failed to broadcast commission update:", error);
    }

    return {
      totalCommission,
      transaction: paymentTransaction,
      walletTransaction,
      commissionCount: unpaidCommissions.length,
    };
  } catch (error: any) {
    console.error(
      `Error processing commission for trader ${traderId}:`,
      error.message,
    );
    return { totalCommission: 0, commissionCount: 0, error: error.message };
  }
};

// Get orders paid with trader's vouchers
export const getTraderOrdersService = async (
  traderId: string,
  filters?: any,
) => {
  const orders = await prisma.order.findMany({
    where: {
      Voucher: {
        approvedBy: traderId,
      },
      paymentStatus: { in: ["VOUCHER_CREDIT", "COMPLETED"] },
    },
    include: {
      restaurant: { select: { id: true, name: true } },
      Voucher: {
        select: { id: true, voucherCode: true, discountPercentage: true },
      },
      orderItems: {
        include: { product: { select: { productName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    ...filters,
  });

  return orders;
};

// Get trader transaction history
export const getTraderTransactionHistoryService = async (
  traderId: string,
  filters?: any,
) => {
  const {
    page = 1,
    limit = 10,
    type,
    status,
    startDate,
    endDate,
  } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = { traderId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [transactions, total] = await Promise.all([
    prisma.traderTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.traderTransaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get trader transaction by ID
export const getTraderTransactionByIdService = async (
  traderId: string,
  transactionId: string,
) => {
  const transaction = await prisma.traderTransaction.findFirst({
    where: { id: transactionId, traderId },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  return transaction;
};

// Get trader transaction stats
export const getTraderTransactionStatsService = async (traderId: string) => {
  const [totalTransactions, loanApprovals, commissionsEarned, commissionsPaid] =
    await Promise.all([
      prisma.traderTransaction.count({ where: { traderId } }),
      prisma.traderTransaction.count({
        where: { traderId, type: "LOAN_APPROVAL" },
      }),
      prisma.traderTransaction.count({
        where: { traderId, type: "COMMISSION_EARNED" },
      }),
      prisma.traderTransaction.count({
        where: { traderId, type: "COMMISSION_PAID" },
      }),
    ]);

  const [totalCommissionEarned, totalCommissionPaid, totalLoansApproved] =
    await Promise.all([
      prisma.traderTransaction.aggregate({
        where: { traderId, type: "COMMISSION_EARNED" },
        _sum: { amount: true },
      }),
      prisma.traderTransaction.aggregate({
        where: { traderId, type: "COMMISSION_PAID" },
        _sum: { amount: true },
      }),
      prisma.traderTransaction.aggregate({
        where: { traderId, type: "LOAN_APPROVAL" },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalTransactions,
    loanApprovals,
    commissionsEarned,
    commissionsPaid,
    totalCommissionEarned: totalCommissionEarned._sum.amount || 0,
    totalCommissionPaid: totalCommissionPaid._sum.amount || 0,
    totalLoansApproved: Math.abs(totalLoansApproved._sum.amount || 0),
  };
};

// Process all traders' commissions - triggered when voucher is used
export const processAllTradersCommissionService = async () => {
  try {
    // Get all USED vouchers that haven't had commission processed
    const usedVouchers = await prisma.voucher.findMany({
      where: {
        status: "USED",
        usedCredit: { gt: 0 },
        approvedBy: { not: null },
      },
      include: {
        approver: true,
      },
    });

    const results = [];

    for (const voucher of usedVouchers) {
      if (!voucher.approvedBy) continue;

      // Check if commission already processed for this voucher
      const existingCommission = await prisma.traderTransaction.findFirst({
        where: {
          traderId: voucher.approvedBy,
          type: "COMMISSION_EARNED",
          voucherId: voucher.id,
        },
      });

      if (existingCommission) continue;

      // Get trader wallet to get commission rate
      const traderWallet = await prisma.wallet.findUnique({
        where: { traderId: voucher.approvedBy },
      });

      if (!traderWallet) continue;

      const commissionRate = traderWallet.commission / 100; // Convert percentage to decimal
      const commissionAmount = voucher.usedCredit * commissionRate;

      // Create commission earned record
      await createTraderTransactionService({
        traderId: voucher.approvedBy,
        type: "COMMISSION_EARNED",
        amount: commissionAmount,
        voucherId: voucher.id,
        commissionRate,
        description: `Commission earned from voucher ${voucher.voucherCode}`,
      });

      // Move amount from pending to available for commission payment
      await prisma.wallet.update({
        where: { id: traderWallet.id },
        data: {
          pendingApprovedAmount: Math.max(
            0,
            traderWallet.pendingApprovedAmount - voucher.usedCredit,
          ),
        },
      });

      // Send commission earned notifications
      await sendCommissionEarnedNotifications(
        voucher.approvedBy,
        voucher,
        commissionAmount,
      );

      results.push({
        traderId: voucher.approvedBy,
        voucherId: voucher.id,
        commissionAmount,
        success: true,
      });
    }

    return results;
  } catch (error: any) {
    console.error(
      "Error in processAllTradersCommissionService:",
      error.message,
    );
    return [];
  }
};

// Get trader commission details (for API endpoint)
export const getTraderCommissionDetailsService = async (traderId: string) => {
  // Get all commission transactions for this trader
  const commissionTransactions = await prisma.traderTransaction.findMany({
    where: {
      traderId,
      type: { in: ["COMMISSION_EARNED", "COMMISSION_PAID"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const earnedCommissions = commissionTransactions.filter(
    (tx) => tx.type === "COMMISSION_EARNED",
  );
  const paidCommissions = commissionTransactions.filter(
    (tx) => tx.type === "COMMISSION_PAID",
  );

  const totalEarned = earnedCommissions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPaid = paidCommissions.reduce((sum, tx) => sum + tx.amount, 0);
  const pendingCommission = earnedCommissions
    .filter((tx) => !tx.isCommissionPaid)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    totalCommission: totalEarned,
    totalPaid,
    pendingCommission,
    commissionDetails: earnedCommissions.map((tx) => ({
      id: tx.id,
      voucherId: tx.voucherId,
      amount: tx.amount,
      commissionRate: tx.commissionRate,
      description: tx.description,
      isPaid: tx.isCommissionPaid,
      createdAt: tx.createdAt,
    })),
  };
};

// Send commission earned notifications
const sendCommissionEarnedNotifications = async (
  traderId: string,
  voucher: any,
  commissionAmount: number,
) => {
  try {
    const trader = await prisma.admin.findUnique({ where: { id: traderId } });

    // SMS to trader
    await sendMessage(
      `Commission earned: ${commissionAmount} RWF from voucher ${voucher.voucherCode}`,
      trader?.phone || "",
    );

    // SMS to admin/private receiver
    await sendMessage(
      `Trader ${trader?.username} earned commission of ${commissionAmount} RWF from voucher usage`,
      process.env.PRIVATE_RECEIVER || "",
    );

    // System notification
    await createNotificationService({
      title: "Commission Earned",
      message: `You earned ${commissionAmount} RWF commission from voucher ${voucher.voucherCode}`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: traderId,
      metadata: { voucherId: voucher.id, commissionAmount },
    });
  } catch (error) {
    console.error("Failed to send commission earned notifications:", error);
  }
};

// Set trader wallet commission
export const setTraderWalletCommissionService = async (
  traderId: string,
  commission: number,
) => {
  if (commission < 0 || commission > 100) {
    throw new Error("Commission must be between 0 and 100 percent");
  }

  const wallet = await prisma.wallet.update({
    where: { traderId },
    data: { commission },
    include: {
      trader: {
        select: { id: true, username: true, email: true, phone: true },
      },
    },
  });

  // Send notifications
  try {
    await sendMessage(
      `Your wallet commission has been updated to ${commission}%`,
      wallet.trader?.phone || "",
    );

    await createNotificationService({
      title: "Commission Rate Updated",
      message: `Your commission rate has been updated to ${commission}%`,
      eventType: "SYSTEM_MAINTENANCE",
      targetType: "SPECIFIC_USER",
      targetId: traderId,
      metadata: { newCommission: commission },
    });
  } catch (error) {
    console.error("Failed to send commission update notifications:", error);
  }

  return wallet;
};

// Get trader dashboard stats
export const getTraderDashboardStatsService = async (traderId: string) => {
  const [wallet, vouchers, orders, commission] = await Promise.all([
    getTraderWalletService(traderId),
    getTraderVouchersService(traderId),
    getTraderOrdersService(traderId),
    getTraderCommissionDetailsService(traderId),
  ]);

  const stats = {
    walletBalance: wallet.balance,
    totalVouchersApproved: vouchers.vouchers.length,
    activeVouchers: vouchers.vouchers.filter((v) => v.status === "ACTIVE")
      .length,
    totalOrdersProcessed: orders.length,
    totalCommissionEarned: commission.totalCommission,
    pendingCommission: commission.pendingCommission,
  };

  return stats;
};
