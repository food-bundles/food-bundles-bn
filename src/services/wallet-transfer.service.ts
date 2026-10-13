import prisma from "../prisma";
import { TransactionStatus, WalletTransactionType } from "@prisma/client";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import {
  sendWalletNotificationEmail,
  sendAdminWalletTransactionEmail,
} from "../utils/emails";

/**
 * Transfer unused voucher amount to restaurant's Food Bundles wallet.
 * Used when a Kayko-approved loan's voucher expires or has unused balance.
 */
export const transferVoucherAmountToWalletService = async (data: {
  restaurantId: string;
  amount: number;
  voucherId?: string;
  loanSessionId?: string;
  source?: string;
  notes?: string;
}) => {
  const { restaurantId, amount, voucherId, loanSessionId, notes } = data;
  const source = data.source || "VOUCHER_EXPIRY";

  if (amount <= 0) throw new Error("Transfer amount must be greater than zero");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) throw new Error("Restaurant not found");

  // Get or create wallet
  let wallet = await prisma.wallet.findUnique({ where: { restaurantId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({
      data: { restaurantId, balance: 0, currency: "RWF" },
    });
  }

  if (!wallet.isActive) throw new Error("Wallet is inactive");

  const previousBalance = wallet.balance;
  const newBalance = previousBalance + amount;

  // Create wallet transfer record
  const transfer = await prisma.walletTransfer.create({
    data: {
      restaurantId,
      voucherId: voucherId || null,
      loanSessionId: loanSessionId || null,
      amount,
      source,
      status: TransactionStatus.COMPLETED,
      transferredAt: new Date(),
      notes: notes || `Voucher unused amount transferred to wallet (${source})`,
    },
  });

  // Update wallet balance
  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  });

  // Record wallet transaction
  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      restaurantId,
      type: WalletTransactionType.TOP_UP,
      amount,
      previousBalance,
      newBalance,
      description: `Voucher unused amount credited to wallet (${source})${voucherId ? ` — Voucher ${voucherId}` : ""}`,
      reference: transfer.id,
      status: TransactionStatus.COMPLETED,
      metadata: {
        source,
        voucherId: voucherId || null,
        loanSessionId: loanSessionId || null,
        walletTransferId: transfer.id,
      },
    },
  });

  // Notify restaurant
  try {
    await createNotificationService({
      title: "Voucher Amount Credited",
      message: `${amount.toLocaleString()} RWF from your unused voucher has been credited to your wallet. New balance: ${newBalance.toLocaleString()} RWF`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: restaurantId,
      metadata: { transferId: transfer.id, amount, newBalance },
    });
  } catch (notifError) {
    console.error("Failed to create wallet transfer notification:", notifError);
  }

  try {
    if (restaurant.phone) {
      await sendMessage(
        `Dear ${restaurant.name}, ${amount.toLocaleString()} RWF from your unused voucher has been credited to your wallet. New balance: ${newBalance.toLocaleString()} RWF`,
        restaurant.phone,
      );
    }
  } catch (smsError) {
    console.error("Failed to send wallet transfer SMS:", smsError);
  }

  try {
    if (restaurant.email) {
      await sendWalletNotificationEmail({
        email: restaurant.email,
        restaurantName: restaurant.name,
        type: "TOP_UP",
        amount,
        newBalance,
        transactionId: transfer.id,
        description: notes || `Voucher unused amount transferred to wallet (${source})`,
      });
    }
  } catch (emailError) {
    console.error("Failed to send wallet transfer email:", emailError);
  }

  // Notify admin — email + in-app only.
  try {
    if (process.env.ADMIN_EMAIL) {
      await sendAdminWalletTransactionEmail({
        ownerName: restaurant.name,
        ownerType: "RESTAURANT",
        type: "TOP_UP",
        amount,
        newBalance,
        transactionId: transfer.id,
        description: notes || `Voucher unused amount transferred to wallet (${source})`,
      });
    }
  } catch (emailError) {
    console.error("Failed to send admin wallet transfer email:", emailError);
  }

  try {
    await createNotificationService({
      title: "Voucher Amount Credited to Wallet",
      message: `${restaurant.name}'s unused voucher amount of ${amount.toLocaleString()} RWF was credited to their wallet.`,
      eventType: "WALLET_TRANSACTION",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: { transferId: transfer.id, amount, newBalance },
    });
  } catch (notifError) {
    console.error("Failed to create admin wallet transfer notification:", notifError);
  }

  return {
    transfer,
    previousBalance,
    newBalance,
  };
};

/**
 * Get all wallet transfers (Admin)
 */
export const getAllWalletTransfersService = async (filters?: {
  restaurantId?: string;
  status?: TransactionStatus;
  page?: number;
  limit?: number;
}) => {
  const { restaurantId, status, page = 1, limit = 20 } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (restaurantId) where.restaurantId = restaurantId;
  if (status) where.status = status;

  const [transfers, total] = await Promise.all([
    prisma.walletTransfer.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.walletTransfer.count({ where }),
  ]);

  return {
    data: transfers,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

/**
 * Get a restaurant's wallet transfers
 */
export const getRestaurantWalletTransfersService = async (restaurantId: string) => {
  return prisma.walletTransfer.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
  });
};
