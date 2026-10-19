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
  checkTraderLoanCapacityService,
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
  getRecentActivitiesService,
  convertLoanSessionToWalletService,
  repayLoanSessionService,
  verifyLoanRepaymentService,
  submitKycConsentService,
  approveKycConsentService,
  rejectKycConsentService,
  getAllKycConsentsService,
} from "../services/voucher-card.service";
import { CardStatus, LoanSessionStatus } from "@prisma/client";
import { OTPService } from "../services/otp.service";

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

export const submitKycConsent = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const {
      restaurantName, tinNumber, phoneNumber, businessAddress,
      district, sector, ownerName, ownerNationalId, businessType,
      yearsInOperation, consentVubaBuba, consentKayko, consentRRA,
    } = req.body;

    if (!restaurantName || !tinNumber || !phoneNumber || !businessAddress ||
        !district || !ownerName || !ownerNationalId || !businessType || yearsInOperation === undefined) {
      return res.status(400).json({ success: false, message: "All required fields must be provided" });
    }
    if (!consentVubaBuba && !consentKayko && !consentRRA) {
      return res.status(400).json({ success: false, message: "At least one data-sharing consent must be granted" });
    }

    const consent = await submitKycConsentService(restaurantId, {
      restaurantName, tinNumber, phoneNumber, businessAddress,
      district, sector: sector || null, ownerName, ownerNationalId,
      businessType, yearsInOperation: parseInt(yearsInOperation),
      consentVubaBuba: Boolean(consentVubaBuba),
      consentKayko: Boolean(consentKayko),
      consentRRA: Boolean(consentRRA),
    });

    res.status(201).json({ success: true, data: consent, message: "KYC consent submitted successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyKycConsent = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const consent = await prisma.kycConsent.findUnique({ where: { restaurantId } });
    res.json({ success: true, data: consent ?? null });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllKycConsents = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const consents = await getAllKycConsentsService(
      status as "PENDING" | "APPROVED" | "REJECTED" | undefined,
    );
    res.json({ success: true, data: consents });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const approveKycConsent = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { restaurantId } = req.params;
    const { notes } = req.body;
    const consent = await approveKycConsentService(restaurantId, adminId, notes);
    res.json({ success: true, data: consent, message: "KYC consent approved" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const rejectKycConsent = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    const { restaurantId } = req.params;
    const { notes } = req.body;
    const consent = await rejectKycConsentService(restaurantId, adminId, notes);
    res.json({ success: true, data: consent, message: "KYC consent rejected" });
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
    const { fundingTraderId, approvalPercentage, approvedAmount, repaymentDays } = req.body;
    const session = await acceptLoanSessionService(id, adminId, fundingTraderId, {
      approvalPercentage:
        approvalPercentage !== undefined ? parseFloat(approvalPercentage) : undefined,
      approvedAmount:
        approvedAmount !== undefined ? parseFloat(approvedAmount) : undefined,
      repaymentDays: repaymentDays ? parseInt(repaymentDays) : undefined,
    });
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

// Live check whether a trader can fund a requested loan amount (admin).
export const checkTraderLoanCapacity = async (req: Request, res: Response) => {
  try {
    const { traderId } = req.params;
    if (!traderId) {
      return res.status(400).json({ success: false, message: "traderId is required" });
    }
    const amount = req.query.amount
      ? parseFloat(req.query.amount as string)
      : undefined;
    const result = await checkTraderLoanCapacityService(traderId, amount);
    res.json({ success: true, data: result });
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

export const convertLoanSessionToWallet = async (
  req: Request,
  res: Response,
) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { rrn } = req.params;
    if (!rrn) {
      return res
        .status(400)
        .json({ success: false, message: "Loan session RRN is required" });
    }
    const result = await convertLoanSessionToWalletService(rrn, restaurantId);
    res.json({
      success: true,
      data: result,
      message: `${result.convertedAmount.toLocaleString()} RWF added to your prepaid wallet. Voucher used.`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const repayLoanSession = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { sessionId } = req.params;
    const { paymentMethod, paymentReference, phoneNumber, amount } = req.body ?? {};
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "Session id is required" });
    }
    if (!paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "paymentMethod is required" });
    }
    const result = await repayLoanSessionService(sessionId, restaurantId, {
      paymentMethod,
      paymentReference,
      phoneNumber,
      amount: amount ? parseFloat(amount) : undefined,
    });
    res.json({ success: true, data: result, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const verifyLoanRepayment = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user?.id;
    const { sessionId } = req.params;
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, message: "Session id is required" });
    }
    const result = await verifyLoanRepaymentService(sessionId, restaurantId);
    res.json({ success: true, data: result, message: "Payment status checked" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// ADMIN: PAY A VOUCHER ON BEHALF OF A RESTAURANT
// ============================================

const REPAYABLE_STATUSES: LoanSessionStatus[] = [
  LoanSessionStatus.ACTIVE,
  LoanSessionStatus.PARTIALLY_USED,
  LoanSessionStatus.FULLY_USED,
  LoanSessionStatus.OVERDUE,
];

// Load a session an admin wants to repay and work out the amount (never more than owed)
const loadRepayableSession = async (sessionId: string, rawAmount?: unknown) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      rrn: true,
      restaurantId: true,
      status: true,
      outstandingAmount: true,
    },
  });
  if (!session) throw new Error("Loan session not found");
  if (!REPAYABLE_STATUSES.includes(session.status)) {
    throw new Error(`This voucher cannot be repaid (status: ${session.status})`);
  }
  if (session.outstandingAmount <= 0) {
    throw new Error("This voucher has no outstanding balance to pay");
  }
  const requested = Number(rawAmount);
  const amount =
    requested > 0 ? Math.min(requested, session.outstandingAmount) : session.outstandingAmount;
  return { session, amount };
};

/**
 * Send the restaurant an OTP before its prepaid wallet is used to repay a voucher
 * POST /vouchers/sessions/:sessionId/admin-repay/request-otp   { amount? }
 */
export const requestAdminRepayOTP = async (req: Request, res: Response) => {
  try {
    const { session, amount } = await loadRepayableSession(
      req.params.sessionId as string,
      req.body?.amount,
    );

    // Check the wallet first so the restaurant is not texted for a payment that would fail
    const wallet = await prisma.wallet.findUnique({
      where: { restaurantId: session.restaurantId },
      select: { balance: true, isActive: true, currency: true },
    });
    if (!wallet || !wallet.isActive) {
      throw new Error("Restaurant has no active prepaid wallet");
    }
    if (wallet.balance < amount) {
      throw new Error(
        `Insufficient wallet balance. Available: ${wallet.balance.toLocaleString()} ${wallet.currency}, Required: ${amount.toLocaleString()} RWF`,
      );
    }

    const otpResult = await OTPService.sendVoucherRepaymentOTPToRestaurant(
      session.restaurantId,
      amount,
      session.rrn,
    );
    if (!otpResult.success) throw new Error(otpResult.message);

    res.json({
      success: true,
      message: "OTP sent to the restaurant's phone number",
      data: {
        // Mask all but the last 3 digits so the admin knows which phone received it
        phone: otpResult.phone?.replace(/.(?=.{3})/g, "*"),
        amount,
        walletBalance: wallet.balance,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Pay a voucher on behalf of the restaurant
 * POST /vouchers/sessions/:sessionId/admin-repay
 *   { paymentMethod: "MOBILE_MONEY", phoneNumber, amount? }  → USSD push to that phone
 *   { paymentMethod: "CASH", otp, amount? }                  → restaurant prepaid wallet
 */
export const adminRepayLoanSession = async (req: Request, res: Response) => {
  try {
    const { paymentMethod, phoneNumber, otp } = req.body ?? {};
    const method = String(paymentMethod || "").toUpperCase();
    if (!["MOBILE_MONEY", "CASH"].includes(method)) {
      throw new Error("Payment method must be MOBILE_MONEY or CASH (prepaid wallet)");
    }

    const { session, amount } = await loadRepayableSession(
      req.params.sessionId as string,
      req.body?.amount,
    );

    if (method === "MOBILE_MONEY" && !phoneNumber) {
      throw new Error("Phone number is required for mobile money");
    }

    // The restaurant must confirm wallet payments with the OTP it received
    if (method === "CASH") {
      if (!otp) throw new Error("OTP from the restaurant is required to use its prepaid wallet");
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: session.restaurantId },
        select: { phone: true },
      });
      if (!restaurant?.phone) throw new Error("Restaurant phone number not found");
      const otpResult = await OTPService.verifyOTP(restaurant.phone, String(otp), "VOUCHER_CHECKOUT");
      if (!otpResult.success) throw new Error(otpResult.message);
    }

    const result = await repayLoanSessionService(session.id, session.restaurantId, {
      paymentMethod: method,
      phoneNumber,
      amount,
    });
    res.json({ success: true, data: result, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Check a pending mobile money repayment started by an admin
 * GET /vouchers/sessions/:sessionId/admin-repay/verify
 */
export const adminVerifyLoanRepayment = async (req: Request, res: Response) => {
  try {
    const session = await prisma.loanSession.findUnique({
      where: { id: req.params.sessionId as string },
      select: { id: true, restaurantId: true },
    });
    if (!session) throw new Error("Loan session not found");
    const result = await verifyLoanRepaymentService(session.id, session.restaurantId);
    res.json({ success: true, data: result, message: "Payment status checked" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
