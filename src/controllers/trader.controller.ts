import { Request, Response } from "express";
import {
  createTraderWalletService,
  getTraderWalletService,
  topUpTraderWalletService,
  getTraderLoanApplicationsService,
  getTraderVouchersService,
  traderApproveLoanService,
  calculateTraderCommissionService,
  processTraderCommissionService,
  getTraderOrdersService,
  getTraderTransactionHistoryService,
  getTraderTransactionByIdService,
  getTraderTransactionStatsService,
  getTraderDashboardStatsService,
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
      data: wallet,
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
    const { amount, paymentMethod, phoneNumber, description } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Amount and payment method are required",
      });
    }

    const result = await topUpTraderWalletService({
      traderId,
      amount: parseFloat(amount),
      paymentMethod,
      phoneNumber,
      description,
    });

    res.status(200).json({
      success: true,
      message: "Wallet top-up initiated successfully",
      data: result,
    });
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

    const loans = await getTraderLoanApplicationsService(traderId, filters);

    res.status(200).json({
      success: true,
      data: loans,
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

    const vouchers = await getTraderVouchersService(traderId, filters);

    res.status(200).json({
      success: true,
      data: vouchers,
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
    const { approvedAmount, repaymentDays, voucherType, notes } = req.body;

    if (!approvedAmount || !repaymentDays || !voucherType) {
      return res.status(400).json({
        success: false,
        message:
          "Approved amount, repayment days, and voucher type are required",
      });
    }

    // Validate voucher type
    const validVoucherTypes = [
      "DISCOUNT_10",
      "DISCOUNT_20",
      "DISCOUNT_50",
      "DISCOUNT_80",
      "DISCOUNT_100",
    ];
    if (!validVoucherTypes.includes(voucherType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid voucher type",
      });
    }

    const result = await traderApproveLoanService(traderId, loanId, {
      approvedAmount: parseFloat(approvedAmount),
      repaymentDays: parseInt(repaymentDays),
      voucherType: voucherType as
        | "DISCOUNT_10"
        | "DISCOUNT_20"
        | "DISCOUNT_50"
        | "DISCOUNT_80"
        | "DISCOUNT_100",
      notes,
    });

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
    const commission = await calculateTraderCommissionService(traderId);

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
