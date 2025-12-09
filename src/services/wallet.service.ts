import dotenv from "dotenv";
import prisma from "../prisma";
import {
  sendWalletNotificationEmail,
  cleanPhoneNumber,
  isValidRwandaPhone,
} from "../utils/emailTemplates";
import {
  CreateWalletData,
  DebitWalletData,
  MobileMoneyPaymentSubmissionData,
  TopUpWalletData,
  WalletTransactionFilters,
} from "../types/paymentTypes";
import axios from "axios";

dotenv.config();

// Payment Integration
const PaypackJs = require("paypack-js").default;
const Flutterwave = require("flutterwave-node-v3");

// Initialize Paypack
const paypack = PaypackJs.config({
  client_id: process.env.PAYPACK_APPLICATION_ID,
  client_secret: process.env.PAYPACK_APPLICATION_SECRET,
});

// Initialize Flutterwave
const flw = new Flutterwave(
  process.env.FLW_PUBLIC_KEY,
  process.env.FLW_SECRET_KEY
);
/**
 * Create a new wallet for restaurant
 */
export const createWalletService = async (data: CreateWalletData) => {
  const { restaurantId, currency = "RWF" } = data;

  // Check if restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, email: true },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Check if wallet already exists
  const existingWallet = await prisma.wallet.findUnique({
    where: { restaurantId },
  });

  if (existingWallet) {
    throw new Error("Wallet already exists for this restaurant");
  }

  const wallet = await prisma.wallet.create({
    data: {
      restaurantId,
      currency,
      balance: 0,
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

  return wallet;
};

/**
 * Get wallet by restaurant ID
 */
export const getWalletByRestaurantIdService = async (restaurantId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { restaurantId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
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
    throw new Error("Wallet not found");
  }

  return wallet;
};

/**
 * Get wallet by wallet ID
 */
export const getWalletByIdService = async (walletId: string) => {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
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

  if (!wallet) {
    throw new Error("Wallet not found");
  }

  return wallet;
};

/**
 * Top up wallet
 */
export const topUpWalletService = async (data: TopUpWalletData) => {
  const { walletId, amount, paymentMethod, phoneNumber, description } = data;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Top-up amount must be greater than 0");
  }

  // Get wallet details
  const wallet = await getWalletByIdService(walletId);

  if (!wallet.isActive) {
    throw new Error("Wallet is inactive");
  }

  // Generate transaction reference
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000); // 4 random digits
  const txRef = `${timestamp}${random}`.slice(0, 15); // Ensure it's not too long

  // Create pending transaction record
  const pendingTransaction = await prisma.walletTransaction.create({
    data: {
      walletId,
      type: "TOP_UP",
      amount,
      previousBalance: wallet.balance,
      newBalance: wallet.balance, // Will be updated after payment
      description: description || `Wallet top-up via ${paymentMethod}`,
      flwTxRef: txRef,
      paymentMethod,
      status: "PENDING",
    },
  });

  try {
    let paymentResult: any;

    // Process payment based on method
    switch (paymentMethod.toUpperCase()) {
      case "MOBILE_MONEY":
        if (!phoneNumber) {
          throw new Error("Phone number is required for mobile money");
        }

        const cleanedPhone = cleanPhoneNumber(phoneNumber);
        if (!isValidRwandaPhone(cleanedPhone)) {
          throw new Error("Invalid Rwanda mobile number format");
        }

        paymentResult = await processMobileMoneyTopUp({
          amount,
          phoneNumber: cleanedPhone,
          txRef,
          orderId: pendingTransaction.id,
          email: wallet.restaurant.email,
          fullname: wallet.restaurant.name,
          currency: wallet.currency,
        });
        break;

      case "CARD":
        paymentResult = await processCardTopUp({
          amount,
          txRef,
          email: wallet.restaurant.email,
          fullname: wallet.restaurant.name,
          phoneNumber: wallet.restaurant.phone || "",
          currency: wallet.currency,
        });
        break;

      default:
        throw new Error(`Unsupported payment method: ${paymentMethod}`);
    }

    // Update transaction with payment result
    const updatedTransaction = await prisma.walletTransaction.update({
      where: { id: pendingTransaction.id },
      data: {
        flwRef: paymentResult.flwRef,
        flwStatus: paymentResult.status,
        externalTxId: paymentResult.transactionId,
        status: paymentResult.success
          ? paymentResult.status === "successful"
            ? "COMPLETED"
            : "PROCESSING"
          : "FAILED",
        metadata: {
          paymentResponse: paymentResult,
        },
      },
    });

    // If payment is successful, update wallet balance
    if (paymentResult.success && paymentResult.status === "successful") {
      const newBalance = wallet.balance + amount;

      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: walletId },
          data: {
            balance: newBalance,
            updatedAt: new Date(),
          },
        }),
        prisma.walletTransaction.update({
          where: { id: pendingTransaction.id },
          data: {
            newBalance,
            status: "COMPLETED",
          },
        }),
      ]);

      // Send notification email
      if (wallet.restaurant.email) {
        try {
          await sendWalletNotificationEmail({
            email: wallet.restaurant.email,
            restaurantName: wallet.restaurant.name,
            type: "TOP_UP",
            amount,
            newBalance,
            transactionId: txRef,
            paymentMethod,
          });
        } catch (emailError) {
          console.log("Failed to send wallet notification email:", emailError);
        }
      }
    }

    return {
      success: paymentResult.success,
      transaction: updatedTransaction,
      wallet: await getWalletByIdService(walletId),
      redirectUrl: paymentResult.redirectUrl,
      transferDetails: paymentResult.transferDetails,
      status: paymentResult.status,
      message: paymentResult.message,
    };
  } catch (error: any) {
    // Update transaction as failed
    await prisma.walletTransaction.update({
      where: { id: pendingTransaction.id },
      data: {
        status: "FAILED",
      },
    });

    throw new Error(`Wallet top-up failed: ${error.message}`);
  }
};

/**
 * Debit wallet for payments (CASH payment method)
 */
export const debitWalletService = async (data: DebitWalletData) => {
  const { walletId, amount, description, reference, orderId } = data;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Debit amount must be greater than 0");
  }

  // Get wallet details
  const wallet = await getWalletByIdService(walletId);

  if (!wallet.isActive) {
    throw new Error("Wallet is inactive");
  }

  // Check sufficient balance
  if (wallet.balance < amount) {
    throw new Error(
      `Insufficient wallet balance. Available: ${wallet.balance}, Required: ${amount}`
    );
  }

  const newBalance = wallet.balance - amount;

  // Create transaction and update wallet balance atomically
  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        updatedAt: new Date(),
      },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId,
        type: "PAYMENT",
        amount: -amount, // Negative for debit
        previousBalance: wallet.balance,
        newBalance,
        description: description || "Payment deduction",
        reference,
        status: "COMPLETED",
        metadata: orderId ? { orderId } : undefined,
      },
    }),
  ]);

  // Send notification email
  if (wallet.restaurant.email) {
    try {
      await sendWalletNotificationEmail({
        email: wallet.restaurant.email,
        restaurantName: wallet.restaurant.name,
        type: "PAYMENT",
        amount,
        newBalance,
        transactionId: transaction.id,
        description: description || "Payment deduction",
      });
    } catch (emailError) {
      console.log("Failed to send wallet notification email:", emailError);
    }
  }

  return {
    wallet: updatedWallet,
    transaction,
    newBalance,
  };
};

/**
 * Refund to wallet
 */
export const refundToWalletService = async (data: DebitWalletData) => {
  const { walletId, amount, description, reference } = data;

  // Validate amount
  if (amount <= 0) {
    throw new Error("Refund amount must be greater than 0");
  }

  // Get wallet details
  const wallet = await getWalletByIdService(walletId);

  if (!wallet.isActive) {
    throw new Error("Wallet is inactive");
  }

  const newBalance = wallet.balance + amount;

  // Create transaction and update wallet balance atomically
  const [updatedWallet, transaction] = await prisma.$transaction([
    prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: newBalance,
        updatedAt: new Date(),
      },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId,
        type: "REFUND",
        amount, // Positive for credit
        previousBalance: wallet.balance,
        newBalance,
        description: description || "Refund credit",
        reference,
        status: "COMPLETED",
      },
    }),
  ]);

  // Send notification email
  if (wallet.restaurant.email) {
    try {
      await sendWalletNotificationEmail({
        email: wallet.restaurant.email,
        restaurantName: wallet.restaurant.name,
        type: "REFUND",
        amount,
        newBalance,
        transactionId: transaction.id,
        description: description || "Refund credit",
      });
    } catch (emailError) {
      console.log("Failed to send wallet notification email:", emailError);
    }
  }

  return {
    wallet: updatedWallet,
    transaction,
    newBalance,
  };
};

/**
 * Get wallet transactions with filtering
 */
export const getWalletTransactionsService = async (
  walletId: string,
  filters: WalletTransactionFilters = {}
) => {
  const { type, status, startDate, endDate, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  const where: any = { walletId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        wallet: {
          select: {
            id: true,
            currency: true,
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Update wallet status (activate/deactivate)
 */
export const updateWalletStatusService = async (
  walletId: string,
  isActive: boolean
) => {
  const wallet = await prisma.wallet.update({
    where: { id: walletId },
    data: {
      isActive,
      updatedAt: new Date(),
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

  return wallet;
};

/**
 * Get all wallets (Admin only)
 */
export const getAllWalletsService = async ({
  page = 1,
  limit = 20,
  isActive,
  restaurantName,
}: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  restaurantName?: string;
} = {}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (isActive !== undefined) where.isActive = isActive;
  if (restaurantName) {
    where.restaurant = {
      name: {
        contains: restaurantName,
        mode: "insensitive",
      },
    };
  }

  const [wallets, total] = await Promise.all([
    prisma.wallet.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.wallet.count({ where }),
  ]);

  return {
    wallets,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Verify wallet top-up payment
 */
export const verifyWalletTopUpService = async (transactionId: string) => {
  try {
    // Find the wallet transaction
    let walletTransaction = await prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
      },
      include: {
        wallet: {
          include: { restaurant: true },
        },
      },
    });

    console.log("Verifying wallet transaction:", walletTransaction);

    if (!walletTransaction) {
      return {
        success: false,
        verified: false,
        error: "Transaction not found",
      };
    }

    // For mobile money, we need to check if we have a proper Flutterwave transaction ID
    // If the flwRef is still our custom tx_ref, we can't verify yet
    if (
      walletTransaction.flwRef &&
      walletTransaction.flwRef.startsWith("WALLET_TOPUP_")
    ) {
      return {
        success: false,
        verified: false,
        error:
          "Transaction not yet processed by Flutterwave. Please wait for webhook or customer to complete payment.",
        status: "pending",
      };
    }

    // Only try to verify if we have a numeric transaction ID from Flutterwave
    if (
      !walletTransaction.externalTxId ||
      isNaN(Number(walletTransaction.externalTxId))
    ) {
      return {
        success: false,
        verified: false,
        error: "No valid Flutterwave transaction ID available for verification",
        status: "pending",
      };
    }

    // Verify with Flutterwave using the numeric ID
    const response = await flw.Transaction.verify({
      id: Number(walletTransaction.externalTxId),
    });

    console.log("Flutterwave verification response:", response);

    if (
      response.status === "success" &&
      response.data.status === "successful"
    ) {
      // Update transaction if not already completed
      if (walletTransaction.status !== "COMPLETED") {
        const newBalance =
          walletTransaction.wallet.balance + walletTransaction.amount;

        // Update wallet balance and transaction status
        await prisma.$transaction([
          prisma.wallet.update({
            where: { id: walletTransaction.walletId },
            data: {
              balance: newBalance,
              updatedAt: new Date(),
            },
          }),
          prisma.walletTransaction.update({
            where: { id: walletTransaction.id },
            data: {
              status: "COMPLETED",
              newBalance,
              flwStatus: "successful",
              externalTxId: response.data.id?.toString(),
              flwRef: response.data.flw_ref,
            },
          }),
        ]);

        // Send notification email
        try {
          await sendWalletNotificationEmail({
            email: walletTransaction.wallet.restaurant.email,
            restaurantName: walletTransaction.wallet.restaurant.name,
            type: "TOP_UP",
            amount: walletTransaction.amount,
            newBalance,
            transactionId: response.data.flw_ref || walletTransaction.id,
            paymentMethod: walletTransaction.paymentMethod || "Unknown",
          });
        } catch (emailError) {
          console.log("Failed to send wallet notification email:", emailError);
        }
      }

      return {
        success: true,
        verified: true,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status,
        transactionId: response.data.id,
        flwRef: response.data.flw_ref,
      };
    }

    // Update transaction as failed if verification shows it failed
    if (
      walletTransaction.status === "PENDING" ||
      walletTransaction.status === "PROCESSING"
    ) {
      await prisma.walletTransaction.update({
        where: { id: walletTransaction.id },
        data: {
          status: "FAILED",
          flwStatus: response.data?.status || "failed",
        },
      });
    }

    return {
      success: false,
      verified: false,
      error: "Payment verification failed",
      status: response.data?.status,
      message: response.message,
    };
  } catch (error: any) {
    console.log("Error verifying wallet top-up:", error);
    return {
      success: false,
      verified: false,
      error: "Payment verification failed: " + error.message,
    };
  }
};

/**
 * Process Mobile Money Top-Up with PayPack and Flutterwave fallback
 */
async function processMobileMoneyTopUp(
  params: MobileMoneyPaymentSubmissionData
) {
  try {
    // Clean and validate phone number
    const cleanedPhoneNumber = cleanPhoneNumber(params.phoneNumber);

    if (!isValidRwandaPhone(cleanedPhoneNumber)) {
      throw new Error(
        "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX"
      );
    }

    console.log(
      `Processing mobile money top-up: ${params.amount} ${params.currency} to ${cleanedPhoneNumber}`
    );

    // Primary: Try PayPack first
    try {
      const response = await paypack.cashin({
        number: cleanedPhoneNumber,
        amount: params.amount,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
      });

      if (response && response.data) {
        console.log("PayPack top-up initiated successfully");
        return {
          success: true,
          transactionId: response.data.ref || params.txRef,
          flwRef: response.data.ref || params.txRef,
          status: "pending",
          message:
            "Top-up request sent to your phone number, please confirm it.",
          redirectUrl: "",
        };
      } else {
        throw new Error("PayPack response invalid or missing reference");
      }
    } catch (error: any) {
      console.log(
        "PayPack top-up failed, falling back to Flutterwave:",
        error.message
      );

      // Fallback: Try Flutterwave Hosted Checkout
      const standardPayload = {
        tx_ref: params.txRef,
        amount: params.amount.toString(),
        currency: params.currency,
        redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/wallet/confirmation`,
        customer: {
          email: params.email,
          name: params.fullname,
        },
        payment_options: "mobilemoney",
        meta: {
          transaction_type: "WALLET_TOPUP",
        },
      };

      const response = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        standardPayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.status === "success" && response.data?.data?.link) {
        console.log("Flutterwave hosted checkout link generated successfully");
        return {
          success: true,
          transactionId: params.txRef,
          flwRef: params.txRef,
          status: "pending",
          message: "Redirect to complete mobile money top-up",
          redirectUrl: response.data.data.link,
        };
      } else {
        throw new Error("Flutterwave mobile money top-up failed");
      }
    }
  } catch (error: any) {
    console.log("Mobile money top-up failed:", error);

    let errorMessage = "Mobile money top-up processing failed";
    if (error.message.includes("Invalid") || error.message.includes("phone")) {
      errorMessage = "Invalid phone number format";
    } else if (error.message.includes("insufficient")) {
      errorMessage = "Insufficient balance";
    }

    return {
      success: false,
      transactionId: "",
      flwRef: "",
      status: "failed",
      message: errorMessage,
      error: errorMessage,
    };
  }
}

/**
 * Process Card Top-Up - Using Flutterwave Hosted Checkout Only
 */
async function processCardTopUp(params: any) {
  try {
    console.log(
      `Processing card top-up: ${params.amount} ${params.currency} for ${params.email}`
    );

    // Use Flutterwave Hosted Checkout - No card details needed
    const standardPayload = {
      tx_ref: params.txRef,
      amount: params.amount.toString(),
      currency: params.currency,
      redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/wallet/confirmation`,
      customer: {
        email: params.email,
        name: params.fullname,
      },
      customizations: {
        title: "Wallet Top-Up - Food Bundles",
        description: `Wallet top-up for ${params.fullname}`,
        logo: `https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png`,
      },
      payment_options: "card",
      meta: {
        transaction_type: "WALLET_TOPUP",
        wallet_ref: params.txRef,
      },
    };

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      standardPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data?.status === "success" && response.data?.data?.link) {
      console.log("Flutterwave hosted checkout link generated successfully");
      return {
        success: true,
        transactionId: params.txRef,
        flwRef: params.txRef,
        status: "pending",
        message: "Redirect to complete card top-up",
        redirectUrl: response.data.data.link,
      };
    } else {
      throw new Error("Flutterwave hosted checkout link generation failed");
    }
  } catch (error: any) {
    console.log("Card top-up failed:", error.message);
    return {
      success: false,
      error: "Card top-up processing failed: " + error.message,
      transactionId: "",
      flwRef: "",
      status: "failed",
      message: "Card top-up processing failed: " + error.message,
    };
  }
}
