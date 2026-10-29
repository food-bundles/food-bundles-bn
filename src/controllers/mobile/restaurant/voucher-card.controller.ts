import { Request, Response } from "express";
import {
  mobileGetMyVoucherCard,
  mobileSubmitKycConsent,
  mobileRequestVoucherCard,
  mobileGetLoanTerms,
  mobileAcceptLoanTerms,
  mobileGetMyLoanSessions,
  mobileRequestLoanSession,
  mobilePayUnlockFee,
} from "../../../services/mobile/restaurant/voucher-card.service";

// GET /mobile/restaurant/voucher-card
export const getMyVoucherCardController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const card = await mobileGetMyVoucherCard(restaurantId);
    res.status(200).json({ message: "Voucher card retrieved", data: card });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get voucher card" });
  }
};

// POST /mobile/restaurant/voucher-card/kyc
export const submitKycController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const {
      restaurantName, tinNumber, phoneNumber, businessAddress,
      district, sector, ownerName, ownerNationalId, businessType,
      yearsInOperation, consentVubaBuba, consentKayko, consentRRA,
    } = req.body;

    if (!ownerName || !ownerNationalId || !businessType || !yearsInOperation) {
      return res.status(400).json({ message: "ownerName, ownerNationalId, businessType and yearsInOperation are required" });
    }

    const consent = await mobileSubmitKycConsent(restaurantId, {
      restaurantName: restaurantName || "",
      tinNumber: tinNumber || "",
      phoneNumber: phoneNumber || "",
      businessAddress: businessAddress || "",
      district: district || "",
      sector: sector || null,
      ownerName,
      ownerNationalId,
      businessType,
      yearsInOperation: Number(yearsInOperation),
      consentVubaBuba: !!consentVubaBuba,
      consentKayko: !!consentKayko,
      consentRRA: !!consentRRA,
    });
    res.status(201).json({ message: "KYC consent submitted", data: consent });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to submit KYC" });
  }
};

// POST /mobile/restaurant/voucher-card/request
export const requestVoucherCardController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const result = await mobileRequestVoucherCard(restaurantId);
    res.status(201).json({ message: "Voucher card enrollment request submitted", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to request voucher card" });
  }
};

// GET /mobile/restaurant/voucher-card/loan-terms
export const getLoanTermsController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { providerType, fundingTraderId, loanProviderId } = req.query;
    const terms = await mobileGetLoanTerms(restaurantId, {
      providerType: ((providerType as string) || "FOOD_BUNDLES") as "TRADER" | "FOOD_BUNDLES",
      fundingTraderId: fundingTraderId as string | undefined,
      loanProviderId: loanProviderId as string | undefined,
    });
    res.status(200).json({ message: "Loan terms retrieved", data: terms });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get loan terms" });
  }
};

// POST /mobile/restaurant/voucher-card/loan-terms/accept
export const acceptLoanTermsController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { providerType, providerId, providerName } = req.body;
    if (!providerType || !providerId || !providerName) {
      return res.status(400).json({ message: "providerType, providerId and providerName are required" });
    }
    const result = await mobileAcceptLoanTerms(restaurantId, { providerType, providerId, providerName });
    res.status(200).json({ message: "Loan terms accepted", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to accept loan terms" });
  }
};

// GET /mobile/restaurant/voucher-card/loan-sessions
export const getLoanSessionsController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const sessions = await mobileGetMyLoanSessions(restaurantId);
    res.status(200).json({ message: "Loan sessions retrieved", data: sessions });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get loan sessions" });
  }
};

// POST /mobile/restaurant/voucher-card/loan-sessions
export const requestLoanSessionController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { requestedAmount, repaymentDays, purpose, loanProviderType, fundingTraderId } = req.body;
    if (!requestedAmount || requestedAmount <= 0) {
      return res.status(400).json({ message: "requestedAmount is required and must be > 0" });
    }
    const session = await mobileRequestLoanSession(restaurantId, {
      requestedAmount: Number(requestedAmount),
      repaymentDays: Number(repaymentDays) || 30,
      purpose: purpose || null,
      loanProviderType: loanProviderType || "FOOD_BUNDLES",
      fundingTraderId: fundingTraderId || null,
    });
    res.status(201).json({ message: "Loan session requested", data: session });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to request loan session" });
  }
};

// POST /mobile/restaurant/voucher-card/loan-sessions/:id/unlock-fee
export const initiateUnlockFeeController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { id: loanSessionId } = req.params;
    const { paymentMethod = "mobile_money", paymentReference, phoneNumber } = req.body;
    const result = await mobilePayUnlockFee(loanSessionId, restaurantId, {
      paymentMethod,
      paymentReference,
      phoneNumber,
    });
    res.status(200).json({ message: "Unlock fee payment initiated", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to initiate unlock fee" });
  }
};
