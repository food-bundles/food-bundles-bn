import prisma from "../prisma";
import { CardStatus, LoanSessionStatus, UnlockStatus, PaymentStatus, TransactionStatus, WalletTransactionType } from "@prisma/client";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import { wsManager } from "../index";
import { transferVoucherAmountToWalletService } from "./wallet-transfer.service";
import { cleanPhoneNumber, isValidRwandaPhone } from "../utils/emailTemplates";
import axios from "axios";

// Payment clients — lazy initialized to ensure env vars are loaded
let _paypack: any = null;
let _flw: any = null;

function getPaypack() {
  if (!_paypack) {
    const PaypackJs = require("paypack-js").default;
    _paypack = PaypackJs.config({
      client_id: process.env.PAYPACK_APPLICATION_ID,
      client_secret: process.env.PAYPACK_APPLICATION_SECRET,
    });
  }
  return _paypack;
}

function getFlw() {
  if (!_flw) {
    const Flutterwave = require("flutterwave-node-v3");
    _flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
  }
  return _flw;
}

async function initiateFlutterwaveUnlockFeePayment(params: {
  txRef: string;
  amount: number;
  email: string;
  fullname: string;
  currency?: string;
  paymentOptions?: string;
  phoneNumber?: string;
}) {
  const {
    txRef,
    amount,
    email,
    fullname,
    currency = "RWF",
    paymentOptions = "card",
    phoneNumber,
  } = params;

  const payload: any = {
    tx_ref: txRef,
    amount: amount.toString(),
    currency,
    redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/restaurant/vouchers`,
    customer: { email, name: fullname, phone_number: phoneNumber },
    customizations: {
      title: "Voucher Loan Unlock - Food Bundles",
      description: `Voucher loan unlock fee for ${fullname}`,
      logo: `https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png`,
    },
    payment_options: paymentOptions,
    meta: {
      transaction_type: "VOUCHER_UNLOCK_FEE",
      unlock_fee_ref: txRef,
    },
  };

  const response = await axios.post(
    "https://api.flutterwave.com/v3/payments",
    payload,
    {
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (response.data?.status === "success" && response.data?.data?.link) {
    return {
      success: true,
      status: "pending",
      message: "Redirect to complete unlock fee payment",
      redirectUrl: response.data.data.link,
      requiresRedirect: true,
      authorizationDetails: {
        mode: paymentOptions === "card" ? "card" : "mobile_money",
        redirectUrl: response.data.data.link,
      },
    };
  }
  throw new Error("Flutterwave payment link generation failed");
}

// ============================================
// PAN GENERATION (placeholder — replace with real USSD/ISO 7812 API)
// ============================================

/**
 * Generate a unique 16-digit PAN using Luhn algorithm.
 * Format: XXXXXXXXXXXXXXXX (16 digits)
 * IIN is read from VOUCHER_IIN env var (placeholder until RSB/ISO 7812 registration).
 * Replace this function body with the real RSB API call when card numbers are issued.
 */
function generateLuhnPan(): string {
  const IIN = process.env.VOUCHER_IIN ?? "123456"; // TODO: replace with registered IIN from RSB/ISO 7812 once received
  // 7-digit restaurant identifier (random for now)
  const accountId = Math.floor(1000000 + Math.random() * 9000000).toString();
  const partial = IIN + accountId; // 13 digits

  // Luhn check digit
  const digits = partial.split("").map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - i) % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

async function generateUniquePan(): Promise<string> {
  const pan = generateLuhnPan();
  const existing = await prisma.voucherCard.findUnique({ where: { pan } });
  if (existing) return generateUniquePan();
  return pan;
}

/**
 * Generate a unique RRN (Retrieval Reference Number) for a loan session.
 */
function generateRrn(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RRN-${ts}-${rand}`;
}

async function generateUniqueRrn(): Promise<string> {
  const rrn = generateRrn();
  const existing = await prisma.loanSession.findUnique({ where: { rrn } });
  if (existing) return generateUniqueRrn();
  return rrn;
}

/**
 * Generate a unique STAN (System Trace Audit Number) for a purchase authorization.
 */
function generateStan(): string {
  return `STAN-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ============================================
// CARD ENROLLMENT
// ============================================

/**
 * Restaurant requests a voucher card (enrollment request).
 */
export const requestVoucherCardService = async (restaurantId: string) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) throw new Error("Restaurant not found");

  // Check if already has a card
  const existing = await prisma.voucherCard.findUnique({
    where: { restaurantId },
  });
  if (existing) throw new Error("Restaurant already has a voucher card");

  // Check if already has a pending request
  const pendingRequest = await prisma.cardEnrollmentRequest.findUnique({
    where: { restaurantId },
  });
  if (pendingRequest) {
    if (pendingRequest.status === "PENDING") {
      throw new Error("Card enrollment request already pending review");
    }
    if (pendingRequest.status === "APPROVED") {
      throw new Error("Card enrollment already approved");
    }
    // If rejected, allow re-request by updating
    return await prisma.cardEnrollmentRequest.update({
      where: { restaurantId },
      data: { status: "PENDING", requestedAt: new Date(), reviewedAt: null, reviewedBy: null, notes: null },
    });
  }

  const request = await prisma.cardEnrollmentRequest.create({
    data: { restaurantId },
  });

  await createNotificationService({
    title: "New Voucher Card Request",
    message: `${restaurant.name} has requested a voucher card. Please review and issue.`,
    eventType: "VOUCHER_APPLIED",
    targetType: "ROLE_BASED",
    targetRole: "ADMIN",
    metadata: { restaurantId, restaurantName: restaurant.name },
  });

  return request;
};

// ============================================
// CARD ISSUANCE (Admin)
// ============================================

/**
 * Admin issues a permanent PAN voucher card to a restaurant.
 */
export const issueVoucherCardService = async (
  restaurantId: string,
  adminId: string,
  loanLimit: number = 500000,
) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) throw new Error("Restaurant not found");

  const existing = await prisma.voucherCard.findUnique({
    where: { restaurantId },
  });
  if (existing) throw new Error("Restaurant already has a voucher card");

  const pan = await generateUniquePan();

  const card = await prisma.voucherCard.create({
    data: {
      pan,
      restaurantId,
      loanLimit,
      issuedBy: adminId,
      status: CardStatus.ACTIVE,
    },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
      issuer: { select: { id: true, username: true } },
    },
  });

  // Mark enrollment request as approved if exists
  await prisma.cardEnrollmentRequest.updateMany({
    where: { restaurantId, status: "PENDING" },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: adminId },
  });

  await createNotificationService({
    title: "Voucher Card Issued",
    message: `Your voucher card has been issued. Card number: ${pan}`,
    eventType: "VOUCHER_ISSUED",
    targetType: "SPECIFIC_USER",
    targetId: restaurantId,
    metadata: { cardId: card.id, pan },
  });

  try {
    if (restaurant.phone) {
      await sendMessage(
        `Dear ${restaurant.name}, your Food Bundles voucher card has been issued. Card: ${pan}. Keep it safe.`,
        restaurant.phone,
      );
    }
  } catch (e) {
    console.error("SMS failed:", e);
  }

  return card;
};

// ============================================
// CARD QUERIES
// ============================================

export const getMyVoucherCardService = async (restaurantId: string) => {
  const card = await prisma.voucherCard.findUnique({
    where: { restaurantId },
    include: {
      restaurant: { select: { id: true, name: true } },
      loanSessions: {
        where: {
          status: {
            notIn: [LoanSessionStatus.CLOSED, LoanSessionStatus.SETTLED, LoanSessionStatus.REJECTED],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!card) return null;

  // Compute derived fields
  const allSessions = await prisma.loanSession.findMany({
    where: { restaurantId },
  });

  const totalOutstandingLoans = allSessions
    .filter((s) => s.status !== LoanSessionStatus.SETTLED && s.status !== LoanSessionStatus.CLOSED)
    .reduce((sum, s) => sum + s.outstandingAmount, 0);

  const qualifyingOrders = await prisma.order.count({
    where: {
      restaurantId,
      status: "DELIVERED",
      paymentStatus: "COMPLETED",
    },
  });

  const totalLoansReceived = allSessions.filter(
    (s) => s.status !== LoanSessionStatus.REQUESTED && s.status !== LoanSessionStatus.REJECTED,
  ).length;

  // Eligibility: no overdue sessions + qualifying orders >= configured minimum
  const hasOverdue = allSessions.some(
    (s) => s.status === LoanSessionStatus.OVERDUE,
  );
  const MIN_ORDERS = parseInt(process.env.VOUCHER_MIN_QUALIFYING_ORDERS ?? "5");
  const isEligible = !hasOverdue && qualifyingOrders >= MIN_ORDERS && card.status === CardStatus.ACTIVE;
  const eligibilityReason = hasOverdue
    ? "Has overdue loan — settle before requesting new loan"
    : qualifyingOrders < MIN_ORDERS
    ? `Need ${MIN_ORDERS - qualifyingOrders} more qualifying orders`
    : undefined;

  return {
    ...card,
    totalOutstandingLoans,
    qualifyingOrders,
    totalLoansReceived,
    isEligible,
    eligibilityReason,
    activeLoanSession: card.loanSessions[0] ?? null,
  };
};

export const getAllVoucherCardsService = async (filters?: {
  status?: CardStatus;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, search, page = 1, limit = 20 } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.restaurant = { name: { contains: search, mode: "insensitive" } };
  }

  const [cards, total] = await Promise.all([
    prisma.voucherCard.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true, email: true, phone: true } },
        issuer: { select: { id: true, username: true } },
        loanSessions: {
          where: { status: { notIn: [LoanSessionStatus.CLOSED, LoanSessionStatus.SETTLED] } },
          select: { outstandingAmount: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.voucherCard.count({ where }),
  ]);

  const enriched = cards.map((card) => {
    const totalOutstandingLoans = card.loanSessions.reduce(
      (sum, s) => sum + s.outstandingAmount,
      0,
    );
    return { ...card, totalOutstandingLoans };
  });

  return {
    data: enriched,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

export const getVoucherCardByPanService = async (pan: string) => {
  const card = await prisma.voucherCard.findUnique({
    where: { pan },
    include: {
      restaurant: { select: { id: true, name: true, email: true } },
      loanSessions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!card) throw new Error("Card not found");
  return card;
};

// ============================================
// CARD UNLOCK FEE CONFIG (Admin)
// ============================================

export const updateVoucherCardUnlockFeeService = async (
  cardId: string,
  data: { unlockFeeEnabled: boolean; unlockFeePercentage?: number | null },
) => {
  const card = await prisma.voucherCard.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("Card not found");

  return prisma.voucherCard.update({
    where: { id: cardId },
    data: {
      unlockFeeEnabled: data.unlockFeeEnabled,
      unlockFeePercentage:
        data.unlockFeeEnabled && data.unlockFeePercentage && data.unlockFeePercentage > 0
          ? data.unlockFeePercentage
          : null,
    },
    include: {
      restaurant: { select: { id: true, name: true, email: true } },
    },
  });
};

// ============================================
// RECENT ACTIVITIES FEED (Admin)
// ============================================

export const getRecentActivitiesService = async (limit = 10) => {
  const [cardRequests, loanSessions] = await Promise.all([
    prisma.cardEnrollmentRequest.findMany({
      where: { status: "PENDING" },
      include: { restaurant: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { requestedAt: "desc" },
      take: limit,
    }),
    prisma.loanSession.findMany({
      where: { status: LoanSessionStatus.REQUESTED },
      include: { restaurant: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { requestedAt: "desc" },
      take: limit,
    }),
  ]);

  const loanActivities = await Promise.all(
    loanSessions.map(async (s) => {
      const cfg = await resolveUnlockFeeConfig(s.cardId, s.restaurantId);
      return { ...s, effectiveUnlockFeeEnabled: cfg.enabled, effectiveUnlockFeePercentage: cfg.percentage };
    }),
  );

  const activities = [
    ...cardRequests.map((r) => ({
      id: `card_${r.id}`,
      type: "VOUCHER_CARD_APPLICATION" as const,
      targetId: r.id,
      restaurantId: r.restaurantId,
      restaurantName: r.restaurant?.name ?? "Unknown restaurant",
      restaurantEmail: r.restaurant?.email ?? null,
      restaurantPhone: r.restaurant?.phone ?? null,
      amount: null,
      message: "Applied for a voucher card",
      createdAt: r.requestedAt,
    })),
    ...loanActivities.map((s) => ({
      id: `loan_${s.id}`,
      type: "LOAN_REQUEST" as const,
      targetId: s.id,
      restaurantId: s.restaurantId,
      restaurantName: s.restaurant?.name ?? "Unknown restaurant",
      restaurantEmail: s.restaurant?.email ?? null,
      restaurantPhone: s.restaurant?.phone ?? null,
      amount: s.requestedAmount,
      purpose: s.purpose,
      repaymentDays: s.repaymentDays,
      rrn: s.rrn,
      effectiveUnlockFeeEnabled: s.effectiveUnlockFeeEnabled,
      effectiveUnlockFeePercentage: s.effectiveUnlockFeePercentage,
      message: "Requested a loan",
      createdAt: s.requestedAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return activities;
};

// ============================================
// LOAN SESSION — REQUEST
// ============================================

export const requestLoanSessionService = async (
  restaurantId: string,
  data: {
    requestedAmount: number;
    purpose?: string;
    repaymentDays?: number;
    loanProviderType?: "TRADER" | "FOOD_BUNDLES";
    fundingTraderId?: string;
  },
) => {
  const { requestedAmount, purpose, repaymentDays, loanProviderType, fundingTraderId } = data;

  if (requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");

  const card = await prisma.voucherCard.findUnique({ where: { restaurantId } });
  if (!card) throw new Error("No voucher card found. Request a card first.");
  if (card.status !== CardStatus.ACTIVE) throw new Error(`Card is ${card.status}`);

  // Resolve the loan provider chosen by the restaurant (TRADER | FOOD_BUNDLES)
  let providerType = loanProviderType;
  let providerId: string | null = null;
  let providerName = "";

  if (providerType === "TRADER") {
    if (!fundingTraderId) {
      throw new Error("Select a trader as your loan provider");
    }
    const trader = await prisma.admin.findUnique({ where: { id: fundingTraderId } });
    if (!trader || trader.role !== "TRADER") {
      throw new Error("Selected trader does not exist");
    }
    providerId = fundingTraderId;
    providerName = trader.username;
  } else if (providerType === "FOOD_BUNDLES" || !providerType) {
    providerType = "FOOD_BUNDLES";
    providerId = "food-bundles";
    providerName = "Food Bundles";
  } else {
    throw new Error("Invalid loan provider type");
  }

  // Terms & conditions must be accepted before a loan can be requested (first time per provider).
  const termsAccepted = await prisma.loanTermsAcceptance.findFirst({
    where: { restaurantId, providerType, providerId },
  });
  if (!termsAccepted) {
    throw new Error(
      `Please accept the ${providerName} terms and conditions before requesting a loan`,
    );
  }

  // Block if overdue session exists
  const overdueSession = await prisma.loanSession.findFirst({
    where: { restaurantId, status: LoanSessionStatus.OVERDUE },
  });
  if (overdueSession) {
    throw new Error("You have an overdue loan. Settle it before requesting a new loan.");
  }

  // Check exposure limit
  const activeSessions = await prisma.loanSession.findMany({
    where: {
      restaurantId,
      status: { notIn: [LoanSessionStatus.CLOSED, LoanSessionStatus.SETTLED, LoanSessionStatus.REJECTED] },
    },
  });
  const currentExposure = activeSessions.reduce((sum, s) => sum + s.outstandingAmount, 0);
  if (currentExposure + requestedAmount > card.loanLimit) {
    throw new Error(
      `Request exceeds loan limit. Available: ${card.loanLimit - currentExposure} RWF`,
    );
  }

  const rrn = await generateUniqueRrn();

  const session = await prisma.loanSession.create({
    data: {
      rrn,
      cardId: card.id,
      restaurantId,
      requestedAmount,
      purpose,
      repaymentDays,
      loanProviderType: providerType,
      fundingTraderId: providerType === "TRADER" ? providerId : undefined,
      status: LoanSessionStatus.REQUESTED,
      unlockStatus: UnlockStatus.LOCKED,
    },
    include: {
      restaurant: { select: { id: true, name: true } },
    },
  });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });

  await createNotificationService({
    title: "New Loan Session Request",
    message: `${restaurant?.name} requested a loan of ${requestedAmount.toLocaleString()} RWF (RRN: ${rrn}) from ${providerName}`,
    eventType: "VOUCHER_APPLIED",
    targetType: "ROLE_BASED",
    targetRole: "ADMIN",
    metadata: { sessionId: session.id, rrn, requestedAmount, providerType, providerName },
  });

  try {
    await sendMessage(
      `New loan request: ${restaurant?.name} — ${requestedAmount.toLocaleString()} RWF via ${providerName}. RRN: ${rrn}`,
      process.env.PRIVATE_RECEIVER || "",
    );
  } catch (e) {
    console.error("SMS failed:", e);
  }

  return session;
};

// ============================================
// LOAN SESSION — APPROVE (Admin)
// ============================================

// ============================================
// UNLOCK FEE CONFIG — admin decides; no default
// ============================================

export const resolveUnlockFeeConfig = async (cardId: string, restaurantId: string) => {
  const card = await prisma.voucherCard.findUnique({ where: { id: cardId } });
  if (card?.unlockFeeEnabled && (card.unlockFeePercentage ?? 0) > 0) {
    return { enabled: true, percentage: card.unlockFeePercentage ?? 0 };
  }
  const subscription = await prisma.restaurantSubscription.findFirst({
    where: { restaurantId },
    include: { plan: { include: { loanProvider: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const provider = subscription?.plan?.loanProvider;
  if (provider?.unlockFeeEnabled && (provider.unlockFeePercentage ?? 0) > 0) {
    return { enabled: true, percentage: provider.unlockFeePercentage ?? 0 };
  }
  return { enabled: false, percentage: 0 };
};

export const approveLoanSessionService = async (
  sessionId: string,
  adminId: string,
  data: {
    approvedAmount?: number;
    approvalPercentage?: number;
    repaymentDays: number;
    notes?: string;
    fundingTraderId?: string;
    requireUnlockFee?: boolean;
    unlockFeePercentage?: number;
  },
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: { restaurant: true },
  });
  if (!session) throw new Error("Loan session not found");
  if (
    session.status !== LoanSessionStatus.REQUESTED &&
    session.status !== LoanSessionStatus.ACCEPTED
  ) {
    throw new Error(`Cannot approve session with status: ${session.status}`);
  }

  // The client's requested amount is never modified. The admin only sets a
  // percentage, granted to the client as credit, and the approved amount is
  // derived from the requested amount. Any shortfall between the requested and
  // approved amounts is paid by the client at checkout before using the voucher.
  const basePct = data.approvalPercentage ?? (data.approvedAmount && session.requestedAmount > 0 ? (data.approvedAmount / session.requestedAmount) * 100 : 100);
  const approvalPct = Math.max(0, Math.min(100, basePct));
  const approvedAmount = Math.round(session.requestedAmount * (approvalPct / 100));

  // Resolve the effective unlock fee config — admin-selected per restaurant (card) or per loan provider.
  // There is no default fee: if neither the card nor the provider has an unlock fee enabled, no fee applies.
  // Admin may override at approval time via requireUnlockFee (undefined → follow resolved config).
  // The unlock fee percentage is not static — the admin may override it at approval time too.
  const config = await resolveUnlockFeeConfig(session.cardId, session.restaurantId);
  const applyFee =
    data.requireUnlockFee !== undefined ? data.requireUnlockFee : config.enabled;
  const configuredPct =
    data.unlockFeePercentage && data.unlockFeePercentage > 0
      ? data.unlockFeePercentage
      : config.percentage;
  const unlockFeePct = applyFee && configuredPct > 0 ? configuredPct : 0;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + data.repaymentDays);

  const updated = await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      approvedAmount,
      approvalPercentage: approvalPct,
      unlockFeePercentage: unlockFeePct > 0 ? unlockFeePct : null,
      unlockFee: unlockFeePct > 0 ? approvedAmount * (unlockFeePct / 100) : null,
      repaymentDays: data.repaymentDays,
      dueDate,
      notes: data.notes,
      fundingTraderId: data.fundingTraderId,
      approvedBy: adminId,
      approvedAt: new Date(),
      status: unlockFeePct > 0 ? LoanSessionStatus.APPROVED_LOCKED : LoanSessionStatus.ACTIVE,
      unlockStatus: unlockFeePct > 0 ? UnlockStatus.LOCKED : UnlockStatus.UNLOCKED,
      unlockedAt: unlockFeePct > 0 ? null : new Date(),
      outstandingAmount: approvedAmount,
    },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
      approver: { select: { id: true, username: true } },
    },
  });

  await createNotificationService({
    title: unlockFeePct > 0 ? "Loan Approved — Unlock Fee Required" : "Loan Approved",
    message:
      unlockFeePct > 0
        ? `Your loan of ${approvedAmount.toLocaleString()} RWF has been approved. Pay unlock fee of ${(approvedAmount * (unlockFeePct / 100)).toLocaleString()} RWF to activate.`
        : `Your loan of ${approvedAmount.toLocaleString()} RWF has been approved and is now active.`,
    eventType: "VOUCHER_ISSUED",
    targetType: "SPECIFIC_USER",
    targetId: session.restaurantId,
    metadata: {
      sessionId,
      unlockFee: unlockFeePct > 0 ? approvedAmount * (unlockFeePct / 100) : null,
      approvedAmount,
    },
  });

  try {
    if (updated.restaurant.phone) {
      const smsFee = unlockFeePct > 0 ? approvedAmount * (unlockFeePct / 100) : 0;
      await sendMessage(
        smsFee > 0
          ? `Dear ${updated.restaurant.name}, your loan of ${approvedAmount.toLocaleString()} RWF is approved. Pay unlock fee of ${smsFee.toLocaleString()} RWF to activate. RRN: ${updated.rrn}`
          : `Dear ${updated.restaurant.name}, your loan of ${approvedAmount.toLocaleString()} RWF is approved and ACTIVE. RRN: ${updated.rrn}`,
        updated.restaurant.phone,
      );
    }
  } catch (e) {
    console.error("SMS failed:", e);
  }

  try {
    wsManager.broadcastLoanUpdate({
      loanId: updated.id,
      action: "APPROVED",
      timestamp: new Date().toISOString(),
      restaurantId: updated.restaurantId,
      data: { approvedAmount, status: updated.status },
    });
  } catch (e) {
    console.error("WS broadcast failed:", e);
  }

  return updated;
};

// ============================================
// LOAN SESSION — REJECT (Admin)
// ============================================

export const rejectLoanSessionService = async (
  sessionId: string,
  adminId: string,
  reason: string,
) => {
  const session = await prisma.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Loan session not found");
  if (session.status !== LoanSessionStatus.REQUESTED) {
    throw new Error(`Cannot reject session with status: ${session.status}`);
  }

  const updated = await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      status: LoanSessionStatus.REJECTED,
      notes: reason,
      approvedBy: adminId,
      approvedAt: new Date(),
    },
  });

  await createNotificationService({
    title: "Loan Request Rejected",
    message: `Your loan request (RRN: ${session.rrn}) was rejected. Reason: ${reason}`,
    eventType: "PAYMENT_FAILED",
    targetType: "SPECIFIC_USER",
    targetId: session.restaurantId,
    metadata: { sessionId, reason },
  });

  return updated;
};

// ============================================
// LOAN PROVIDER SELECTION + TERMS & CONDITIONS
// ============================================

// Traders the restaurant can pick as loan provider
export const getLoanTradersService = async () => {
  const traders = await prisma.admin.findMany({
    where: { role: "TRADER" },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      termsAndConditions: true,
      traderWallet: {
        select: {
          id: true,
          balance: true,
          pendingApprovedAmount: true,
          pendingWithdrawBalance: true,
          isActive: true,
          canTradeOnBehalf: true,
          delegationStatus: true,
        },
      },
    },
    orderBy: { username: "asc" },
  });

  return traders
    .filter((t) => t.traderWallet && t.traderWallet.isActive !== false)
    .map((t) => {
      const wallet = t.traderWallet;
      const availableBalance = wallet
        ? wallet.balance - wallet.pendingApprovedAmount - wallet.pendingWithdrawBalance
        : 0;
      return {
        id: t.id,
        name: t.username,
        email: t.email,
        phone: t.phone,
        termsAndConditions: t.termsAndConditions,
        availableBalance,
        canTradeOnBehalf: wallet?.canTradeOnBehalf ?? false,
        delegationStatus: wallet?.delegationStatus ?? "NORMAL",
      };
    });
};

// Resolve a restaurant's Food Bundles loan provider (optional — may not exist)
const resolveFoodBundlesProvider = async (restaurantId: string) => {
  const subscription = await prisma.restaurantSubscription.findFirst({
    where: { restaurantId },
    include: { plan: { include: { loanProvider: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const provider = subscription?.plan?.loanProvider;
  if (provider && provider.isActive) return provider;

  const fallback = await prisma.loanProvider.findFirst({
    where: { name: { contains: "food", mode: "insensitive" }, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (fallback) return fallback;

  return null;
};

// T&C payload for a provider (TRADER or FOOD_BUNDLES) + whether the restaurant already accepted them
export const getLoanTermsService = async (
  restaurantId: string,
  options: { providerType: "TRADER" | "FOOD_BUNDLES"; fundingTraderId?: string; loanProviderId?: string },
) => {
  let providerId = "";
  let providerName = "";
  let terms = "";

  if (options.providerType === "TRADER") {
    if (!options.fundingTraderId) throw new Error("fundingTraderId is required for a trader provider");
    const trader = await prisma.admin.findUnique({ where: { id: options.fundingTraderId } });
    if (!trader || trader.role !== "TRADER") throw new Error("Selected trader does not exist");
    providerId = trader.id;
    providerName = trader.username;
    terms = trader.termsAndConditions || "";
  } else {
    const provider = options.loanProviderId
      ? await prisma.loanProvider.findUnique({ where: { id: options.loanProviderId } })
      : await resolveFoodBundlesProvider(restaurantId);
    providerId = provider?.id ?? "food-bundles";
    providerName = provider?.name ?? "Food Bundles";
    terms = provider?.termsAndConditions || "";
  }

  const accepted = await prisma.loanTermsAcceptance.findFirst({
    where: { restaurantId, providerType: options.providerType, providerId },
  });

  return {
    providerType: options.providerType,
    providerId,
    providerName,
    terms,
    accepted: !!accepted,
  };
};

// Record first-time T&C acceptance
export const acceptLoanTermsService = async (
  restaurantId: string,
  data: { providerType: "TRADER" | "FOOD_BUNDLES"; providerId: string; providerName: string },
) => {
  if (!data.providerType || !data.providerId || !data.providerName) {
    throw new Error("providerType, providerId and providerName are required");
  }
  return prisma.loanTermsAcceptance.upsert({
    where: {
      restaurantId_providerType_providerId: {
        restaurantId,
        providerType: data.providerType,
        providerId: data.providerId,
      },
    },
    update: {},
    create: {
      restaurantId,
      providerType: data.providerType,
      providerId: data.providerId,
      providerName: data.providerName,
      acceptedAt: new Date(),
    },
  });
};

// Admin accepts a loan: makes it visible to the selected trader so they can approve.
// Food Bundles admin may also accept then approve directly.
export const acceptLoanSessionService = async (
  sessionId: string,
  adminId: string,
  fundingTraderId?: string,
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: { restaurant: { select: { id: true, name: true } } },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.status !== LoanSessionStatus.REQUESTED) {
    throw new Error(`Cannot accept session with status: ${session.status}`);
  }

  const traderId = fundingTraderId || session.fundingTraderId;

  const updated = await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      status: LoanSessionStatus.ACCEPTED,
      ...(traderId ? { fundingTraderId: traderId } : {}),
      notes: session.notes ? `${session.notes}\nAccepted by admin.` : "Accepted by admin.",
    },
  });

  // Notify the selected trader that a loan they were picked for is ready for approval
  if (traderId) {
    await createNotificationService({
      title: "Loan Ready For Trader Approval",
      message: `${session.restaurant?.name} requested ${session.requestedAmount.toLocaleString()} RWF with you as provider (RRN: ${session.rrn}). Review and approve it.`,
      eventType: "VOUCHER_APPLIED",
      targetType: "SPECIFIC_USER",
      targetId: traderId,
      metadata: { sessionId, rrn: session.rrn, requestedAmount: session.requestedAmount },
    });
  }

  await createNotificationService({
    title: "Loan Accepted",
    message: `Your loan request (RRN: ${session.rrn}) has been accepted. It now awaits provider approval.`,
    eventType: "VOUCHER_APPLIED",
    targetType: "SPECIFIC_USER",
    targetId: session.restaurantId,
    metadata: { sessionId },
  });

  return updated;
};

// ============================================
// LOAN SESSION — TRADER APPROVAL (provider flow)
// ============================================

export const getTraderLoanSessionsService = async (traderId: string) => {
  const sessions = await prisma.loanSession.findMany({
    where: {
      fundingTraderId: traderId,
      status: { in: [LoanSessionStatus.REQUESTED, LoanSessionStatus.ACCEPTED] },
    },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
      card: { select: { id: true, pan: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return sessions;
};

// Trader approves a loan session they were selected as provider for
export const traderApproveLoanSessionService = async (
  traderId: string,
  sessionId: string,
  data: {
    approvalPercentage?: number;
    approvedAmount?: number;
    repaymentDays?: number;
    notes?: string;
  },
) => {
  const session = await prisma.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Loan session not found");
  if (session.fundingTraderId !== traderId) {
    throw new Error("This loan was not requested with you as the provider");
  }
  if (session.status !== LoanSessionStatus.ACCEPTED) {
    throw new Error(`Can only approve loans with ACCEPTED status (current: ${session.status})`);
  }

  const traderWallet = await prisma.wallet.findUnique({ where: { traderId } });
  if (!traderWallet) throw new Error("Trader wallet not found");

  // Never modify the requested amount: the trader sets a percentage, credit is derived
  const basePct = data.approvalPercentage ?? (data.approvedAmount && session.requestedAmount > 0 ? (data.approvedAmount / session.requestedAmount) * 100 : 100);
  const approvalPct = Math.max(0, Math.min(100, basePct));
  const approvedAmount = Math.round(session.requestedAmount * (approvalPct / 100));

  const availableBalance =
    traderWallet.balance - traderWallet.pendingApprovedAmount - traderWallet.pendingWithdrawBalance;
  if (availableBalance < approvedAmount) {
    throw new Error(
      `Insufficient available balance. Available: ${availableBalance} RWF, Required: ${approvedAmount} RWF`,
    );
  }

  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: { pendingApprovedAmount: traderWallet.pendingApprovedAmount + approvedAmount },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId: traderId,
      type: "TRADING",
      amount: -approvedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance,
      description: `Loan session approval by trader ${traderId} (${approvedAmount} RWF)`,
      status: "COMPLETED",
    },
  });

  const repaymentDays = data.repaymentDays ?? session.repaymentDays ?? 30;
  return approveLoanSessionService(sessionId, traderId, {
    approvedAmount,
    approvalPercentage: approvalPct,
    repaymentDays,
    notes: data.notes || `Loan approved by trader with credit of ${approvedAmount} RWF`,
    fundingTraderId: traderId,
  });
};

// Admin approves a loan session on behalf of a delegation trader
// (the delegation trader is the provider the restaurant picked, and the
// admin acts for them because of an approved delegation agreement).
export const adminApproveLoanSessionOnBehalfService = async (
  adminId: string,
  traderId: string,
  sessionId: string,
  data: {
    approvalPercentage?: number;
    approvedAmount?: number;
    repaymentDays?: number;
    notes?: string;
  },
) => {
  const traderWallet = await prisma.wallet.findUnique({ where: { traderId } });
  if (!traderWallet) throw new Error("Trader wallet not found");
  if (!traderWallet.canTradeOnBehalf || traderWallet.delegationStatus !== "ACCEPTED") {
    throw new Error(
      `Trader does not have an approved delegation agreement (status: ${traderWallet.delegationStatus})`,
    );
  }

  const session = await prisma.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Loan session not found");
  if (session.fundingTraderId !== traderId) {
    throw new Error("This loan was not requested with this trader as the provider");
  }
  if (session.status !== LoanSessionStatus.ACCEPTED) {
    throw new Error(`Can only approve loans with ACCEPTED status (current: ${session.status})`);
  }

  const basePct = data.approvalPercentage ?? (data.approvedAmount && session.requestedAmount > 0 ? (data.approvedAmount / session.requestedAmount) * 100 : 100);
  const approvalPct = Math.max(0, Math.min(100, basePct));
  const approvedAmount = Math.round(session.requestedAmount * (approvalPct / 100));

  const availableBalance =
    traderWallet.balance - traderWallet.pendingApprovedAmount - traderWallet.pendingWithdrawBalance;
  if (availableBalance < approvedAmount) {
    throw new Error(
      `Insufficient available balance. Available: ${availableBalance} RWF, Required: ${approvedAmount} RWF`,
    );
  }

  await prisma.wallet.update({
    where: { id: traderWallet.id },
    data: { pendingApprovedAmount: traderWallet.pendingApprovedAmount + approvedAmount },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: traderWallet.id,
      adminId,
      type: "TRADING",
      amount: -approvedAmount,
      previousBalance: traderWallet.balance,
      newBalance: traderWallet.balance,
      description: `Loan session ${session.rrn} approved on behalf of trader ${traderId} (${approvedAmount} RWF)`,
      status: "COMPLETED",
    },
  });

  const repaymentDays = data.repaymentDays ?? session.repaymentDays ?? 30;
  return approveLoanSessionService(sessionId, adminId, {
    approvedAmount,
    approvalPercentage: approvalPct,
    repaymentDays,
    notes: data.notes || `Loan approved on behalf of trader (credit ${approvedAmount} RWF)`,
    fundingTraderId: traderId,
  });
};

// ============================================
// UNLOCK FEE PAYMENT
// ============================================

export const payUnlockFeeService = async (
  sessionId: string,
  restaurantId: string,
  paymentData: { paymentMethod: string; paymentReference?: string; phoneNumber?: string },
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.restaurantId !== restaurantId) throw new Error("Unauthorized");
  if (
    session.status !== LoanSessionStatus.APPROVED_LOCKED &&
    session.status !== LoanSessionStatus.UNLOCK_FEE_PENDING
  ) {
    throw new Error(`Cannot pay unlock fee for session with status: ${session.status}`);
  }
  if (session.unlockStatus === UnlockStatus.UNLOCKED) {
    throw new Error("Loan is already unlocked");
  }
  if (!session.unlockFee) throw new Error("Unlock fee not set");

  const method = paymentData.paymentMethod.toUpperCase();
  if (method === "MOBILE_MONEY" && !paymentData.phoneNumber) {
    throw new Error("Phone number is required for mobile money payments");
  }

  // Build unique transaction reference routed by webhook via "UNLOCK_" prefix
  const txRef = `UNLOCK_${sessionId.slice(0, 8)}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // Create payment record (PENDING) — only webhook/verify confirmation activates the loan
  const payment = await prisma.unlockFeePayment.create({
    data: {
      sessionId,
      amount: session.unlockFee,
      paymentMethod: method,
      paymentReference: paymentData.paymentReference,
      phoneNumber: paymentData.phoneNumber,
      txRef,
      status: PaymentStatus.PENDING,
    },
  });

  // Update session to UNLOCK_FEE_PENDING while payment processes
  await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      status: LoanSessionStatus.UNLOCK_FEE_PENDING,
      unlockStatus: UnlockStatus.PENDING_PAYMENT,
    },
  });

  const email = session.restaurant?.email || "";
  const fullname = session.restaurant?.name || "";

  // Initiate REAL payment based on method
  if (method === "MOBILE_MONEY") {
    const cleanedPhone = cleanPhoneNumber(paymentData.phoneNumber || "");
    if (!isValidRwandaPhone(cleanedPhone)) {
      throw new Error(
        "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX",
      );
    }

    // Primary: PayPack cashin (pushes payment request to customer phone)
    try {
      const response = await getPaypack().cashin({
        number: cleanedPhone,
        amount: session.unlockFee,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
      });

      if (response?.data) {
        await prisma.unlockFeePayment.update({
          where: { id: payment.id },
          data: { flwRef: response.data.ref, flwStatus: "pending" },
        });

        return {
          success: true,
          status: "pending",
          paymentId: payment.id,
          txRef,
          message: "Payment request sent to your phone number, please confirm it.",
          redirectUrl: "",
          requiresRedirect: false,
          authorizationDetails: { mode: "mobile_money", redirectUrl: "" },
        };
      }
      throw new Error("PayPack response invalid or missing reference");
    } catch (error: any) {
      console.log("PayPack unlock fee cashin failed, falling back to Flutterwave:", error.message);

      // Fallback: Flutterwave hosted checkout (mobilemoney)
      const flwResult = await initiateFlutterwaveUnlockFeePayment({
        txRef,
        amount: session.unlockFee,
        email,
        fullname,
        currency: "RWF",
        paymentOptions: "mobilemoney",
        phoneNumber: cleanedPhone,
      });

      await prisma.unlockFeePayment.update({
        where: { id: payment.id },
        data: { flwStatus: "pending_flutterwave" },
      });

      return { ...flwResult, paymentId: payment.id, txRef };
    }
  }

  if (method === "CARD") {
    const flwResult = await initiateFlutterwaveUnlockFeePayment({
      txRef,
      amount: session.unlockFee,
      email,
      fullname,
      currency: "RWF",
      paymentOptions: "card",
      phoneNumber: session.restaurant?.phone || "",
    });

    await prisma.unlockFeePayment.update({
      where: { id: payment.id },
      data: { flwStatus: "pending_flutterwave" },
    });

    return { ...flwResult, paymentId: payment.id, txRef };
  }

  if (method === "BANK_TRANSFER") {
    return {
      success: true,
      status: "pending",
      paymentId: payment.id,
      txRef,
      message: "Bank transfer reference recorded. Payment will be confirmed after verification.",
      redirectUrl: "",
      requiresRedirect: false,
    };
  }

  throw new Error(`Unsupported payment method: ${method}`);
};

/**
 * Verify an in-flight unlock fee payment (used after returning from
 * Flutterwave hosted checkout or after PayPack phone confirmation).
 * Confirms the payment ONLY when the provider reports it successful.
 */
export const verifyUnlockFeePaymentService = async (
  sessionId: string,
  restaurantId: string,
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    select: { id: true, restaurantId: true, unlockStatus: true },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.restaurantId !== restaurantId) throw new Error("Unauthorized");

  // Already unlocked
  if (session.unlockStatus === UnlockStatus.UNLOCKED) {
    return { success: true, verified: true, alreadyUnlocked: true };
  }

  const payment = await prisma.unlockFeePayment.findFirst({
    where: { sessionId, status: PaymentStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });

  if (!payment) {
    return {
      success: false,
      verified: false,
      message: "No pending unlock fee payment found for this session.",
    };
  }

  // Bank transfers are verified manually — never auto-confirmed here
  if (payment.paymentMethod?.toUpperCase() === "BANK_TRANSFER") {
    return {
      success: false,
      verified: false,
      status: "pending",
      message:
        "Bank transfer payment is awaiting manual verification by the admin. You'll be notified once confirmed.",
    };
  }

  // Flutterwave hosted checkout (card/bank/momo fallback) — verify by tx_ref
  if (!payment.flwRef || payment.flwStatus === "pending_flutterwave") {
    return verifyFlutterwaveUnlockFeeByTxRef(payment, sessionId);
  }

  // PayPack: verify the cashin directly against the PayPack API so the loan is
  // unlocked even if the webhook is delayed or missed.
  if (payment.flwRef) {
    try {
      const tx = await getPaypack().transaction(payment.flwRef);
      const paypackStatus = tx?.data?.status;

      if (
        paypackStatus === "successful" ||
        paypackStatus === "success" ||
        paypackStatus === "completed"
      ) {
        await prisma.unlockFeePayment.update({
          where: { id: payment.id },
          data: { flwStatus: "successful", transactionId: tx.data.ref },
        });
        const confirmed = await confirmUnlockFeePaymentService(payment.id, sessionId);
        return { success: true, verified: true, data: confirmed };
      }

      if (paypackStatus === "failed" || paypackStatus === "cancelled") {
        await prisma.$transaction([
          prisma.unlockFeePayment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.FAILED, flwStatus: paypackStatus },
          }),
          prisma.loanSession.update({
            where: { id: sessionId },
            data: {
              status: LoanSessionStatus.APPROVED_LOCKED,
              unlockStatus: UnlockStatus.LOCKED,
            },
          }),
        ]);
        return {
          success: false,
          verified: false,
          status: "failed",
          message: "The payment was not completed. Please try again.",
        };
      }

      return {
        success: false,
        verified: false,
        status: "pending",
        message:
          paypackStatus === "processing"
            ? "Payment is still processing. Please confirm it on your phone."
            : "Payment is still pending. Please confirm the payment on your phone.",
      };
    } catch (error: any) {
      console.log("PayPack unlock fee verify error:", error.message);
      return {
        success: false,
        verified: false,
        status: "pending",
        message: "Could not verify payment status. Please try again.",
      };
    }
  }

  return { success: false, verified: false, status: "pending" };
};

async function verifyFlutterwaveUnlockFeeByTxRef(
  payment: any,
  sessionId: string,
) {
  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${payment.txRef}`,
      {
        headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
      },
    );

    if (
      response.data?.status === "success" &&
      response.data?.data?.status === "successful"
    ) {
      await prisma.unlockFeePayment.update({
        where: { id: payment.id },
        data: {
          flwRef: response.data.data.flw_ref,
          flwStatus: "successful",
          transactionId: response.data.data.id?.toString(),
        },
      });
      const confirmed = await confirmUnlockFeePaymentService(payment.id, sessionId);
      return { success: true, verified: true, data: confirmed };
    }

    return {
      success: false,
      verified: false,
      status: "pending",
      message: "Payment not yet confirmed. Please complete the payment and try again.",
    };
  } catch (error: any) {
    console.log("Flutterwave unlock fee verify error:", error.message);
    return {
      success: false,
      verified: false,
      status: "pending",
      message: "Could not verify payment status. Please try again.",
    };
  }
}

/**
 * Called on successful payment webhook confirmation.
 * Only this function should activate the loan — never on payment initiation alone.
 */
export const confirmUnlockFeePaymentService = async (
  paymentId: string,
  sessionId: string,
) => {
  const payment = await prisma.unlockFeePayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment record not found");
  if (payment.status === PaymentStatus.COMPLETED) throw new Error("Already confirmed");

  const result = await prisma.$transaction(async (tx) => {
    // Confirm payment
    const confirmedPayment = await tx.unlockFeePayment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.COMPLETED, confirmedAt: new Date() },
    });

    // Activate loan session
    const activatedSession = await tx.loanSession.update({
      where: { id: sessionId },
      data: {
        status: LoanSessionStatus.ACTIVE,
        unlockStatus: UnlockStatus.UNLOCKED,
        unlockedAt: new Date(),
      },
      include: {
        restaurant: { select: { id: true, name: true, phone: true } },
      },
    });

    return { payment: confirmedPayment, session: activatedSession };
  });

  await createNotificationService({
    title: "Loan Activated",
    message: `Your loan of ${result.session.approvedAmount?.toLocaleString()} RWF is now active. RRN: ${result.session.rrn}`,
    eventType: "PAYMENT_PROCESSED",
    targetType: "SPECIFIC_USER",
    targetId: result.session.restaurantId,
    metadata: { sessionId, approvedAmount: result.session.approvedAmount },
  });

  try {
    if (result.session.restaurant.phone) {
      await sendMessage(
        `Dear ${result.session.restaurant.name}, your loan of ${result.session.approvedAmount?.toLocaleString()} RWF is now ACTIVE. RRN: ${result.session.rrn}`,
        result.session.restaurant.phone,
      );
    }
  } catch (e) {
    console.error("SMS failed:", e);
  }

  try {
    wsManager.broadcastLoanUpdate({
      loanId: result.session.id,
      action: "PAID",
      timestamp: new Date().toISOString(),
      restaurantId: result.session.restaurantId,
      data: { status: result.session.status },
    });
  } catch (e) {
    console.error("WS broadcast failed:", e);
  }

  return result;
};

// ============================================
// LOAN SESSION — QUERIES
// ============================================

export const getMyLoanSessionsService = async (restaurantId: string) => {
  // Auto-mark overdue sessions
  await markOverdueSessionsService(restaurantId);

  const sessions = await prisma.loanSession.findMany({
    where: { restaurantId },
    include: {
      fundingTrader: { select: { id: true, username: true, email: true } },
      unlockPayments: { orderBy: { createdAt: "desc" }, take: 1 },
      authorizations: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return sessions;
};

export const getAllLoanSessionsService = async (filters?: {
  status?: LoanSessionStatus;
  restaurantId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const { status, restaurantId, search, page = 1, limit = 20 } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (restaurantId) where.restaurantId = restaurantId;
  if (search) {
    where.restaurant = { name: { contains: search, mode: "insensitive" } };
  }

  const [sessions, total] = await Promise.all([
    prisma.loanSession.findMany({
      where,
      include: {
        restaurant: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, username: true } },
        fundingTrader: { select: { id: true, username: true, email: true } },
        card: {
          select: {
            id: true,
            pan: true,
            unlockFeeEnabled: true,
            unlockFeePercentage: true,
          },
        },
        unlockPayments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.loanSession.count({ where }),
  ]);

  // Attach the effective unlock fee config (card-first, provider-fallback) so the admin
  // sees exactly what will apply at approval — no default fee.
  const decorated = await Promise.all(
    sessions.map(async (s) => {
      const config = await resolveUnlockFeeConfig(s.cardId, s.restaurantId);
      return {
        ...s,
        effectiveUnlockFeeEnabled: config.enabled,
        effectiveUnlockFeePercentage: config.percentage,
      };
    }),
  );

  return {
    data: decorated,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  };
};

export const getLoanSessionByIdService = async (sessionId: string) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: {
      restaurant: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, username: true } },
      fundingTrader: { select: { id: true, username: true, email: true } },
      card: {
        select: {
          id: true,
          pan: true,
          unlockFeeEnabled: true,
          unlockFeePercentage: true,
        },
      },
      unlockPayments: { orderBy: { createdAt: "desc" } },
      authorizations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) throw new Error("Loan session not found");
  const config = await resolveUnlockFeeConfig(session.cardId, session.restaurantId);
  return { ...session, effectiveUnlockFeeEnabled: config.enabled, effectiveUnlockFeePercentage: config.percentage };
};

// ============================================
// AUTHORIZATION (STAN — purchase at POS)
// ============================================

export const createAuthorizationService = async (
  sessionId: string,
  restaurantId: string,
  transactionAmount: number,
  posTerminal?: string,
) => {
  const session = await prisma.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Session not found");
  if (session.restaurantId !== restaurantId) throw new Error("Unauthorized");
  if (session.status !== LoanSessionStatus.ACTIVE && session.status !== LoanSessionStatus.PARTIALLY_USED) {
    throw new Error(`Session is not active (status: ${session.status})`);
  }
  if (session.unlockStatus !== UnlockStatus.UNLOCKED) {
    throw new Error("Session is locked — pay unlock fee first");
  }

  const available = (session.approvedAmount ?? 0) - session.amountUsed;
  if (transactionAmount > available) {
    throw new Error(`Insufficient session balance. Available: ${available} RWF`);
  }

  const stan = generateStan();
  const newAmountUsed = session.amountUsed + transactionAmount;
  const approvedAmount = session.approvedAmount ?? 0;
  const newStatus =
    newAmountUsed >= approvedAmount
      ? LoanSessionStatus.FULLY_USED
      : LoanSessionStatus.PARTIALLY_USED;

  const result = await prisma.$transaction(async (tx) => {
    const auth = await tx.sessionAuthorization.create({
      data: { stan, sessionId, transactionAmount, posTerminal, responseStatus: "APPROVED" },
    });

    const updatedSession = await tx.loanSession.update({
      where: { id: sessionId },
      data: {
        amountUsed: newAmountUsed,
        outstandingAmount: newAmountUsed - session.amountRepaid,
        status: newStatus,
      },
    });

    return { authorization: auth, session: updatedSession };
  });

  return result;
};

// ============================================
// LOAN SESSION — CHECKOUT INTEGRATION
// ============================================

// Validate an active loan session for checkout (partial coverage allowed — the
// restaurant pays the shortfall). Accepts either the session id or the RRN.
export const validateLoanSessionForCheckoutService = async (
  identifier: string,
  orderAmount: number,
  restaurantId: string,
) => {
  const session = await prisma.loanSession.findFirst({
    where: {
      restaurantId,
      OR: [{ id: identifier }, { rrn: identifier }],
    },
  });
  if (!session) {
    return { valid: false, error: "Loan session not found for this restaurant" };
  }
  if (session.status !== LoanSessionStatus.ACTIVE && session.status !== LoanSessionStatus.PARTIALLY_USED) {
    return { valid: false, error: `Loan session is not active (status: ${session.status})` };
  }
  if (session.unlockStatus !== UnlockStatus.UNLOCKED) {
    return { valid: false, error: "Loan session is locked — pay the unlock fee first" };
  }

  const availableCredit = Math.max(0, (session.approvedAmount ?? 0) - session.amountUsed);
  if (availableCredit <= 0) {
    return { valid: false, error: "Loan session has no remaining credit" };
  }
  if (orderAmount <= 0) {
    return { valid: false, error: "Order amount must be greater than zero" };
  }

  const loanCovers = Math.min(availableCredit, orderAmount);
  const additionalPaymentNeeded = Math.max(0, orderAmount - availableCredit);

  return {
    valid: true,
    session: {
      id: session.id,
      rrn: session.rrn,
      requestedAmount: session.requestedAmount,
      approvedAmount: session.approvedAmount,
      amountUsed: session.amountUsed,
      availableCredit,
      outstandingAmount: session.outstandingAmount,
    },
    coverage: {
      orderAmount,
      loanCovered: loanCovers,
      additionalPaymentNeeded,
      canCoverFullAmount: additionalPaymentNeeded === 0,
    },
    message: additionalPaymentNeeded > 0
      ? `This loan covers ${loanCovers.toLocaleString()} RWF. The customer must pay the remaining ${additionalPaymentNeeded.toLocaleString()} RWF at checkout/delivery.`
      : `This loan covers the full order amount of ${orderAmount.toLocaleString()} RWF.`,
  };
};

// Deduct credit from an active loan session toward an order at checkout.
// Partial coverage is allowed — only the available credit is consumed and the
// order records the shortfall as the amount the customer must pay directly.
export const processLoanSessionPaymentService = async ({
  sessionId,
  orderId,
  restaurantId,
  originalAmount,
}: {
  sessionId: string;
  orderId: string;
  restaurantId: string;
  originalAmount: number;
}) => {
  const session = await prisma.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error("Loan session not found");
  if (session.restaurantId !== restaurantId) throw new Error("Loan session does not belong to this restaurant");
  if (session.status !== LoanSessionStatus.ACTIVE && session.status !== LoanSessionStatus.PARTIALLY_USED) {
    throw new Error(`Loan session is not active (status: ${session.status})`);
  }
  if (session.unlockStatus !== UnlockStatus.UNLOCKED) {
    throw new Error("Loan session is locked — pay unlock fee first");
  }

  const availableCredit = Math.max(0, (session.approvedAmount ?? 0) - session.amountUsed);
  if (availableCredit <= 0) throw new Error("Loan session has no remaining credit");

  const loanCovered = Math.min(availableCredit, originalAmount);
  const additionalPaymentNeeded = Math.max(0, originalAmount - availableCredit);
  if (loanCovered <= 0) throw new Error("Loan session has no credit to cover this order");

  const { authorization } = await createAuthorizationService(
    sessionId,
    restaurantId,
    loanCovered,
    `ORDER-${orderId}`,
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentType: "VOUCHER_PAYMENT",
      paymentProvider: "LOAN_SESSION",
      voucherCode: session.rrn,
      status: "CONFIRMED",
      paymentStatus: PaymentStatus.VOUCHER_CREDIT,
      notes: additionalPaymentNeeded > 0
        ? `Loan covered ${loanCovered.toLocaleString()} RWF. Customer pays extra ${additionalPaymentNeeded.toLocaleString()} RWF.`
        : undefined,
    },
  });

  return {
    success: true,
    transactionId: authorization.stan,
    reference: authorization.id,
    flwRef: `LOAN_${session.rrn}`,
    status: "successful",
    message: additionalPaymentNeeded > 0
      ? `Loan covered ${loanCovered.toLocaleString()} RWF of the order. Customer pays ${additionalPaymentNeeded.toLocaleString()} RWF extra.`
      : `Payment completed using loan session ${session.rrn}`,
    voucherDetails: {
      voucherCode: session.rrn,
      amountCovered: loanCovered,
      remainingAmount: additionalPaymentNeeded,
      creditUsed: loanCovered,
      remainingCredit: availableCredit - loanCovered,
    },
    loanSessionDetails: {
      sessionId,
      rrn: session.rrn,
      approvedAmount: session.approvedAmount ?? 0,
      creditUsed: loanCovered,
      remainingCredit: availableCredit - loanCovered,
    },
    requiresAdditionalPayment: additionalPaymentNeeded > 0,
    additionalPaymentAmount: additionalPaymentNeeded,
  };
};

// ============================================
// OVERDUE CHECK
// ============================================

export const markOverdueSessionsService = async (restaurantId?: string) => {
  const where: any = {
    status: { in: [LoanSessionStatus.ACTIVE, LoanSessionStatus.PARTIALLY_USED, LoanSessionStatus.FULLY_USED] },
    dueDate: { lt: new Date() },
    outstandingAmount: { gt: 0 },
  };
  if (restaurantId) where.restaurantId = restaurantId;

  await prisma.loanSession.updateMany({
    where,
    data: { status: LoanSessionStatus.OVERDUE },
  });
};

// ============================================
// KAYKO WALLET TRANSFER (unused voucher amount)
// ============================================

/**
 * Transfer unused voucher amount to restaurant wallet.
 * This runs when a Kayko-approved loan's voucher expires or has unused balance.
 * Kayko provides real money, so voucher amounts must be credited to restaurant wallet.
 */
export const transferUnusedVoucherAmountToWalletService = async (
  sessionId: string,
  notes?: string,
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: { card: true, restaurant: true },
  });
  if (!session) throw new Error("Loan session not found");

  const approvedAmount = session.approvedAmount ?? 0;
  const unusedAmount = Math.max(0, approvedAmount - session.amountUsed);

  if (unusedAmount <= 0) {
    return { transferred: 0, message: "No unused amount to transfer" };
  }

  const result = await transferVoucherAmountToWalletService({
    restaurantId: session.restaurantId,
    amount: unusedAmount,
    loanSessionId: session.id,
    source: "VOUCHER_EXPIRY",
    notes: notes || `Unused amount from loan session ${session.rrn} transferred to wallet`,
  });

  return {
    transferred: unusedAmount,
    ...result,
  };
};

// ============================================
// CARD ENROLLMENT REQUESTS (Admin)
// ============================================

export const getCardEnrollmentRequestsService = async () => {
  return prisma.cardEnrollmentRequest.findMany({
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { requestedAt: "desc" },
  });
};

// ============================================
// ADMIN STATS
// ============================================

export const getVoucherCardStatsService = async () => {
  const [
    totalCards,
    activeCards,
    pendingEnrollments,
    pendingSessions,
    activeSessions,
    overdueSessions,
    totalSessions,
  ] = await Promise.all([
    prisma.voucherCard.count(),
    prisma.voucherCard.count({ where: { status: CardStatus.ACTIVE } }),
    prisma.cardEnrollmentRequest.count({ where: { status: "PENDING" } }),
    prisma.loanSession.count({ where: { status: LoanSessionStatus.REQUESTED } }),
    prisma.loanSession.count({
      where: { status: { in: [LoanSessionStatus.ACTIVE, LoanSessionStatus.PARTIALLY_USED] } },
    }),
    prisma.loanSession.count({ where: { status: LoanSessionStatus.OVERDUE } }),
    prisma.loanSession.count(),
  ]);

  const totalOutstanding = await prisma.loanSession.aggregate({
    _sum: { outstandingAmount: true },
    where: {
      status: {
        notIn: [LoanSessionStatus.CLOSED, LoanSessionStatus.SETTLED, LoanSessionStatus.REJECTED],
      },
    },
  });

  return {
    totalCards,
    activeCards,
    pendingEnrollments,
    pendingSessions,
    activeSessions,
    overdueSessions,
    totalSessions,
    totalOutstandingAmount: totalOutstanding._sum.outstandingAmount ?? 0,
    unlockFeePct: 0,
    minQualifyingOrders: parseInt(process.env.VOUCHER_MIN_QUALIFYING_ORDERS ?? "5"),
  };
};
