import { Request, Response } from "express";
import prisma from "../prisma";
import {
  requestVoucherCardService,
  issueVoucherCardService,
  getMyVoucherCardService,
  getAllVoucherCardsService,
  getVoucherCardByPanService,
  requestLoanSessionService,
  approveLoanSessionService,
  rejectLoanSessionService,
  acceptLoanSessionService,
  getLoanTradersService,
  getLoanTermsService,
  acceptLoanTermsService,
  getTraderLoanSessionsService,
  traderApproveLoanSessionService,
  adminApproveLoanSessionOnBehalfService,
  payUnlockFeeService,
  verifyUnlockFeePaymentService,
  getMyLoanSessionsService,
  getAllLoanSessionsService,
  getLoanSessionByIdService,
  getCardEnrollmentRequestsService,
  getVoucherCardStatsService,
  updateVoucherCardUnlockFeeService,
  getRecentActivitiesService,
} from "../services/voucher-card.service";
import { CardStatus, LoanSessionStatus } from "@prisma/client";

// ============================================
// CARD ENDPOINTS
// ============================================

export const requestVoucherCard = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const result = await requestVoucherCardService(restaurantId);
    res.status(201).json({ success: true, data: result, message: "Card enrollment request submitted" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const issueVoucherCard = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { restaurantId, loanLimit } = req.body;
    if (!restaurantId) {
      return res.status(400).json({ success: false, message: "restaurantId is required" });
    }
    const card = await issueVoucherCardService(restaurantId, adminId, loanLimit);
    res.status(201).json({ success: true, data: card, message: "Voucher card issued successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyVoucherCard = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const card = await getMyVoucherCardService(restaurantId);
    res.json({ success: true, data: card });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllVoucherCards = async (req: Request, res: Response) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await getAllVoucherCardsService({
      status: status as CardStatus | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVoucherCardByPan = async (req: Request, res: Response) => {
  try {
    const { pan } = req.params;
    const card = await getVoucherCardByPanService(pan);
    res.json({ success: true, data: card });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const updateVoucherCardUnlockFee = async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const { unlockFeeEnabled, unlockFeePercentage } = req.body;
    if (unlockFeeEnabled === undefined) {
      return res.status(400).json({ success: false, message: "unlockFeeEnabled is required" });
    }
    const card = await updateVoucherCardUnlockFeeService(cardId, {
      unlockFeeEnabled: Boolean(unlockFeeEnabled),
      unlockFeePercentage:
        typeof unlockFeePercentage === "number" ? unlockFeePercentage : null,
    });
    res.json({ success: true, data: card, message: "Card unlock fee config updated" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getRecentActivities = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const activities = await getRecentActivitiesService(limit);
    res.json({ success: true, data: activities });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCardEnrollmentRequests = async (req: Request, res: Response) => {
  try {
    const requests = await getCardEnrollmentRequestsService();
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getVoucherCardStats = async (req: Request, res: Response) => {
  try {
    const stats = await getVoucherCardStatsService();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyCardEnrollmentRequest = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const request = await prisma.cardEnrollmentRequest.findUnique({
      where: { restaurantId },
    });
    res.json({ success: true, data: request ?? null });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// LOAN SESSION ENDPOINTS
// ============================================

export const requestLoanSession = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { requestedAmount, purpose, repaymentDays, loanProviderType, fundingTraderId } = req.body;
    if (!requestedAmount) {
      return res.status(400).json({ success: false, message: "requestedAmount is required" });
    }
    const session = await requestLoanSessionService(restaurantId, {
      requestedAmount: parseFloat(requestedAmount),
      purpose,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : undefined,
      loanProviderType,
      fundingTraderId,
    });
    res.status(201).json({ success: true, data: session, message: "Loan request submitted" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const approveLoanSession = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id } = req.params;
    const { approvedAmount, approvalPercentage, repaymentDays, notes, fundingTraderId, requireUnlockFee, unlockFeePercentage } = req.body;
    if (!approvedAmount && !approvalPercentage) {
      return res.status(400).json({ success: false, message: "approvalPercentage (or approvedAmount) and repaymentDays are required" });
    }
    if (!repaymentDays) {
      return res.status(400).json({ success: false, message: "repaymentDays is required" });
    }
    const session = await approveLoanSessionService(id, adminId, {
      approvedAmount: approvedAmount !== undefined ? parseFloat(approvedAmount) : undefined,
      approvalPercentage: approvalPercentage !== undefined ? parseFloat(approvalPercentage) : undefined,
      repaymentDays: parseInt(repaymentDays),
      notes,
      fundingTraderId,
      requireUnlockFee: typeof requireUnlockFee === "boolean" ? requireUnlockFee : undefined,
      unlockFeePercentage:
        unlockFeePercentage !== undefined && unlockFeePercentage !== ""
          ? parseFloat(unlockFeePercentage)
          : undefined,
    });
    res.json({
      success: true,
      data: session,
      message: session.unlockStatus === "LOCKED"
        ? "Loan approved — restaurant must pay unlock fee to activate"
        : "Loan approved — now active",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const rejectLoanSession = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id } = req.params;
    const { reason } = req.body;
    const session = await rejectLoanSessionService(id, adminId, reason || "Rejected by admin");
    res.json({ success: true, data: session, message: "Loan session rejected" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Admin accepts a loan: makes it visible to the selected trader so they can approve.
export const acceptLoanSession = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id } = req.params;
    const { fundingTraderId } = req.body;
    const session = await acceptLoanSessionService(id, adminId, fundingTraderId);
    res.json({
      success: true,
      data: session,
      message: fundingTraderId
        ? "Loan accepted and sent to the selected trader for approval"
        : "Loan accepted — trader can now approve it",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Traders a restaurant can pick as loan provider
export const getLoanTraders = async (req: Request, res: Response) => {
  try {
    const traders = await getLoanTradersService();
    res.json({ success: true, data: traders });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// T&C payload for a provider + whether the restaurant accepted them yet
export const getLoanTerms = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { providerType, fundingTraderId, loanProviderId } = req.query;
    if (!providerType) {
      return res.status(400).json({ success: false, message: "providerType is required" });
    }
    const result = await getLoanTermsService(restaurantId, {
      providerType: providerType as "TRADER" | "FOOD_BUNDLES",
      fundingTraderId: fundingTraderId as string | undefined,
      loanProviderId: loanProviderId as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Record first-time T&C acceptance
export const acceptLoanTerms = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { providerType, providerId, providerName } = req.body;
    if (!providerType || !providerId || !providerName) {
      return res.status(400).json({ success: false, message: "providerType, providerId and providerName are required" });
    }
    await acceptLoanTermsService(restaurantId, { providerType, providerId, providerName });
    res.json({ success: true, message: "Terms and conditions accepted" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Trader inbox: loan sessions the trader was picked as provider for
export const getTraderLoanSessions = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user?.id;
    const sessions = await getTraderLoanSessionsService(traderId);
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Trader approves a loan session they were selected as provider for
export const traderApproveLoanSession = async (req: Request, res: Response) => {
  try {
    const traderId = (req as any).user?.id;
    const { id } = req.params;
    const { approvalPercentage, approvedAmount, repaymentDays, notes } = req.body;
    if (approvalPercentage === undefined && approvedAmount === undefined) {
      return res.status(400).json({ success: false, message: "approvalPercentage or approvedAmount is required" });
    }
    const session = await traderApproveLoanSessionService(traderId, id, {
      approvalPercentage: approvalPercentage !== undefined ? parseFloat(approvalPercentage) : undefined,
      approvedAmount: approvedAmount !== undefined ? parseFloat(approvedAmount) : undefined,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : undefined,
      notes,
    });
    res.json({
      success: true,
      data: session,
      message: session.unlockStatus === "LOCKED"
        ? "Loan approved — restaurant must pay unlock fee to activate"
        : "Loan approved — now active",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Admin approves a loan session on behalf of a delegation trader
export const adminApproveLoanSessionOnBehalf = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { id } = req.params;
    const traderId = (req as any).params.traderId;
    const { approvalPercentage, approvedAmount, repaymentDays, notes } = req.body;
    if (!traderId) {
      return res.status(400).json({ success: false, message: "traderId is required" });
    }
    if (approvalPercentage === undefined && approvedAmount === undefined) {
      return res.status(400).json({ success: false, message: "approvalPercentage or approvedAmount is required" });
    }
    const session = await adminApproveLoanSessionOnBehalfService(adminId, traderId, id, {
      approvalPercentage: approvalPercentage !== undefined ? parseFloat(approvalPercentage) : undefined,
      approvedAmount: approvedAmount !== undefined ? parseFloat(approvedAmount) : undefined,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : undefined,
      notes,
    });
    res.json({
      success: true,
      data: session,
      message: `Loan approved on behalf of trader`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const payUnlockFee = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { id } = req.params;
    const { paymentMethod, paymentReference, phoneNumber } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: "paymentMethod is required" });
    }
    const result = await payUnlockFeeService(id, restaurantId, {
      paymentMethod,
      paymentReference,
      phoneNumber,
    });
    res.json({ success: true, data: result, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const verifyUnlockFeePayment = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { id } = req.params;
    const result = await verifyUnlockFeePaymentService(id, restaurantId);
    res.json({ success: true, data: result, message: "Payment status checked" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyLoanSessions = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const sessions = await getMyLoanSessionsService(restaurantId);
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllLoanSessions = async (req: Request, res: Response) => {
  try {
    const { status, restaurantId, search, page, limit } = req.query;
    const result = await getAllLoanSessionsService({
      status: status as LoanSessionStatus | undefined,
      restaurantId: restaurantId as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getLoanSessionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await getLoanSessionByIdService(id);
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
};
