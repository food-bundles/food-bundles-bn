import { Request, Response } from "express";
import {
  createVoucherService,
  getVoucherByIdService,
  getVoucherByCodeService,
  getRestaurantVouchersService,
  getAvailableVouchersForCheckoutService,
  updateVoucherService,
  deactivateVoucherService,
  submitLoanApplicationService,
  getLoanApplicationByIdService,
  getRestaurantLoanApplicationsService,
  getAllLoanApplicationsService,
  approveLoanApplicationService,
  disburseLoanService,
  rejectLoanApplicationService,
  processVoucherPaymentService,
  processRepaymentService,
  calculateOutstandingBalanceService,
  calculatePenaltiesService,
  getLoanPenaltiesService,
  waivePenaltyService,
  getVoucherTransactionHistoryService,
  getRestaurantCreditSummaryService,
} from "../services/voucher.service";
import { VoucherStatus, LoanStatus } from "@prisma/client";

// ============================================
// VOUCHER MANAGEMENT CONTROLLERS
// ============================================

/**
 * Create voucher (Admin only)
 * POST /vouchers
 */
export const createVoucher = async (req: Request, res: Response) => {
  try {
    const {
      restaurantId,
      voucherType,
      creditLimit,
      minTransactionAmount,
      maxTransactionAmount,
      expiryDate,
      loanId,
    } = req.body;

    // Validate required fields
    if (!restaurantId || !voucherType || !creditLimit) {
      return res.status(400).json({
        message: "Restaurant ID, voucher type, and credit limit are required",
      });
    }

    // Validate voucher type
    const validTypes = [
      "DISCOUNT_10",
      "DISCOUNT_20",
      "DISCOUNT_50",
      "DISCOUNT_80",
      "DISCOUNT_100",
    ];
    if (!validTypes.includes(voucherType)) {
      return res.status(400).json({
        message: "Invalid voucher type",
      });
    }

    const voucher = await createVoucherService({
      restaurantId,
      voucherType,
      creditLimit: parseFloat(creditLimit),
      minTransactionAmount: minTransactionAmount
        ? parseFloat(minTransactionAmount)
        : undefined,
      maxTransactionAmount: maxTransactionAmount
        ? parseFloat(maxTransactionAmount)
        : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      loanId,
    });

    res.status(201).json({
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create voucher",
    });
  }
};

/**
 * Get all vouchers (Admin only)
 * GET /vouchers
 */
export const getAllVouchers = async (req: Request, res: Response) => {
  try {
    const { status, restaurantId } = req.query;

    // For admin, can filter by restaurant
    // For now, we'll implement a simple version
    const filters: any = {};
    if (status) filters.status = status;

    // This would need implementation in service
    res.status(200).json({
      message: "Feature to be implemented - use restaurant-specific endpoint",
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get vouchers",
    });
  }
};

/**
 * Get voucher by ID
 * GET /vouchers/:id
 */
export const getVoucherById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    const voucher = await getVoucherByIdService(id);

    // Check authorization
    if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Voucher does not belong to this restaurant",
      });
    }

    res.status(200).json({
      message: "Voucher retrieved successfully",
      data: voucher,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get voucher",
    });
  }
};

/**
 * Get restaurant's vouchers
 * GET /vouchers/restaurant/:restaurantId
 */
export const getRestaurantVouchers = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { status, activeOnly } = req.query;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Check authorization
    if (userRole === "RESTAURANT" && restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Cannot access other restaurant's vouchers",
      });
    }

    const filters: any = {};
    if (status) filters.status = status as VoucherStatus;
    if (activeOnly === "true") filters.activeOnly = true;

    const vouchers = await getRestaurantVouchersService(restaurantId, filters);

    res.status(200).json({
      message: "Vouchers retrieved successfully",
      data: vouchers,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get vouchers",
    });
  }
};

/**
 * Get available vouchers for checkout
 * GET /vouchers/available
 */
export const getAvailableVouchers = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { amount } = req.query;

    if (!amount) {
      return res.status(400).json({
        message: "Order amount is required",
      });
    }

    const vouchers = await getAvailableVouchersForCheckoutService(
      restaurantId,
      parseFloat(amount as string)
    );

    res.status(200).json({
      message: "Available vouchers retrieved successfully",
      data: vouchers,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get available vouchers",
    });
  }
};

/**
 * Update voucher (Admin only)
 * PATCH /vouchers/:id
 */
export const updateVoucher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, expiryDate, maxTransactionAmount, minTransactionAmount } =
      req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (expiryDate) updateData.expiryDate = new Date(expiryDate);
    if (maxTransactionAmount)
      updateData.maxTransactionAmount = parseFloat(maxTransactionAmount);
    if (minTransactionAmount)
      updateData.minTransactionAmount = parseFloat(minTransactionAmount);

    const voucher = await updateVoucherService(id, updateData);

    res.status(200).json({
      message: "Voucher updated successfully",
      data: voucher,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update voucher",
    });
  }
};

/**
 * Deactivate voucher (Admin only)
 * DELETE /vouchers/:id
 */
export const deactivateVoucher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const voucher = await deactivateVoucherService(id, reason);

    res.status(200).json({
      message: "Voucher deactivated successfully",
      data: voucher,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to deactivate voucher",
    });
  }
};

/**
 * Get voucher transaction history
 * GET /vouchers/:id/transactions
 */
export const getVoucherTransactions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Get voucher to check ownership
    const voucher = await getVoucherByIdService(id);

    // Check authorization
    if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Voucher does not belong to this restaurant",
      });
    }

    const transactions = await getVoucherTransactionHistoryService(id);

    res.status(200).json({
      message: "Transaction history retrieved successfully",
      data: transactions,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get transaction history",
    });
  }
};

/**
 * Get voucher by code
 * GET /vouchers/code/:voucherCode
 */
export const getVoucherByCode = async (req: Request, res: Response) => {
  try {
    const { voucherCode } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    const voucher = await getVoucherByCodeService(voucherCode);

    // Check authorization - restaurants can only see their own vouchers
    if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Voucher does not belong to this restaurant",
      });
    }

    res.status(200).json({
      message: "Voucher retrieved successfully",
      data: voucher,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get voucher",
    });
  }
};

// ============================================
// LOAN APPLICATION CONTROLLERS
// ============================================

/**
 * Submit loan application (Restaurant)
 * POST /vouchers/loans/apply
 */
export const applyForLoan = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { requestedAmount, purpose, terms } = req.body;

    if (!requestedAmount) {
      return res.status(400).json({
        message: "Requested amount is required",
      });
    }

    const loanApplication = await submitLoanApplicationService({
      restaurantId,
      requestedAmount: parseFloat(requestedAmount),
      purpose,
      terms,
    });

    res.status(201).json({
      message: "Loan application submitted successfully",
      data: loanApplication,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to submit loan application",
    });
  }
};

/**
 * Get restaurant's loan applications
 * GET /vouchers/loans/my-applications
 */
export const getMyLoanApplications = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;

    const loans = await getRestaurantLoanApplicationsService(restaurantId);

    res.status(200).json({
      message: "Loan applications retrieved successfully",
      data: loans,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get loan applications",
    });
  }
};

/**
 * Get all loan applications (Admin)
 * GET /vouchers/loans/applications
 */
export const getAllLoanApplications = async (req: Request, res: Response) => {
  try {
    const { status, restaurantId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as LoanStatus;
    if (restaurantId) filters.restaurantId = restaurantId as string;

    const loans = await getAllLoanApplicationsService(filters);

    res.status(200).json({
      message: "Loan applications retrieved successfully",
      data: loans,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get loan applications",
    });
  }
};

/**
 * Get loan application by ID
 * GET /vouchers/loans/:id
 */
export const getLoanApplicationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    const loan = await getLoanApplicationByIdService(id);

    // Check authorization
    if (userRole === "RESTAURANT" && loan.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Loan does not belong to this restaurant",
      });
    }

    res.status(200).json({
      message: "Loan application retrieved successfully",
      data: loan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get loan application",
    });
  }
};

/**
 * Approve loan application (Admin)
 * PATCH /vouchers/loans/:id/approve
 */
export const approveLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;
    const { approvedAmount, repaymentDays, voucherType, notes } = req.body;

    if (!approvedAmount || !voucherType) {
      return res.status(400).json({
        message: "Approved amount and voucher type are required",
      });
    }

    const loan = await approveLoanApplicationService(id, {
      approvedAmount: parseFloat(approvedAmount),
      approvedBy: adminId,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : 30,
      voucherType,
      notes,
    });

    res.status(200).json({
      message: "Loan approved successfully",
      data: loan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to approve loan",
    });
  }
};

/**
 * Disburse loan (Admin)
 * POST /vouchers/loans/:id/disburse
 */
export const disburseLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;

    const result = await disburseLoanService(id, adminId);

    res.status(200).json({
      message: "Loan disbursed successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to disburse loan",
    });
  }
};

/**
 * Reject loan application (Admin)
 * PATCH /vouchers/loans/:id/reject
 */
export const rejectLoan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;
    const { reason } = req.body;

    const loan = await rejectLoanApplicationService(id, adminId, reason);

    res.status(200).json({
      message: "Loan rejected successfully",
      data: loan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to reject loan",
    });
  }
};

// ============================================
// VOUCHER PAYMENT CONTROLLERS
// ============================================

/**
 * Process voucher payment (used during checkout)
 * POST /vouchers/checkout/voucher
 */
export const processVoucherPayment = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { voucherId, orderId, originalAmount } = req.body;

    if (!voucherId || !orderId || !originalAmount) {
      return res.status(400).json({
        message: "Voucher ID, order ID, and original amount are required",
      });
    }

    const result = await processVoucherPaymentService({
      voucherId,
      orderId,
      restaurantId,
      originalAmount: parseFloat(originalAmount),
    });

    res.status(200).json({
      message: "Voucher payment processed successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process voucher payment",
    });
  }
};

// ============================================
// REPAYMENT CONTROLLERS
// ============================================

/**
 * Make repayment (Restaurant)
 * POST /vouchers/:id/repay
 */
export const makeRepayment = async (req: Request, res: Response) => {
  try {
    const { id: voucherId } = req.params;
    const restaurantId = (req as any).user.id;
    const { amount, paymentMethod, paymentReference, loanId } = req.body;

    if (!amount || !paymentMethod || !loanId) {
      return res.status(400).json({
        message: "Amount, payment method, and loan ID are required",
      });
    }

    const result = await processRepaymentService({
      restaurantId,
      loanId,
      amount: parseFloat(amount),
      paymentMethod,
      paymentReference,
      voucherId,
    });

    res.status(200).json({
      message: "Repayment processed successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process repayment",
    });
  }
};

/**
 * Get outstanding balance
 * GET /vouchers/:id/outstanding
 */
export const getOutstandingBalance = async (req: Request, res: Response) => {
  try {
    const { id: voucherId } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Get voucher to get loan ID
    const voucher = await getVoucherByIdService(voucherId);

    // Check authorization
    if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Voucher does not belong to this restaurant",
      });
    }

    if (!voucher.loanId) {
      return res.status(400).json({
        message: "Voucher is not associated with a loan",
      });
    }

    const outstanding = await calculateOutstandingBalanceService(
      voucher.loanId
    );

    res.status(200).json({
      message: "Outstanding balance retrieved successfully",
      data: outstanding,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get outstanding balance",
    });
  }
};

// ============================================
// PENALTY CONTROLLERS
// ============================================

/**
 * Calculate penalties (Admin/System)
 * POST /vouchers/penalties/calculate
 */
export const calculatePenalties = async (req: Request, res: Response) => {
  try {
    const { loanId, penaltyRatePerMonth } = req.body;

    const results = await calculatePenaltiesService(
      loanId,
      penaltyRatePerMonth ? parseFloat(penaltyRatePerMonth) : 2
    );

    res.status(200).json({
      message: "Penalties calculated successfully",
      data: results,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to calculate penalties",
    });
  }
};

/**
 * Get penalties for voucher
 * GET /vouchers/:id/penalties
 */
export const getVoucherPenalties = async (req: Request, res: Response) => {
  try {
    const { id: voucherId } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Get voucher to get loan ID
    const voucher = await getVoucherByIdService(voucherId);

    // Check authorization
    if (userRole === "RESTAURANT" && voucher.restaurantId !== userId) {
      return res.status(403).json({
        message: "Unauthorized: Voucher does not belong to this restaurant",
      });
    }

    if (!voucher.loanId) {
      return res.status(400).json({
        message: "Voucher is not associated with a loan",
      });
    }

    const penalties = await getLoanPenaltiesService(voucher.loanId);

    res.status(200).json({
      message: "Penalties retrieved successfully",
      data: penalties,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get penalties",
    });
  }
};

/**
 * Waive penalty (Admin)
 * POST /vouchers/penalties/:id/waive
 */
export const waivePenalty = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user.id;
    const { reason } = req.body;

    const penalty = await waivePenaltyService(id, adminId, reason);

    res.status(200).json({
      message: "Penalty waived successfully",
      data: penalty,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to waive penalty",
    });
  }
};

// ============================================
// CREDIT SUMMARY CONTROLLERS
// ============================================

/**
 * Get restaurant credit summary
 * GET /vouchers/credit-summary
 */
export const getRestaurantCreditSummary = async (
  req: Request,
  res: Response
) => {
  try {
    const restaurantId = (req as any).user.id;

    const summary = await getRestaurantCreditSummaryService(restaurantId);

    res.status(200).json({
      message: "Credit summary retrieved successfully",
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get credit summary",
    });
  }
};
