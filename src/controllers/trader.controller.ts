import { Request, Response } from "express";
import {
  createTraderWalletService,
  getTraderWalletService,
  topUpTraderWalletService,
  getTraderLoanApplicationsService,
  getTraderVouchersService,
  traderApproveLoanService,
  getTraderCommissionDetailsService,
  processTraderCommissionService,
  getTraderOrdersService,
  getTraderTransactionHistoryService,
  getTraderTransactionByIdService,
  getTraderTransactionStatsService,
  getTraderDashboardStatsService,
  setTraderWalletCommissionService,
  processAllTradersCommissionService,
  processExistingUsedVouchersService,
  requestDelegationService,
  approveDelegationService,
  verifyDelegationOTPService,
  revokeDelegationService,
} from "../services/trader.service";

// Create trader wallet
export const createTraderWallet = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const result = await createTraderWalletService(traderId);

    res.status(201).json({
      success: true,
      message: "Trader wallet created successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get trader wallet
export const getTraderWallet = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const wallet = await getTraderWalletService(traderId);

    res.status(200).json({
      success: true,
      data: {
        ...wallet,
        // Include calculated fields for better API response
        availableBalance: wallet.availableBalance,
        totalVouchersAmount: wallet.totalVouchersAmount,
        totalVouchersCount: wallet.totalVouchersCount,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Top up trader wallet
export const topUpTraderWallet = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const { amount, paymentMethodId, phoneNumber, description } = req.body;

    if (!amount || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "Amount and payment method ID are required",
      });
    }

    const result = await topUpTraderWalletService({
      traderId,
      amount: parseFloat(amount),
      paymentMethodId,
      phoneNumber,
      description,
    });

    if (result.success) {
      if (result.redirectUrl) {
        res.status(200).json({
          success: true,
          message: "Top-up initiated - redirect required",
          data: {
            wallet: result.wallet,
            transaction: result.transaction,
            redirectUrl: result.redirectUrl,
            status: result.status,
            requiresRedirect: true,
            paymentMethodDetails: result.paymentMethodDetails,
          },
        });
      } else {
        res.status(200).json({
          success: true,
          message: result.message || "Wallet top-up processed successfully",
          data: {
            wallet: result.wallet,
            transaction: result.transaction,
            status: result.status,
            paymentMethodDetails: result.paymentMethodDetails,
          },
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Top-up failed",
        error: result.message,
      });
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get loan applications
export const getTraderLoanApplications = async (
  req: Request,
  res: Response,
) => {
  try {
    const traderId = (req as any).user.id;
    const { status, restaurantId, page, limit } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (restaurantId) filters.restaurantId = restaurantId;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    const result = await getTraderLoanApplicationsService(traderId, filters);

    res.status(200).json({
      success: true,
      data: result.loans,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get vouchers
export const getTraderVouchers = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const { status, restaurantId, page, limit } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (restaurantId) filters.restaurantId = restaurantId;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    const result = await getTraderVouchersService(traderId, filters);

    res.status(200).json({
      success: true,
      data: result.vouchers,
      statistics: result.statistics,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Approve loan
export const traderApproveLoan = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const { loanId } = req.params;

    const result = await traderApproveLoanService(traderId, loanId);

    res.status(200).json({
      success: true,
      message: "Loan approved successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get commission
export const getTraderCommission = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const commission = await getTraderCommissionDetailsService(traderId);

    res.status(200).json({
      success: true,
      data: commission,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Process commission payment
export const processTraderCommission = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const result = await processTraderCommissionService(traderId);

    res.status(200).json({
      success: true,
      message: "Commission processed successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get orders
export const getTraderOrders = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const { page = 1, limit = 10 } = req.query;

    const filters = {
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
    };

    const orders = await getTraderOrdersService(traderId, filters);

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get transaction history
export const getTraderTransactionHistory = async (
  req: Request,
  res: Response,
) => {
  try {
    const traderId = (req as any).user.id;
    const { type, status, startDate, endDate, page, limit } = req.query;

    const result = await getTraderTransactionHistoryService(traderId, {
      type: type as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Transaction history retrieved successfully",
      data: result.transactions,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get transaction by ID
export const getTraderTransactionById = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const { transactionId } = req.params;

    const transaction = await getTraderTransactionByIdService(
      traderId,
      transactionId,
    );

    res.status(200).json({
      success: true,
      message: "Transaction retrieved successfully",
      data: transaction,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// Get transaction stats
export const getTraderTransactionStats = async (
  req: Request,
  res: Response,
) => {
  try {
    const traderId = (req as any).user.id;
    const stats = await getTraderTransactionStatsService(traderId);

    res.status(200).json({
      success: true,
      message: "Transaction statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Set trader wallet commission (Admin only)
export const setTraderWalletCommission = async (
  req: Request,
  res: Response,
) => {
  try {
    const { traderId } = req.params;
    const { commission } = req.body;

    if (!commission || commission < 0 || commission > 100) {
      return res.status(400).json({
        success: false,
        message: "Commission must be between 0 and 100 percent",
      });
    }

    const wallet = await setTraderWalletCommissionService(
      traderId,
      parseFloat(commission),
    );

    res.status(200).json({
      success: true,
      message: "Trader wallet commission updated successfully",
      data: wallet,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get dashboard stats
export const getTraderDashboard = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const stats = await getTraderDashboardStatsService(traderId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Process all traders commission (Admin only)
export const processAllTradersCommission = async (req: Request, res: Response) => {
  try {
    const results = await processAllTradersCommissionService();

    res.status(200).json({
      success: true,
      message: "All traders commission processed successfully",
      data: {
        processedVouchers: results.length,
        results,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Process existing used vouchers (Admin only)
export const processExistingUsedVouchers = async (req: Request, res: Response) => {
  try {
    const results = await processExistingUsedVouchersService();

    res.status(200).json({
      success: true,
      message: "Existing used vouchers processed successfully",
      data: {
        processedVouchers: results.length,
        results,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// Request delegation permission
export const requestDelegation = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user.id;
    const result = await requestDelegationService(traderId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin approve delegation
export const approveDelegation = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { traderId } = req.params;
    const { commission } = req.body;

    if (!commission || commission < 0 || commission > 100) {
      return res.status(400).json({
        success: false,
        message: "Valid commission percentage (0-100) is required",
      });
    }

    const result = await approveDelegationService(adminId, traderId, commission);

    res.status(200).json({
      success: true,
      message: result.message,
      sessionId: result.sessionId,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify delegation OTP
export const verifyDelegationOTP = async (req: Request, res: Response) => {
  try {
    const { sessionId, otp, commission } = req.body;

    if (!sessionId || !otp || !commission) {
      return res.status(400).json({
        success: false,
        message: "Session ID, OTP, and commission are required",
      });
    }

    const result = await verifyDelegationOTPService(sessionId, otp, commission);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Revoke delegation permission
export const revokeDelegation = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const { traderId } = req.params;

    const result = await revokeDelegationService(adminId, traderId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};