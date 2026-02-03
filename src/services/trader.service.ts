import prisma from "../prisma";
import { topUpWalletService } from "./wallet.service";
import { approveLoanApplicationService } from "./voucher.service";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import {
  sendAdminVoucherApprovedEmail,
  sendTraderLoanApprovalEmail,
} from "../utils/emailTemplates";
import { VoucherType } from "@prisma/client";
import { OTPService } from "./otp.service";

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

// Get trader wallet with additional data
export const getTraderWalletService = async (traderId: string) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Calculate any new commissions before returning wallet data
  await calculateTraderCommissionService(traderId);

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

  // Calculate correct pending approved amount based on voucher usage
  const activeVouchers = await prisma.voucher.findMany({
    where: {
      approvedBy: traderId,
      status: { in: ["ACTIVE", "USED"] },
    },
  });

  const correctPendingAmount = activeVouchers.reduce((total, voucher) => {
    return total + voucher.usedCredit; // Only the used portion
  }, 0);

  // Update wallet if pending amount is incorrect
  if (wallet.pendingApprovedAmount !== correctPendingAmount) {
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { pendingApprovedAmount: correctPendingAmount },
    });
    wallet.pendingApprovedAmount = correctPendingAmount;
  }

  // Calculate total vouchers amount approved by trader
  const totalVouchersApproved = await prisma.voucher.aggregate({
    where: { approvedBy: traderId },
    _sum: { creditLimit: true },
    _count: true,
  });

  // For used vouchers, available balance equals current balance since used amounts are already deducted
  // Only subtract unused amounts from ACTIVE vouchers (not yet used)
  const activeUnusedAmount = activeVouchers
    .filter((voucher) => voucher.status === "ACTIVE")
    .reduce((total, voucher) => {
      return total + (voucher.creditLimit - voucher.usedCredit);
    }, 0);

  return {
    ...wallet,
    totalVouchersAmount: totalVouchersApproved._sum.creditLimit || 0,
    totalVouchersCount: totalVouchersApproved._count || 0,
    availableBalance: wallet.balance - activeUnusedAmount,
  };
};

// Top up trader wallet
export const topUpTraderWalletService = async (data: {
  traderId: string;
  amount: number;
  paymentMethodId: string;
  phoneNumber?: string;
  description?: string;
}) => {
  const paymentMethodConfig = await prisma.paymentMethodConfig.findUnique({
    where: { id: data.paymentMethodId },
  });

  if (!paymentMethodConfig) {
    throw new Error("Payment method not found");
  }

  if (!paymentMethodConfig.isActive) {
    throw new Error("Payment method is not active");
  }

  const trader = await prisma.admin.findUnique({
    where: { id: data.traderId },
    select: { id: true, username: true, email: true, phone: true },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  const traderWallet = await getTraderWalletService(data.traderId);

  const result = await topUpWalletService({
    walletId: traderWallet.id,
    traderId: data.traderId,
    amount: data.amount,
    paymentMethod: paymentMethodConfig.name,
    phoneNumber: data.phoneNumber,
    description: data.description || "Trader wallet top-up",
    traderInfo: {
      email: trader.email,
      name: trader.username,
    },
  });

  return {
    ...result,
    paymentMethodDetails: {
      id: paymentMethodConfig.id,
      name: paymentMethodConfig.name,
      description: paymentMethodConfig.description,
    },
  };
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

// Approve loan with wallet balance check - use original loan application values
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

  // Use original loan application values
  const acceptedAmount = loan.approvedAmount || loan.requestedAmount;
  const paymentDays = loan.repaymentDays || 30; // Default to 30 days if not set

  // Check trader wallet balance and calculate available balance
  const traderWallet = await getTraderWalletService(traderId);
  const availableBalance =
    traderWallet.balance - traderWallet.pendingApprovedAmount;

  if (availableBalance < acceptedAmount) {
    throw new Error(
      `Insufficient available balance. Available: ${availableBalance} RWF, Required: ${acceptedAmount} RWF`,
    );
  }

  // Add amount to pending approved amount (don't deduct from balance yet)
  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: {
      pendingApprovedAmount:
        traderWallet.pendingApprovedAmount + acceptedAmount,
    },
  });

  // Create wallet transaction for pending approval
  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId: traderId,
      type: "TRADING",
      amount: -acceptedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance, // Balance unchanged, only pending amount increased
      description: `Loan approval pending for ${loanId}`,
      status: "COMPLETED",
    },
  });

  // Create trader transaction record
  await createTraderTransactionService({
    traderId,
    type: "LOAN_APPROVAL",
    amount: -acceptedAmount,
    loanId,
    description: `Loan approval for ${acceptedAmount} RWF with ${paymentDays} days payment term`,
  });

  // Approve the loan with original parameters
  const result = await approveLoanApplicationService(loanId, {
    approvedAmount: acceptedAmount,
    repaymentDays: paymentDays,
    voucherType: "DISCOUNT_100" as VoucherType,
    notes: `Loan approved by trader using original terms: ${acceptedAmount} RWF, ${paymentDays} days`,
    approvedBy: traderId,
  });

  // Send notifications
  await sendLoanApprovalNotifications(traderId, result, acceptedAmount);

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

    // Get loan ID from result structure
    const loanId = result.loan?.id || result.updatedLoan?.id;

    if (!loanId) {
      console.error("No loan ID found in result:", result);
      return;
    }

    // Get restaurant info from the loan
    const loan = await prisma.loanApplication.findUnique({
      where: { id: loanId },
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
          loanId: loanId,
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
  // First process any existing used vouchers that haven't been processed
  await processExistingUsedVouchersForTrader(traderId);

  // Then process commissions for settled/matured vouchers
  const settledVouchers = await prisma.voucher.findMany({
    where: {
      approvedBy: traderId,
      status: { in: ["SETTLED", "MATURED"] },
      usedCredit: { gt: 0 },
    },
  });

  // Check which vouchers already have commission earned records to prevent duplicates
  const existingCommissions = await prisma.traderTransaction.findMany({
    where: {
      traderId,
      type: "COMMISSION_EARNED",
      voucherId: { in: settledVouchers.map((v) => v.id) },
    },
  });

  const earnedVoucherIds = new Set(
    existingCommissions.map((tx) => tx.voucherId),
  );
  const newVouchers = settledVouchers.filter(
    (v) => !earnedVoucherIds.has(v.id),
  );

  let totalCommission = 0;
  const commissionDetails = [];

  // Get wallet directly without calling getTraderWalletService to avoid circular dependency
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  if (!traderWallet) {
    return { totalCommission: 0, commissionDetails: [] };
  }

  const commissionRate = traderWallet.commission / 100;

  for (const voucher of newVouchers) {
    const commission = voucher.usedCredit * commissionRate;
    totalCommission += commission;

    // Create commission earned record
    await createTraderTransactionService({
      traderId,
      type: "COMMISSION_EARNED",
      amount: commission,
      voucherId: voucher.id,
      commissionRate,
      description: `Commission earned from voucher ${voucher.voucherCode}`,
    });

    // Return pending approved amount for settled vouchers
    await returnPendingApprovedAmountService(voucher.id);

    commissionDetails.push({
      voucherId: voucher.id,
      voucherCode: voucher.voucherCode,
      usedAmount: voucher.usedCredit,
      commission,
      voucherDate: voucher.createdAt,
    });
  }

  // Update wallet commissionEarned separately
  if (totalCommission > 0) {
    await prisma.wallet.update({
      where: { id: traderWallet.id },
      data: {
        commissionEarned: traderWallet.commissionEarned + totalCommission,
      },
    });
  }

  return { totalCommission, commissionDetails };
};

// Process existing used vouchers for a specific trader
const processExistingUsedVouchersForTrader = async (traderId: string) => {
  const usedVouchers = await prisma.voucher.findMany({
    where: {
      status: "USED",
      usedCredit: { gt: 0 },
      approvedBy: traderId,
    },
  });

  // Get trader wallet directly to avoid circular dependency
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  if (!traderWallet) return;

  for (const voucher of usedVouchers) {
    // Check if this voucher usage has already been processed
    const existingTransaction = await prisma.walletTransaction.findFirst({
      where: {
        walletId: traderWallet.id,
        description: { contains: voucher.voucherCode },
        type: "TRADING",
        amount: -voucher.usedCredit,
      },
    });

    if (!existingTransaction) {
      // Only deduct used amount from balance, keep pendingApprovedAmount unchanged
      await prisma.wallet.update({
        where: { id: traderWallet.id },
        data: {
          balance: traderWallet.balance - voucher.usedCredit,
          // pendingApprovedAmount stays the same until voucher is settled
        },
      });

      // Create wallet transaction for the deduction
      await prisma.walletTransaction.create({
        data: {
          walletId: traderWallet.id,
          adminId: traderId,
          type: "TRADING",
          amount: -voucher.usedCredit,
          previousBalance: traderWallet.balance,
          newBalance: traderWallet.balance - voucher.usedCredit,
          description: `Voucher usage deduction for ${voucher.voucherCode}`,
          status: "COMPLETED",
        },
      });

      // Update the wallet reference for next iteration
      traderWallet.balance -= voucher.usedCredit;
      // pendingApprovedAmount remains unchanged
    }
  }
};

// Process trader commission payment
export const processTraderCommissionService = async (traderId: string) => {
  try {
    // First calculate any new commissions
    await calculateTraderCommissionService(traderId);

    // Get current wallet state directly to avoid circular dependency
    const traderWallet = await prisma.wallet.findUnique({
      where: { traderId },
    });

    if (!traderWallet || traderWallet.commissionEarned <= 0) {
      console.log(`No commission available for trader ${traderId}`);
      return { totalCommission: 0, commissionCount: 0 };
    }

    const totalCommission = traderWallet.commissionEarned;

    // Mark all unpaid commissions as paid (commission stays in commissionEarned)
    await prisma.traderTransaction.updateMany({
      where: {
        traderId,
        type: "COMMISSION_EARNED",
        isCommissionPaid: false,
      },
      data: { isCommissionPaid: true },
    });

    // Get count of commissions paid
    const commissionCount = await prisma.traderTransaction.count({
      where: {
        traderId,
        type: "COMMISSION_EARNED",
        isCommissionPaid: true,
      },
    });

    // Create commission payment record
    await createTraderTransactionService({
      traderId,
      type: "COMMISSION_PAID",
      amount: totalCommission,
      description: `Commission payment for ${commissionCount} vouchers`,
    });

    return {
      totalCommission,
      commissionCount,
      balance: traderWallet.balance, // Balance unchanged
    };
  } catch (error) {
    console.error("Error processing trader commission:", error);
    throw error;
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

  return {
    totalTransactions,
    loanApprovals,
    commissionsEarned,
    commissionsPaid,
  };
};

// Process all traders' commissions - triggered when voucher is settled or repayment days reached
export const processAllTradersCommissionService = async () => {
  try {
    // Get vouchers that are SETTLED, MATURED, or EXPIRED with used credit
    const eligibleVouchers = await prisma.voucher.findMany({
      where: {
        status: { in: ["SETTLED", "MATURED", "EXPIRED"] },
        usedCredit: { gt: 0 },
        approvedBy: { not: null },
      },
      include: {
        approver: true,
      },
    });

    const results = [];

    for (const voucher of eligibleVouchers) {
      if (!voucher.approvedBy) continue;

      // Check if commission already processed for this voucher to prevent duplicates
      const existingCommission = await prisma.traderTransaction.findFirst({
        where: {
          traderId: voucher.approvedBy,
          type: "COMMISSION_EARNED",
          voucherId: voucher.id,
        },
      });

      if (existingCommission) {
        // Return pending approved amount if voucher is settled/expired
        await returnPendingApprovedAmountService(voucher.id);
        continue;
      }

      // Get trader wallet to get commission rate
      const traderWallet = await prisma.wallet.findUnique({
        where: { traderId: voucher.approvedBy },
      });

      if (!traderWallet) continue;

      const commissionRate = traderWallet.commission / 100;
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

      // Add commission to wallet's commissionEarned field (not balance)
      await prisma.wallet.update({
        where: { id: traderWallet.id },
        data: {
          commissionEarned: traderWallet.commissionEarned + commissionAmount,
        },
      });

      // Return pending approved amount for settled/expired vouchers
      await returnPendingApprovedAmountService(voucher.id);

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
  // Calculate any new commissions before returning commission data
  await calculateTraderCommissionService(traderId);

  // Get trader wallet for commissionEarned field
  const traderWallet = await getTraderWalletService(traderId);

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
    commissionEarned: traderWallet.commissionEarned, // From wallet field
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
  // Calculate any new commissions before returning dashboard data
  await calculateTraderCommissionService(traderId);

  const [wallet, vouchers, orders, commission] = await Promise.all([
    getTraderWalletService(traderId),
    getTraderVouchersService(traderId),
    getTraderOrdersService(traderId),
    getTraderCommissionDetailsService(traderId),
  ]);

  // Calculate total vouchers amount approved by trader
  const totalVouchersApproved = await prisma.voucher.aggregate({
    where: { approvedBy: traderId },
    _sum: { creditLimit: true },
  });

  const stats = {
    walletBalance: wallet.balance,
    totalVouchersApproved: vouchers.vouchers.length,
    totalVouchersAmount: totalVouchersApproved._sum.creditLimit || 0,
    activeVouchers: vouchers.vouchers.filter((v) => v.status === "ACTIVE")
      .length,
    totalOrdersProcessed: orders.length,
    totalCommissionEarned: commission.totalCommission,
    pendingCommission: commission.pendingCommission,
  };

  return stats;
};

// Process voucher usage - deduct from trader wallet when voucher is used
export const processVoucherUsageService = async (
  voucherId: string,
  usedAmount: number,
) => {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: { approver: true },
  });

  if (!voucher || !voucher.approvedBy) {
    return;
  }

  const traderWallet = await getTraderWalletService(voucher.approvedBy);

  // Deduct used amount from balance and reduce pending approved amount
  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: {
      balance: traderWallet.balance - usedAmount,
      pendingApprovedAmount: Math.max(
        0,
        traderWallet.pendingApprovedAmount - usedAmount,
      ),
    },
  });

  // Create wallet transaction for the deduction
  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId: voucher.approvedBy,
      type: "TRADING",
      amount: -usedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance - usedAmount,
      description: `Voucher usage deduction for ${voucher.voucherCode}`,
      status: "COMPLETED",
    },
  });
};

// Process existing used vouchers to fix wallet states
export const processExistingUsedVouchersService = async () => {
  try {
    // Get all USED vouchers that haven't been processed yet
    const usedVouchers = await prisma.voucher.findMany({
      where: {
        status: "USED",
        usedCredit: { gt: 0 },
        approvedBy: { not: null },
      },
      include: { approver: true },
    });

    const results = [];

    for (const voucher of usedVouchers) {
      if (!voucher.approvedBy) continue;

      const traderWallet = await getTraderWalletService(voucher.approvedBy);

      // Check if this voucher usage has already been processed
      const existingTransaction = await prisma.walletTransaction.findFirst({
        where: {
          walletId: traderWallet.id,
          description: { contains: voucher.voucherCode },
          type: "TRADING",
          amount: -voucher.usedCredit,
        },
      });

      if (existingTransaction) {
        console.log(`Voucher ${voucher.voucherCode} already processed`);
        continue;
      }

      // Process the voucher usage
      await processVoucherUsageService(voucher.id, voucher.usedCredit);

      results.push({
        voucherId: voucher.id,
        voucherCode: voucher.voucherCode,
        traderId: voucher.approvedBy,
        usedAmount: voucher.usedCredit,
        processed: true,
      });
    }

    return results;
  } catch (error: any) {
    console.error("Error processing existing used vouchers:", error.message);
    return [];
  }
};

// Return pending approved amount when voucher is settled, expired, or repayment days reached
export const returnPendingApprovedAmountService = async (voucherId: string) => {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
    include: { approver: true },
  });

  if (!voucher || !voucher.approvedBy) {
    return;
  }

  // Get wallet directly to avoid circular dependency
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId: voucher.approvedBy },
  });

  if (!traderWallet) {
    return;
  }

  // Only return the used amount back to balance (since used amount was deducted when voucher was used)
  // and reduce pending approved amount by the used amount
  if (voucher.usedCredit > 0) {
    await prisma.wallet.update({
      where: { id: traderWallet.id },
      data: {
        balance: traderWallet.balance + voucher.usedCredit,
        pendingApprovedAmount: Math.max(
          0,
          traderWallet.pendingApprovedAmount - voucher.usedCredit,
        ),
      },
    });

    // Create wallet transaction for the return
    await prisma.walletTransaction.create({
      data: {
        walletId: traderWallet.id,
        adminId: voucher.approvedBy,
        type: "TRADING",
        amount: voucher.usedCredit,
        previousBalance: traderWallet.balance,
        newBalance: traderWallet.balance + voucher.usedCredit,
        description: `Returned used amount from settled voucher ${voucher.voucherCode}`,
        status: "COMPLETED",
      },
    });
  }
};

// Request delegation permission
export const requestDelegationService = async (traderId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: {
      trader: { select: { username: true, email: true, phone: true } },
    },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  if (wallet.canTradeOnBehalf) {
    throw new Error("Trader already has delegation permission");
  }

  if (wallet.delegationRequestedAt && !wallet.delegationApprovedAt) {
    throw new Error("Delegation request already pending");
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      delegationRequestedAt: new Date(),
      delegationApprovedAt: null,
      delegationApprovedBy: null,
    },
  });

  // Send notifications
  await createNotificationService({
    title: "Delegation Request Submitted",
    message:
      "Your request to trade on behalf has been submitted for admin approval",
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  await sendMessage(
    `Delegation request submitted by trader ${wallet.trader?.username}. Awaiting admin approval.`,
    process.env.PRIVATE_RECEIVER || "",
  );

  return {
    success: true,
    message: "Delegation request submitted successfully",
  };
};

// Admin approve delegation with OTP
export const approveDelegationService = async (
  adminId: string,
  traderId: string,
  commission: number,
) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: {
      trader: { select: { username: true, email: true, phone: true } },
    },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  if (!wallet.delegationRequestedAt) {
    throw new Error("No delegation request found");
  }

  if (wallet.canTradeOnBehalf) {
    throw new Error("Delegation already approved");
  }

  // Generate OTP for trader verification
  const otp = OTPService.generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store all delegation data in session (similar to voucher checkout)
  const delegationSessionData = {
    adminId,
    traderId,
    commission,
    walletId: wallet.id,
    otp,
    expiresAt,
    traderInfo: wallet.trader,
    timestamp: Date.now(),
  };

  // Send OTP to trader
  if (wallet.trader?.phone) {
    await sendMessage(
      `Your delegation approval OTP: ${otp}. Valid for 10 minutes. Commission: ${commission}%`,
      wallet.trader.phone,
    );
  }

  // Send notification to private receiver
  await sendMessage(
    `Delegation approval initiated for trader ${wallet.trader?.username}. OTP sent to trader.`,
    process.env.PRIVATE_RECEIVER || "",
  );

  return {
    success: true,
    message: "OTP sent to trader for verification",
    sessionId: Buffer.from(JSON.stringify(delegationSessionData)).toString("base64"),
  };
};

// Verify delegation OTP and complete approval
export const verifyDelegationOTPService = async (
  sessionId: string,
  otp: string,
) => {
  try {
    // Decode session data
    const delegationData = JSON.parse(
      Buffer.from(sessionId, "base64").toString()
    );

    // Validate session data
    if (
      !delegationData.otp ||
      !delegationData.expiresAt ||
      !delegationData.traderId ||
      !delegationData.adminId ||
      !delegationData.commission
    ) {
      throw new Error("Invalid session data");
    }

    // Check OTP expiration
    if (new Date() > new Date(delegationData.expiresAt)) {
      throw new Error("OTP expired");
    }

    // Verify OTP
    if (delegationData.otp !== otp) {
      throw new Error("Invalid OTP");
    }

    // Get wallet to update
    const wallet = await prisma.wallet.findUnique({
      where: { traderId: delegationData.traderId },
      include: { trader: { select: { username: true, phone: true } } },
    });

    if (!wallet) {
      throw new Error("Trader wallet not found");
    }

    // Approve delegation
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        canTradeOnBehalf: true,
        delegationApprovedAt: new Date(),
        delegationApprovedBy: delegationData.adminId,
        commission: delegationData.commission,
      },
    });

    // Send notifications
    await createNotificationService({
      title: "Delegation Approved",
      message: `You can now trade on behalf with ${delegationData.commission}% commission`,
      eventType: "SYSTEM_MAINTENANCE",
      targetType: "SPECIFIC_USER",
      targetId: delegationData.traderId,
    });

    if (wallet.trader?.phone) {
      await sendMessage(
        `Delegation approved! You can now trade on behalf with ${delegationData.commission}% commission.`,
        wallet.trader.phone,
      );
    }

    await sendMessage(
      `Delegation approved for trader ${wallet.trader?.username} with ${delegationData.commission}% commission.`,
      process.env.PRIVATE_RECEIVER || "",
    );

    return { success: true, message: "Delegation approved successfully" };
  } catch (error: any) {
    throw new Error(error.message || "Invalid session or OTP verification failed");
  }
};

// Revoke delegation permission
export const revokeDelegationService = async (
  adminId: string,
  traderId: string,
) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true, phone: true } } },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  if (!wallet.canTradeOnBehalf) {
    throw new Error("Trader does not have delegation permission");
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      canTradeOnBehalf: false,
      delegationRequestedAt: null,
      delegationApprovedAt: null,
      delegationApprovedBy: null,
    },
  });

  // Send notifications
  await createNotificationService({
    title: "Delegation Revoked",
    message: "Your trading delegation permission has been revoked",
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      "Your trading delegation permission has been revoked by admin.",
      wallet.trader.phone,
    );
  }

  return { success: true, message: "Delegation revoked successfully" };
};

// Get all delegation requests (Admin)
export const getAllDelegationRequestsService = async (filters: {
  status?: "PENDING" | "APPROVED" | "ALL";
  page?: number;
  limit?: number;
}) => {
  const { status = "ALL", page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  let whereClause: any = {
    traderId: { not: null },
  };

  if (status === "PENDING") {
    whereClause.delegationRequestedAt = { not: null };
    whereClause.canTradeOnBehalf = false;
  } else if (status === "APPROVED") {
    whereClause.canTradeOnBehalf = true;
  }

  const [requests, total] = await Promise.all([
    prisma.wallet.findMany({
      where: whereClause,
      include: {
        trader: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { delegationRequestedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.wallet.count({ where: whereClause }),
  ]);

  return {
    requests: requests.map((wallet) => ({
      traderId: wallet.traderId,
      traderInfo: wallet.trader,
      delegationRequestedAt: wallet.delegationRequestedAt,
      delegationApprovedAt: wallet.delegationApprovedAt,
      delegationApprovedBy: wallet.delegationApprovedBy,
      canTradeOnBehalf: wallet.canTradeOnBehalf,
      commission: wallet.commission,
      balance: wallet.balance,
      totalDeposited: wallet.totalDeposited,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get trader's own delegation status
export const getTraderDelegationStatusService = async (traderId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    select: {
      delegationRequestedAt: true,
      delegationApprovedAt: true,
      delegationApprovedBy: true,
      canTradeOnBehalf: true,
      commission: true,
    },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  return {
    delegationRequestedAt: wallet.delegationRequestedAt,
    delegationApprovedAt: wallet.delegationApprovedAt,
    delegationApprovedBy: wallet.delegationApprovedBy,
    canTradeOnBehalf: wallet.canTradeOnBehalf,
    commission: wallet.commission,
    status: wallet.canTradeOnBehalf
      ? "APPROVED"
      : wallet.delegationRequestedAt
        ? "PENDING"
        : "NOT_REQUESTED",
  };
};