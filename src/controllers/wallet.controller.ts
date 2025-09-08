import { Request, Response } from "express";
import prisma from "../prisma";
import {
  createWalletService,
  getWalletByRestaurantIdService,
  getWalletByIdService,
  topUpWalletService,
  debitWalletService,
  refundToWalletService,
  getWalletTransactionsService,
  updateWalletStatusService,
  getAllWalletsService,
  verifyWalletTopUpService,
} from "../services/wallet.service";
import { WalletTransactionType, TransactionStatus } from "@prisma/client";

/**
 * Create wallet for restaurant
 * POST /wallets
 */
export const createWallet = async (req: Request, res: Response) => {
  try {
    const { currency } = req.body;
    const restaurantId = (req as any).user.id;

    const wallet = await createWalletService({
      restaurantId,
      currency,
    });

    res.status(201).json({
      message: "Wallet created successfully",
      data: wallet,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create wallet",
    });
  }
};

/**
 * Get restaurant's wallet
 * GET /wallets/my-wallet
 */
export const getMyWallet = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;

    const wallet = await getWalletByRestaurantIdService(restaurantId);

    res.status(200).json({
      message: "Wallet retrieved successfully",
      data: wallet,
    });
  } catch (error: any) {
    if (error.message === "Wallet not found") {
      return res.status(404).json({
        message: "Wallet not found. Please create a wallet first.",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get wallet",
    });
  }
};

/**
 * Get wallet by ID (Admin only)
 * GET /wallets/:walletId
 */
export const getWalletById = async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;

    const wallet = await getWalletByIdService(walletId);

    res.status(200).json({
      message: "Wallet retrieved successfully",
      data: wallet,
    });
  } catch (error: any) {
    if (error.message === "Wallet not found") {
      return res.status(404).json({
        message: "Wallet not found",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get wallet",
    });
  }
};

/**
 * Top up wallet using Flutterwave
 * POST /wallets/top-up
 */
export const topUpWallet = async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethod, phoneNumber, cardDetails, description } =
      req.body;
    const restaurantId = (req as any).user.id;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Valid amount is required",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
      });
    }

    // Validate payment method specific requirements
    if (paymentMethod.toUpperCase() === "MOBILE_MONEY" && !phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required for mobile money payments",
      });
    }

    if (paymentMethod.toUpperCase() === "CARD" && !cardDetails) {
      return res.status(400).json({
        message: "Card details are required for card payments",
      });
    }

    // Get wallet by restaurant ID
    let wallet;
    try {
      wallet = await getWalletByRestaurantIdService(restaurantId);
    } catch (error) {
      // If wallet doesn't exist, create one
      wallet = await createWalletService({ restaurantId });
    }

    const result = await topUpWalletService({
      walletId: wallet.id,
      amount,
      paymentMethod,
      phoneNumber,
      cardDetails,
      description,
    });

    if (result.success) {
      if (result.redirectUrl) {
        res.status(200).json({
          message: "Top-up initiated - redirect required",
          data: {
            wallet: result.wallet,
            transaction: result.transaction,
            redirectUrl: result.redirectUrl,
            status: result.status,
            requiresRedirect: true,
          },
        });
      } else {
        res.status(200).json({
          message: result.message || "Wallet top-up processed successfully",
          data: {
            wallet: result.wallet,
            transaction: result.transaction,
            status: result.status,
          },
        });
      }
    } else {
      res.status(400).json({
        message: "Top-up failed",
        error: result.message,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process wallet top-up",
    });
  }
};

/**
 * Get wallet transactions
 * GET /wallets/transactions
 */
export const getMyWalletTransactions = async (req: Request, res: Response) => {
  try {
    const {
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;
    const restaurantId = (req as any).user.id;

    // Get wallet
    const wallet = await getWalletByRestaurantIdService(restaurantId);

    // Validate filters
    if (
      type &&
      !Object.values(WalletTransactionType).includes(
        type as WalletTransactionType
      )
    ) {
      return res.status(400).json({
        message: "Invalid transaction type",
      });
    }

    if (
      status &&
      !Object.values(TransactionStatus).includes(status as TransactionStatus)
    ) {
      return res.status(400).json({
        message: "Invalid transaction status",
      });
    }

    const filters = {
      type: type as WalletTransactionType,
      status: status as TransactionStatus,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await getWalletTransactionsService(wallet.id, filters);

    res.status(200).json({
      message: "Wallet transactions retrieved successfully",
      data: result.transactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get wallet transactions",
    });
  }
};

/**
 * Get wallet transaction by ID
 * GET /wallets/transactions/:transactionId
 */
export const getWalletTransactionById = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const restaurantId = (req as any).user.id;

    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    // Check if user owns this transaction or is admin
    if (
      transaction.wallet.restaurantId !== restaurantId &&
      (req as any).user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        message: "Unauthorized access to transaction",
      });
    }

    res.status(200).json({
      message: "Transaction retrieved successfully",
      data: transaction,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get transaction",
    });
  }
};

/**
 * Get all wallets (Admin only)
 * GET /wallets
 */
export const getAllWallets = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, isActive, restaurantName } = req.query;

    const result = await getAllWalletsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      isActive: isActive ? isActive === "true" : undefined,
      restaurantName: restaurantName as string,
    });

    res.status(200).json({
      message: "Wallets retrieved successfully",
      data: result.wallets,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get wallets",
    });
  }
};

/**
 * Update wallet status (Admin only)
 * PATCH /wallets/:walletId/status
 */
export const updateWalletStatus = async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive must be a boolean value",
      });
    }

    const wallet = await updateWalletStatusService(walletId, isActive);

    res.status(200).json({
      message: `Wallet ${isActive ? "activated" : "deactivated"} successfully`,
      data: wallet,
    });
  } catch (error: any) {
    if (error.message === "Wallet not found") {
      return res.status(404).json({
        message: "Wallet not found",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update wallet status",
    });
  }
};

/**
 * Adjust wallet balance (Admin only)
 * POST /wallets/:walletId/adjust
 */
export const adjustWalletBalance = async (req: Request, res: Response) => {
  try {
    const { walletId } = req.params;
    const { amount, type, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Valid amount is required",
      });
    }

    if (!type || !["credit", "debit"].includes(type)) {
      return res.status(400).json({
        message: "Type must be either 'credit' or 'debit'",
      });
    }

    // Get wallet
    const wallet = await getWalletByIdService(walletId);

    if (!wallet.isActive) {
      return res.status(400).json({
        message: "Cannot adjust inactive wallet",
      });
    }

    let result;
    if (type === "debit") {
      // For debit, check sufficient balance
      if (wallet.balance < amount) {
        return res.status(400).json({
          message: `Insufficient wallet balance. Available: ${wallet.balance}, Required: ${amount}`,
        });
      }
      result = await debitWalletService({
        walletId,
        amount,
        description: description || `Manual debit adjustment by admin`,
        reference: `ADMIN_ADJUSTMENT_${Date.now()}`,
      });
    } else {
      result = await refundToWalletService({
        walletId,
        amount,
        description: description || `Manual credit adjustment by admin`,
        reference: `ADMIN_ADJUSTMENT_${Date.now()}`,
      });
    }

    res.status(200).json({
      message: `Wallet ${type} adjustment successful`,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "Wallet not found") {
      return res.status(404).json({
        message: "Wallet not found",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to adjust wallet balance",
    });
  }
};

/**
 * Verify wallet top-up payment
 * GET /wallets/verify-topup/:transactionId
 */
export const verifyWalletTopUp = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const result = await verifyWalletTopUpService(transactionId);

    if (result.success && result.verified) {
      res.status(200).json({
        message: "Payment verified successfully",
        data: result,
      });
    } else {
      res.status(400).json({
        message: result.error || "Payment verification failed",
        data: result,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to verify payment",
    });
  }
};
