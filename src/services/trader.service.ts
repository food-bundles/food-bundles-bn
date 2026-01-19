import prisma from "../prisma";
import { topUpWalletService } from "./wallet.service";
import {
  getAllLoanApplicationsService,
  approveLoanApplicationService,
  getAllVouchersService,
} from "./voucher.service";
import { createNotificationService } from "./notification.services";
import { wsManager } from "../index";

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

// Get loan applications for trader
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

  return await getAllLoanApplicationsService(filters);
};

// Get vouchers for trader
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

  // Get vouchers approved by this trader
  const traderVouchers = await getAllVouchersService({
    ...filters,
    approvedBy: traderId,
  });

  return traderVouchers;
};

// Approve loan with wallet balance check
export const traderApproveLoanService = async (
  traderId: string,
  loanId: string,
  approvalData: {
    approvedAmount: number;
    repaymentDays: number;
    voucherType:
      | "DISCOUNT_10"
      | "DISCOUNT_20"
      | "DISCOUNT_50"
      | "DISCOUNT_80"
      | "DISCOUNT_100";
    notes?: string;
  },
) => {
  const { approvedAmount } = approvalData;

  // Check trader wallet balance
  const traderWallet = await getTraderWalletService(traderId);

  if (traderWallet.balance < approvedAmount) {
    throw new Error(
      `Insufficient wallet balance. Available: ${traderWallet.balance} RWF, Required: ${approvedAmount} RWF`,
    );
  }

  // Deduct amount from trader wallet
  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: { balance: traderWallet.balance - approvedAmount },
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

  // Send notification
  await createNotificationService({
    title: "Loan Approved by Trader",
    message: `Loan of ${approvedAmount} RWF has been approved by trader`,
    eventType: "VOUCHER_ISSUED",
    targetType: "SPECIFIC_USER",
    targetId: result.loan.restaurantId || "",
    metadata: {
      traderId,
      loanId,
      approvedAmount,
    },
  });

  return result;
};

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
    console.error(`Error processing commission for trader ${traderId}:`, error.message);
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

// Process all traders' commissions
export const processAllTradersCommissionService = async () => {
  try {
    const traders = await prisma.admin.findMany({
      where: { role: "TRADER" },
    });

    console.log(`Processing commissions for ${traders.length} traders`);

    const results = [];
    for (const trader of traders) {
      const result = await processTraderCommissionService(trader.id);
      console.log(`Trader ${trader.id} commission result:`, result);
      results.push({ traderId: trader.id, success: true, ...result });
    }

    console.log(`Commission processing completed for all traders:`, results);
    return results;
  } catch (error: any) {
    console.error("Error in processAllTradersCommissionService:", error.message);
    return [];
  }
};

// Get trader commission details (for API endpoint)
export const getTraderCommissionDetailsService = async (traderId: string) => {
  // Get all commission transactions for this trader
  const commissionTransactions = await prisma.traderTransaction.findMany({
    where: {
      traderId,
      type: { in: ["COMMISSION_EARNED", "COMMISSION_PAID"] }
    },
    orderBy: { createdAt: "desc" }
  });

  const earnedCommissions = commissionTransactions.filter(tx => tx.type === "COMMISSION_EARNED");
  const paidCommissions = commissionTransactions.filter(tx => tx.type === "COMMISSION_PAID");

  const totalEarned = earnedCommissions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalPaid = paidCommissions.reduce((sum, tx) => sum + tx.amount, 0);
  const pendingCommission = earnedCommissions
    .filter(tx => !tx.isCommissionPaid)
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    totalCommission: totalEarned,
    totalPaid,
    pendingCommission,
    commissionDetails: earnedCommissions.map(tx => ({
      id: tx.id,
      voucherId: tx.voucherId,
      amount: tx.amount,
      commissionRate: tx.commissionRate,
      description: tx.description,
      isPaid: tx.isCommissionPaid,
      createdAt: tx.createdAt
    }))
  };
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
