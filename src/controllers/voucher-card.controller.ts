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
  payUnlockFeeService,
  getMyLoanSessionsService,
  getAllLoanSessionsService,
  getLoanSessionByIdService,
  getCardEnrollmentRequestsService,
  getVoucherCardStatsService,
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
    const { requestedAmount, purpose, repaymentDays } = req.body;
    if (!requestedAmount) {
      return res.status(400).json({ success: false, message: "requestedAmount is required" });
    }
    const session = await requestLoanSessionService(restaurantId, {
      requestedAmount: parseFloat(requestedAmount),
      purpose,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : undefined,
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
    const { approvedAmount, approvalPercentage, repaymentDays, notes, fundingTraderId } = req.body;
    if (!approvedAmount || !repaymentDays) {
      return res.status(400).json({ success: false, message: "approvedAmount and repaymentDays are required" });
    }
    const session = await approveLoanSessionService(id, adminId, {
      approvedAmount: parseFloat(approvedAmount),
      approvalPercentage: approvalPercentage ? parseFloat(approvalPercentage) : undefined,
      repaymentDays: parseInt(repaymentDays),
      notes,
      fundingTraderId,
    });
    res.json({ success: true, data: session, message: "Loan approved — restaurant must pay unlock fee" });
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
    res.json({ success: true, data: result, message: "Unlock fee paid — loan is now active" });
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
