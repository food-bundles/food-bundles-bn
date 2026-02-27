import prisma from "../prisma";
import { topUpWalletService } from "./wallet.service";
import {
  approveLoanApplicationService,
  processMaturedVouchersAutoDeductionService,
} from "./voucher.service";
import { createNotificationService } from "./notification.services";
import { OTPService } from "./otp.service";
import { sendMessage } from "../utils/sms.utility";
import {
  sendAdminVoucherApprovedEmail,
  sendTraderLoanApprovalEmail,
  sendTraderDelegationOTPEmail,
} from "../utils/emailTemplates";
import { VoucherType } from "@prisma/client";

// Create trader transaction record
export const createTraderTransactionService = async (data: {
  traderId: string;
  type:
    | "LOAN_APPROVAL"
    | "LOAN_REVERSAL"
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
  // Process matured vouchers auto-deduction
  try {
    await processMaturedVouchersAutoDeductionService();
  } catch (error) {
    console.error("Failed to process matured vouchers auto-deduction:", error);
  }

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
    availableBalance:
      wallet.balance - activeUnusedAmount - wallet.pendingWithdrawBalance,
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

  // Check if wallet exists, create if not
  let traderWallet;
  try {
    traderWallet = await getTraderWalletService(data.traderId);
  } catch (error) {
    // Wallet doesn't exist, create it automatically
    traderWallet = await createTraderWalletService(data.traderId);
  }

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
        manager: true,
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

  // Get trader wallet for commission rate
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  const commissionRate = (traderWallet?.commission || 0) / 100;

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
    // Handle multiple statuses separated by comma
    const statuses = filters.status.split(",").map((s: string) => s.trim());
    if (statuses.length > 1) {
      where.status = { in: statuses };
    } else {
      where.status = filters.status;
    }
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

  // Calculate commission for each voucher
  const vouchersWithCommission = vouchers.map((voucher) => {
    const commission =
      voucher.usedCredit > 0 ? voucher.usedCredit * commissionRate : 0;
    return {
      ...voucher,
      commission,
    };
  });

  return {
    vouchers: vouchersWithCommission,
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
  // Check trader wallet balance and calculate available balance
  const traderWallet = await getTraderWalletService(traderId);

  if (!traderWallet) {
    throw new Error("Trader wallet not found");
  }

  if (traderWallet.canTradeOnBehalf) {
    throw new Error("Failed, Food Bundles is trading on your behalf.");
  }
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

  const availableBalance =
    traderWallet.balance -
    traderWallet.pendingApprovedAmount -
    traderWallet.pendingWithdrawBalance;

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

  // Get wallet to check commission mode
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  if (!traderWallet) {
    return { totalCommission: 0, commissionDetails: [] };
  }

  // For FIXED mode, don't calculate commission per voucher
  if (traderWallet.commissionMode === "FIXED") {
    return { totalCommission: 0, commissionDetails: [], mode: "FIXED" };
  }

  // NORMAL mode: process commissions for settled/matured vouchers
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

    // Return pending approved amount for settled vouchers (only once per voucher)
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

  return { totalCommission, commissionDetails, mode: "NORMAL" };
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
    const traderWallet = await prisma.wallet.findUnique({
      where: { traderId },
    });

    if (!traderWallet) {
      throw new Error("Trader wallet not found");
    }

    const commissionMode = traderWallet.commissionMode || "NORMAL";

    // Handle FIXED mode monthly commission
    if (commissionMode === "FIXED") {
      const now = new Date();
      const lastProcessed =
        traderWallet.lastMonthlyCommissionDate || traderWallet.createdAt;
      const daysSinceLastProcessed = Math.floor(
        (now.getTime() - lastProcessed.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceLastProcessed < 30) {
        throw new Error(
          `Monthly commission can only be processed once per month.`,
        );
      }

      const commissionRate = traderWallet.commission / 100;
      const totalCommission = traderWallet.balance * commissionRate;

      await createTraderTransactionService({
        traderId,
        type: "COMMISSION_EARNED",
        amount: totalCommission,
        commissionRate,
        description: `Monthly fixed commission (${traderWallet.commission}% of balance ${traderWallet.balance} RWF)`,
      });

      await prisma.wallet.update({
        where: { id: traderWallet.id },
        data: {
          commissionEarned: traderWallet.commissionEarned + totalCommission,
          lastMonthlyCommissionDate: now,
        },
      });

      await createNotificationService({
        title: "Monthly Commission Processed",
        message: `Monthly commission of ${totalCommission.toFixed(2)} RWF (${traderWallet.commission}% of ${traderWallet.balance} RWF balance) added to your account`,
        eventType: "PAYMENT_PROCESSED",
        targetType: "SPECIFIC_USER",
        targetId: traderId,
      });

      return {
        totalCommission,
        commissionCount: 1,
        balance: traderWallet.balance,
        mode: "FIXED",
      };
    }

    // Handle NORMAL mode commission
    await calculateTraderCommissionService(traderId);

    const updatedWallet = await prisma.wallet.findUnique({
      where: { traderId },
    });

    if (!updatedWallet || updatedWallet.commissionEarned <= 0) {
      console.log(`No commission available for trader ${traderId}`);
      return { totalCommission: 0, commissionCount: 0, mode: "NORMAL" };
    }

    const totalCommission = updatedWallet.commissionEarned;

    await prisma.traderTransaction.updateMany({
      where: {
        traderId,
        type: "COMMISSION_EARNED",
        isCommissionPaid: false,
      },
      data: { isCommissionPaid: true },
    });

    const commissionCount = await prisma.traderTransaction.count({
      where: {
        traderId,
        type: "COMMISSION_EARNED",
        isCommissionPaid: true,
      },
    });

    await createTraderTransactionService({
      traderId,
      type: "COMMISSION_PAID",
      amount: totalCommission,
      description: `Commission payment for ${commissionCount} vouchers`,
    });

    return {
      totalCommission,
      commissionCount,
      balance: updatedWallet.balance,
      mode: "NORMAL",
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
        // Only return pending approved amount if not already returned
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

      // Return pending approved amount for settled/expired vouchers (only once)
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

  // Check if wallet exists, create if not
  let traderWallet;
  try {
    traderWallet = await getTraderWalletService(traderId);
  } catch (error) {
    // Wallet doesn't exist, create it automatically
    traderWallet = await createTraderWalletService(traderId);
  }

  const wallet = await prisma.wallet.update({
    where: { id: traderWallet.id },
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

  // Check if this voucher's used amount has already been returned to prevent duplicates
  const existingReturnTransaction = await prisma.walletTransaction.findFirst({
    where: {
      walletId: traderWallet.id,
      description: `Returned used amount from settled voucher ${voucher.voucherCode}`,
      type: "TRADING",
      amount: voucher.usedCredit,
    },
  });

  if (existingReturnTransaction) {
    console.log(
      `Voucher ${voucher.voucherCode} used amount already returned to wallet`,
    );
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

  if (wallet.delegationStatus === "PENDING") {
    throw new Error("Delegation request already pending");
  }

  if (wallet.delegationStatus === "APPROVED") {
    throw new Error("Delegation already approved. Please accept it.");
  }

  if (wallet.delegationStatus === "ACCEPTED") {
    throw new Error("Delegation already active");
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      delegationStatus: "PENDING",
      delegationRequestedAt: new Date(),
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

  // Allow PENDING or APPROVED (for resending OTP)
  if (
    wallet.delegationStatus !== "PENDING" &&
    wallet.delegationStatus !== "APPROVED"
  ) {
    throw new Error("No pending or approved delegation request found");
  }

  if (!wallet.trader?.email) {
    throw new Error("Trader email not found. Cannot send OTP.");
  }

  // Generate OTP valid for 24 hours
  const otp = OTPService.generateOTP();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store OTP in database
  await prisma.oTP.create({
    data: {
      phone: wallet.trader.phone || wallet.trader.email,
      otp,
      purpose: "ADMIN_WALLET_OPERATION",
      expiresAt,
    },
  });

  // Update wallet to APPROVED status
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      delegationStatus: "APPROVED",
      delegationApprovedAt: new Date(),
      delegationApprovedBy: adminId,
      commission,
    },
  });

  // Send OTP via email
  await sendTraderDelegationOTPEmail({
    traderEmail: wallet.trader.email,
    traderName: wallet.trader.username,
    otp,
    commission,
  });

  // Send notifications
  await createNotificationService({
    title: "Delegation Approved",
    message: `Your delegation request has been approved with ${commission}% commission. Check your email for OTP to accept.`,
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      `Delegation approved with ${commission}% commission. Check your email for OTP to accept delegation.`,
      wallet.trader.phone,
    );
  }

  return {
    success: true,
    message:
      "Delegation approved. OTP sent to trader email (valid for 24 hours).",
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
      Buffer.from(sessionId, "base64").toString(),
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

    // Create delegation history record
    await prisma.delegationHistory.create({
      data: {
        walletId: wallet.id,
        startedAt: new Date(),
        approvedBy: delegationData.adminId,
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
    throw new Error(
      error.message || "Invalid session or OTP verification failed",
    );
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
      delegationAcceptedAt: true,
      canTradeOnBehalf: true,
      commission: true,
      delegationStatus: true,
    },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  return {
    delegationRequestedAt: wallet.delegationRequestedAt,
    delegationApprovedAt: wallet.delegationApprovedAt,
    delegationApprovedBy: wallet.delegationApprovedBy,
    delegationAcceptedAt: wallet.delegationAcceptedAt,
    canTradeOnBehalf: wallet.canTradeOnBehalf,
    commission: wallet.commission,
    status: wallet.delegationStatus || "NORMAL",
  };
};
// Admin approve loan on behalf of trader
export const adminApproveLoanOnBehalfService = async (
  adminId: string,
  traderId: string,
  loanId: string,
  approvedAmount: number,
  repaymentDays: number,
) => {
  // Check if trader exists and has delegation
  const traderWallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true } } },
  });

  if (!traderWallet) {
    throw new Error("Trader wallet not found");
  }

  if (!traderWallet.canTradeOnBehalf) {
    throw new Error("Trader does not have delegation permission");
  }

  // Check if loan exists and is in ACCEPTED or PENDING status
  const loan = await prisma.loanApplication.findUnique({
    where: { id: loanId },
  });

  if (!loan) {
    throw new Error("Loan application not found");
  }

  if (!["ACCEPTED", "PENDING"].includes(loan.status)) {
    throw new Error("Can only approve loans with ACCEPTED or PENDING status");
  }

  // Check trader wallet balance
  const availableBalance =
    traderWallet.balance -
    traderWallet.pendingApprovedAmount -
    traderWallet.pendingWithdrawBalance;

  if (availableBalance < approvedAmount) {
    throw new Error(
      `Insufficient available balance. Available: ${availableBalance} RWF, Required: ${approvedAmount} RWF`,
    );
  }

  // Add amount to pending approved amount
  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: {
      pendingApprovedAmount:
        traderWallet.pendingApprovedAmount + approvedAmount,
    },
  });

  // Create wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId,
      type: "TRADING",
      amount: -approvedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance,
      description: `Admin loan approval on behalf of trader ${traderWallet.trader?.username}`,
      status: "COMPLETED",
    },
  });

  // Approve the loan
  const result = await approveLoanApplicationService(loanId, {
    approvedAmount,
    repaymentDays,
    voucherType: "DISCOUNT_100" as VoucherType,
    notes: `Loan approved by admin on behalf of trader ${traderWallet.trader?.username}: ${approvedAmount} RWF, ${repaymentDays} days`,
    approvedBy: traderId,
    managedBy: adminId,
  });

  return result;
};

// Reverse delegation status (trader takes back control)
export const reverseDelegationService = async (traderId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true, phone: true } } },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  // Check if delegation is APPROVED or ACCEPTED
  if (
    wallet.delegationStatus === "NORMAL" ||
    wallet.delegationStatus === "PENDING"
  ) {
    throw new Error("No active delegation to reverse");
  }

  // Find active delegation history (no endedAt) - only if ACCEPTED
  if (wallet.delegationStatus === "ACCEPTED") {
    const activeDelegation = await prisma.delegationHistory.findFirst({
      where: { walletId: wallet.id, endedAt: null },
      orderBy: { startedAt: "desc" },
    });

    if (activeDelegation) {
      // Close current delegation period
      await prisma.delegationHistory.update({
        where: { id: activeDelegation.id },
        data: { endedAt: new Date() },
      });
    }
  }

  // Reverse delegation
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      canTradeOnBehalf: false,
      delegationStatus: "NORMAL",
    },
  });

  // Send notifications
  await createNotificationService({
    title: "Delegation Reversed",
    message: "You have taken back control and can now trade directly",
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      "Delegation reversed! You now have full control of your wallet.",
      wallet.trader.phone,
    );
  }

  return { success: true, message: "Delegation reversed successfully" };
};

// Accept delegation with OTP (Trader accepts delegation)
export const acceptDelegationService = async (
  traderId: string,
  otp: string,
) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId },
    select: { phone: true, email: true, username: true },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Verify OTP
  const otpVerification = await OTPService.verifyOTP(
    trader.phone || trader.email || "",
    otp,
    "ADMIN_WALLET_OPERATION",
  );

  if (!otpVerification.success) {
    throw new Error(otpVerification.message);
  }

  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  if (wallet.delegationStatus !== "APPROVED") {
    throw new Error("No approved delegation to accept");
  }

  // Accept delegation
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      delegationStatus: "ACCEPTED",
      delegationAcceptedAt: new Date(),
      canTradeOnBehalf: true,
    },
  });

  // Create delegation history record
  await prisma.delegationHistory.create({
    data: {
      walletId: wallet.id,
      startedAt: new Date(),
      approvedBy: wallet.delegationApprovedBy,
    },
  });

  // Send notifications
  await createNotificationService({
    title: "Delegation Accepted",
    message:
      "You have accepted the delegation. Food Bundles is now trading on your behalf.",
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (trader.phone) {
    await sendMessage(
      "You have accepted the delegation. Food Bundles is now trading on your behalf.",
      trader.phone,
    );
  }

  return { success: true, message: "Delegation accepted successfully" };
};

// Request withdraw
export const requestWithdrawService = async (
  traderId: string,
  data: {
    amount: number;
    withdrawType: "BALANCE" | "COMMISSION";
    paymentMethod: string;
    accountNumber: string;
    accountName: string;
  },
) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true, phone: true } } },
  });

  if (!wallet) throw new Error("Trader wallet not found");

  const { amount, withdrawType, paymentMethod, accountNumber, accountName } =
    data;

  // Validate amount
  if (amount <= 0) throw new Error("Withdraw amount must be greater than 0");

  // Check available amount
  const availableAmount =
    withdrawType === "BALANCE"
      ? wallet.balance - wallet.pendingWithdrawBalance
      : wallet.commissionEarned - wallet.pendingWithdrawCommission;

  if (amount > availableAmount) {
    throw new Error(
      `Insufficient ${withdrawType.toLowerCase()} amount. Available: ${availableAmount} RWF`,
    );
  }

  // Create withdraw request
  const withdrawRequest = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      traderId,
      type: "WITHDRAWAL",
      amount: -amount,
      previousBalance: wallet.balance,
      newBalance: wallet.balance,
      withdrawType,
      paymentMethod,
      accountNumber,
      accountName,
      description: `Withdraw request: ${amount} RWF from ${withdrawType.toLowerCase()}`,
      status: "PENDING",
    },
  });

  // Update pending withdraw amount
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      pendingWithdrawBalance:
        withdrawType === "BALANCE"
          ? wallet.pendingWithdrawBalance + amount
          : wallet.pendingWithdrawBalance,
      pendingWithdrawCommission:
        withdrawType === "COMMISSION"
          ? wallet.pendingWithdrawCommission + amount
          : wallet.pendingWithdrawCommission,
    },
  });

  // Notify admin
  await createNotificationService({
    title: "Withdraw Request",
    message: `Trader ${wallet.trader?.username} requested withdraw of ${amount} RWF from ${withdrawType.toLowerCase()}`,
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "ROLE_BASED",
    targetRole: "ADMIN",
  });

  await sendMessage(
    `Withdraw request: ${amount} RWF from ${withdrawType.toLowerCase()} by ${wallet.trader?.username}`,
    process.env.PRIVATE_RECEIVER || "",
  );

  return withdrawRequest;
};

// Admin approve withdraw and send OTP
export const adminApproveWithdrawService = async (
  adminId: string,
  withdrawId: string,
) => {
  const withdrawRequest = await prisma.walletTransaction.findUnique({
    where: { id: withdrawId },
    include: {
      wallet: {
        include: {
          trader: { select: { phone: true, username: true, id: true } },
        },
      },
    },
  });

  if (!withdrawRequest) throw new Error("Withdraw request not found");
  if (
    withdrawRequest.status === "COMPLETED" ||
    withdrawRequest.status === "CANCELLED"
  )
    throw new Error("Withdraw request already processed");

  // Generate OTP
  const otp = OTPService.generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Store all withdraw data in session
  const withdrawSessionData = {
    adminId,
    withdrawId,
    traderId: withdrawRequest.traderId,
    walletId: withdrawRequest.walletId,
    amount: Math.abs(withdrawRequest.amount),
    withdrawType: withdrawRequest.withdrawType,
    paymentMethod: withdrawRequest.paymentMethod,
    accountNumber: withdrawRequest.accountNumber,
    accountName: withdrawRequest.accountName,
    otp,
    expiresAt,
    traderInfo: withdrawRequest.wallet.trader,
    timestamp: Date.now(),
  };

  // Update withdraw request status to PROCESSING
  await prisma.walletTransaction.update({
    where: { id: withdrawId },
    data: { status: "PROCESSING", adminId },
  });

  // Send OTP to trader
  if (withdrawRequest.wallet.trader?.phone) {
    await sendMessage(
      `Your withdraw OTP: ${otp}. Valid for 10 minutes. Amount: ${Math.abs(withdrawRequest.amount)} RWF`,
      withdrawRequest.wallet.trader.phone,
    );
  }

  return {
    success: true,
    message: "OTP sent to trader for verification",
    sessionId: Buffer.from(JSON.stringify(withdrawSessionData)).toString(
      "base64",
    ),
  };
};

// Verify withdraw OTP and complete
export const verifyWithdrawOTPService = async (
  sessionId: string,
  otp: string,
) => {
  try {
    // Decode session data
    const withdrawData = JSON.parse(
      Buffer.from(sessionId, "base64").toString(),
    );

    // Validate session data
    if (
      !withdrawData.otp ||
      !withdrawData.expiresAt ||
      !withdrawData.withdrawId ||
      !withdrawData.adminId ||
      !withdrawData.traderId
    ) {
      throw new Error("Invalid session data");
    }

    // Check OTP expiration
    if (new Date() > new Date(withdrawData.expiresAt)) {
      throw new Error("OTP expired");
    }

    // Verify OTP
    if (withdrawData.otp !== otp) {
      throw new Error("Invalid OTP");
    }

    // Get withdraw request and wallet
    const withdrawRequest = await prisma.walletTransaction.findUnique({
      where: { id: withdrawData.withdrawId },
      include: {
        wallet: {
          include: { trader: { select: { username: true, phone: true } } },
        },
      },
    });

    if (!withdrawRequest) throw new Error("Withdraw request not found");
    if (withdrawRequest.status !== "PROCESSING")
      throw new Error("Withdraw request not ready for verification");

    const amount = withdrawData.amount;
    const wallet = withdrawRequest.wallet;

    // Deduct from wallet and clear pending
    const newBalance =
      withdrawData.withdrawType === "BALANCE"
        ? wallet.balance - amount
        : wallet.balance;
    const newCommission =
      withdrawData.withdrawType === "COMMISSION"
        ? wallet.commissionEarned - amount
        : wallet.commissionEarned;

    await prisma.$transaction([
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          commissionEarned: newCommission,
          totalWithdrawn: wallet.totalWithdrawn + amount,
          pendingWithdrawBalance:
            withdrawData.withdrawType === "BALANCE"
              ? Math.max(0, wallet.pendingWithdrawBalance - amount)
              : wallet.pendingWithdrawBalance,
          pendingWithdrawCommission:
            withdrawData.withdrawType === "COMMISSION"
              ? Math.max(0, wallet.pendingWithdrawCommission - amount)
              : wallet.pendingWithdrawCommission,
        },
      }),
      prisma.walletTransaction.update({
        where: { id: withdrawData.withdrawId },
        data: {
          status: "COMPLETED",
          otpVerified: true,
          newBalance,
        },
      }),
    ]);

    // Notifications
    await createNotificationService({
      title: "Withdraw Completed",
      message: `Your withdraw of ${amount} RWF has been completed`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: withdrawData.traderId,
    });

    if (wallet.trader?.phone) {
      await sendMessage(
        `Withdraw completed: ${amount} RWF from ${withdrawData.withdrawType?.toLowerCase()}`,
        wallet.trader.phone,
      );
    }

    await sendMessage(
      `Withdraw completed for ${wallet.trader?.username}: ${amount} RWF by admin`,
      process.env.PRIVATE_RECEIVER || "",
    );

    return { success: true, message: "Withdraw completed successfully" };
  } catch (error: any) {
    throw new Error(
      error.message || "Invalid session or OTP verification failed",
    );
  }
};

// Get trader withdraw requests
export const getTraderWithdrawRequestsService = async (
  traderId: string,
  filters?: { page?: number; limit?: number; status?: string },
) => {
  const { page = 1, limit = 10, status } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = { traderId, type: "WITHDRAWAL" };
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Get all withdraw requests (Admin)
export const getAllWithdrawRequestsService = async (filters?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  const { page = 1, limit = 10, status } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = { type: "WITHDRAWAL" };
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      include: {
        wallet: {
          include: {
            trader: { select: { id: true, username: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    requests,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// Cancel withdraw request
export const cancelWithdrawRequestService = async (
  traderId: string,
  withdrawId: string,
) => {
  const withdrawRequest = await prisma.walletTransaction.findUnique({
    where: { id: withdrawId },
    include: { wallet: { include: { trader: true } } },
  });

  if (!withdrawRequest) throw new Error("Withdraw request not found");
  if (withdrawRequest.traderId !== traderId)
    throw new Error("Unauthorized access");
  if (
    withdrawRequest.status === "COMPLETED" ||
    withdrawRequest.status === "CANCELLED"
  )
    throw new Error("Can only cancel pending withdraw requests");

  const wallet = withdrawRequest.wallet;
  const amount = Math.abs(withdrawRequest.amount);

  // Return pending amount to available balance
  await prisma.$transaction([
    prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        pendingWithdrawBalance:
          withdrawRequest.withdrawType === "BALANCE"
            ? Math.max(0, wallet.pendingWithdrawBalance - amount)
            : wallet.pendingWithdrawBalance,
        pendingWithdrawCommission:
          withdrawRequest.withdrawType === "COMMISSION"
            ? Math.max(0, wallet.pendingWithdrawCommission - amount)
            : wallet.pendingWithdrawCommission,
      },
    }),
    prisma.walletTransaction.update({
      where: { id: withdrawId },
      data: { status: "CANCELLED" },
    }),
  ]);

  // Notifications
  await createNotificationService({
    title: "Withdraw Cancelled",
    message: `Your withdraw request of ${amount} RWF has been cancelled`,
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      `Withdraw request cancelled: ${amount} RWF from ${withdrawRequest.withdrawType?.toLowerCase()}`,
      wallet.trader.phone,
    );
  }

  // Notify admin
  await createNotificationService({
    title: "Withdraw Request Cancelled",
    message: `Withdraw request of ${amount} RWF from ${withdrawRequest.withdrawType?.toLowerCase()} has been cancelled`,
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "ADMIN",
  });

  // Send SMS to private receiver
  await sendMessage(
    `Withdraw request cancelled: ${amount} RWF from ${withdrawRequest.withdrawType?.toLowerCase()} by ${wallet.trader?.username}`,
    process.env.PRIVATE_RECEIVER || "",
  );

  return { success: true, message: "Withdraw request cancelled successfully" };
};

// Get all delegation history (Admin)
export const getAllDelegationHistoryService = async (filters: {
  traderId?: string;
  page?: number;
  limit?: number;
}) => {
  const { traderId, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const whereClause: any = {};
  if (traderId) {
    const wallet = await prisma.wallet.findUnique({
      where: { traderId },
      select: { id: true },
    });
    if (wallet) {
      whereClause.walletId = wallet.id;
    }
  }

  const [history, total] = await Promise.all([
    prisma.delegationHistory.findMany({
      where: whereClause,
      include: {
        wallet: {
          select: {
            traderId: true,
            trader: {
              select: {
                id: true,
                username: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.delegationHistory.count({ where: whereClause }),
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get trader's own delegation history
export const getTraderDelegationHistoryService = async (
  traderId: string,
  filters: {
    page?: number;
    limit?: number;
  },
) => {
  const { page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    select: { id: true },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  const [history, total] = await Promise.all([
    prisma.delegationHistory.findMany({
      where: { walletId: wallet.id },
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.delegationHistory.count({ where: { walletId: wallet.id } }),
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get traders with accepted delegations (Admin)
export const getTradersWithAcceptedDelegationsService = async () => {
  const traders = await prisma.wallet.findMany({
    where: {
      traderId: { not: null },
      canTradeOnBehalf: true,
      isActive: true,
    },
    select: {
      traderId: true,
      balance: true,
      trader: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return traders.map((wallet) => ({
    id: wallet.traderId,
    name: wallet.trader?.username || wallet.trader?.email,
    availableBalance: wallet.balance,
  }));
};

// Toggle trader commission mode between NORMAL and FIXED
export const toggleTraderCommissionModeService = async (
  traderId: string,
  newMode: "NORMAL" | "FIXED",
) => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true, phone: true } } },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  const now = new Date();
  const currentMode = wallet.commissionMode || "NORMAL";

  // If switching from FIXED to NORMAL mid-month, no commission for that month
  if (currentMode === "FIXED" && newMode === "NORMAL") {
    const lastChange = wallet.commissionModeChangedAt || wallet.createdAt;
    const daysSinceChange = Math.floor(
      (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceChange < 30) {
      await createNotificationService({
        title: "Commission Mode Changed",
        message: `Commission mode changed to NORMAL. No commission will be paid for the current month period.`,
        eventType: "SYSTEM_MAINTENANCE",
        targetType: "SPECIFIC_USER",
        targetId: traderId,
      });
    }
  }

  const newCommissionRate = newMode === "FIXED" ? 5.0 : 3.0;
  const canTradeOnBehalf = newMode === "FIXED";

  // Update wallet with auto-delegation for FIXED mode
  const updatedWallet = await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      commissionMode: newMode,
      commission: newCommissionRate,
      commissionModeChangedAt: now,
      canTradeOnBehalf,
      delegationStatus: canTradeOnBehalf ? "ACCEPTED" : "NORMAL",
    },
  });

  // Create delegation history if switching to FIXED
  if (newMode === "FIXED" && !wallet.canTradeOnBehalf) {
    await prisma.delegationHistory.create({
      data: {
        walletId: wallet.id,
        action: "AUTO_DELEGATED",
        startedAt: now,
        reason: "Auto-delegated for FIXED commission mode",
      },
    });
  }

  // End delegation if switching to NORMAL
  if (newMode === "NORMAL" && wallet.canTradeOnBehalf) {
    await prisma.delegationHistory.create({
      data: {
        walletId: wallet.id,
        action: "REVOKED",
        startedAt: wallet.commissionModeChangedAt || wallet.createdAt,
        endedAt: now,
        reason: "Auto-revoked when switching to NORMAL commission mode",
      },
    });
  }

  await createNotificationService({
    title: "Commission Mode Updated",
    message: `Your commission mode has been changed to ${newMode} with ${newCommissionRate}% rate. ${newMode === "FIXED" ? "Food Bundles will approve loans on your behalf." : "You will approve loans directly."}`,
    eventType: "SYSTEM_MAINTENANCE",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      `Commission mode changed to ${newMode} (${newCommissionRate}%). ${newMode === "FIXED" ? "Food Bundles will approve loans on your behalf. Monthly commission based on balance." : "Commission earned per voucher approval."}`,
      wallet.trader.phone,
    );
  }

  return {
    success: true,
    wallet: updatedWallet,
    message: `Commission mode changed to ${newMode} with ${newCommissionRate}% rate`,
  };
};

// Process monthly commission for FIXED mode traders
export const processMonthlyCommissionService = async (
  traderId: string,
): Promise<{
  success: boolean;
  totalCommission: number;
  message: string;
}> => {
  const wallet = await prisma.wallet.findUnique({
    where: { traderId },
    include: { trader: { select: { username: true, phone: true } } },
  });

  if (!wallet) {
    throw new Error("Trader wallet not found");
  }

  if (wallet.commissionMode !== "FIXED") {
    throw new Error("Trader is not in FIXED commission mode");
  }

  const now = new Date();
  const lastProcessed = wallet.lastMonthlyCommissionDate || wallet.createdAt;
  const daysSinceLastProcessed = Math.floor(
    (now.getTime() - lastProcessed.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceLastProcessed < 30) {
    throw new Error(`Monthly commission can only be processed once per month.`);
  }

  // Calculate commission based on current balance (not vouchers)
  const commissionRate = wallet.commission / 100;
  const totalCommission = wallet.balance * commissionRate;

  // Create commission earned record
  await createTraderTransactionService({
    traderId,
    type: "COMMISSION_EARNED",
    amount: totalCommission,
    commissionRate,
    description: `Monthly fixed commission (${wallet.commission}% of balance ${wallet.balance} RWF)`,
  });

  // Update wallet
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: {
      commissionEarned: wallet.commissionEarned + totalCommission,
      lastMonthlyCommissionDate: now,
    },
  });

  // Send notifications
  await createNotificationService({
    title: "Monthly Commission Processed",
    message: `Monthly commission of ${totalCommission.toFixed(2)} RWF (${wallet.commission}% of ${wallet.balance} RWF balance) added to your account`,
    eventType: "PAYMENT_PROCESSED",
    targetType: "SPECIFIC_USER",
    targetId: traderId,
  });

  if (wallet.trader?.phone) {
    await sendMessage(
      `Monthly commission: ${totalCommission.toFixed(2)} RWF (${wallet.commission}% of balance) added to your account`,
      wallet.trader.phone,
    );
  }

  return {
    success: true,
    totalCommission,
    message: `Monthly commission of ${totalCommission.toFixed(2)} RWF processed successfully`,
  };
};

// Process all FIXED mode traders' monthly commissions (Admin cron job)
export const processAllFixedModeMonthlyCommissionsService = async () => {
  const fixedModeWallets = await prisma.wallet.findMany({
    where: {
      traderId: { not: null },
      commissionMode: "FIXED",
      isActive: true,
    },
  });

  const results = [];

  for (const wallet of fixedModeWallets) {
    try {
      const result = await processMonthlyCommissionService(wallet.traderId!);
      results.push({
        traderId: wallet.traderId,
        ...result,
      });
    } catch (error: any) {
      results.push({
        traderId: wallet.traderId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
};

// Get all traders (Admin only)
export const getAllTradersService = async () => {
  const traders = await prisma.admin.findMany({
    where: { role: "TRADER" },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      createdAt: true,
      updatedAt: true,
      traderWallet: {
        select: {
          id: true,
          balance: true,
          commission: true,
          commissionEarned: true,
          isActive: true,
          commissionMode: true,
          canTradeOnBehalf: true,
          delegationStatus: true,
        },
      },
      _count: {
        select: {
          approvedLoans: true,
          Voucher: true,
          traderTransactions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Transform the response to use 'wallet' instead of 'traderWallet'
  return traders.map((trader) => ({
    ...trader,
    wallet: trader.traderWallet,
    traderWallet: undefined, // Remove the original field
  }));
};

// Get trader by ID or email
export const getTraderByIdOrEmailService = async (identifier: string) => {
  const trader = await prisma.admin.findFirst({
    where: {
      role: "TRADER",
      OR: [{ id: identifier }, { email: identifier }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      createdAt: true,
      updatedAt: true,
      traderWallet: {
        select: {
          id: true,
          balance: true,
          commission: true,
          commissionEarned: true,
          isActive: true,
          commissionMode: true,
          canTradeOnBehalf: true,
          delegationStatus: true,
          totalDeposited: true,
          pendingWithdrawBalance: true,
          pendingWithdrawCommission: true,
          totalWithdrawn: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      },
      _count: {
        select: {
          approvedLoans: true,
          Voucher: true,
          traderTransactions: true,
        },
      },
    },
  });

  if (!trader) {
    throw new Error("Trader not found");
  }

  // Transform the response to use 'wallet' instead of 'traderWallet'
  return {
    ...trader,
    wallet: trader.traderWallet,
    traderWallet: undefined, // Remove the original field
  };
};
