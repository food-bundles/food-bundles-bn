import prisma from "../prisma";
import { CardStatus, LoanSessionStatus, UnlockStatus, PaymentStatus, TransactionStatus, WalletTransactionType, SubscriptionStatus } from "@prisma/client";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import { wsManager } from "../index";
import { transferVoucherAmountToWalletService } from "./wallet-transfer.service";
import { cleanPhoneNumber, isValidRwandaPhone } from "../utils/emailTemplates";
import { retryDatabaseOperation } from "../utils/db-retry.utls";
import {
  debitWalletService,
  getWalletByRestaurantIdService,
} from "./wallet.service";
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

/**
 * Resolve the authoritative PayPack transaction status.
 * NOTE: PayPack's `transaction(ref)` (transactions/find) response does NOT
 * include a `status` field, so it must never be used to decide success.
 * The status only exists in the events feed (`events({ ref })`).
 */
async function getPaypackTransactionStatus(flwRef: string) {
  try {
    const res: any = await getPaypack().events({ ref: flwRef });
    const txs: any[] = res?.data?.transactions;
    if (Array.isArray(txs) && txs.length) {
      const applicable = txs
        .filter((t) => t && t.data && typeof t.data.status === "string")
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime(),
        );
      const latest = applicable[0];
      if (latest?.data) {
        return {
          status: latest.data.status,
          ref: latest.data.ref || flwRef,
          userRef: latest.data.user_ref,
          processedAt: latest.data.processed_at,
        };
      }
    }
  } catch (e: any) {
    console.log("PayPack events lookup failed:", e.message);
  }
  // Fall back to the raw transaction (existence check only — no status here)
  try {
    const tx: any = await getPaypack().transaction(flwRef);
    if (tx?.data?.ref) return { status: tx.data.status, ref: tx.data.ref };
  } catch (e: any) {
    console.log("PayPack transaction lookup failed:", e.message);
  }
  return { status: undefined, ref: flwRef };
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
      const cfg = await resolveUnlockFeeConfig(s.restaurantId, {
        loanProviderType: s.loanProviderType,
        fundingTraderId: s.fundingTraderId,
      });
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
      loanProviderType: s.loanProviderType,
      fundingTraderId: s.fundingTraderId,
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
    if (trader.requiresSubscription) {
      const activeSubscription = await prisma.restaurantSubscription.findFirst({
        where: { restaurantId, status: SubscriptionStatus.ACTIVE },
      });
      if (!activeSubscription) {
        throw new Error(
          `${trader.username} requires an active subscription to provide a loan. Please subscribe first.`,
        );
      }
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

// The unlock fee is configured on the loan provider account selected for the session:
//   - TRADER: the funding trader's wallet (set by an admin in the Loan Access tab).
//   - FOOD_BUNDLES: the Food Bundles platform loan provider.
// There is no per-restaurant (card) unlock fee and no default fee.
export const resolveUnlockFeeConfig = async (
  restaurantId: string,
  options?: {
    loanProviderType?: string | null;
    fundingTraderId?: string | null;
  },
) => {
  if (options?.loanProviderType === "TRADER" && options.fundingTraderId) {
    const wallet = await prisma.wallet.findUnique({
      where: { traderId: options.fundingTraderId },
    });
    if (wallet?.unlockFeeEnabled && (wallet.unlockFeePercentage ?? 0) > 0) {
      return { enabled: true, percentage: wallet.unlockFeePercentage ?? 0 };
    }
    return { enabled: false, percentage: 0 };
  }

  // Platform-funded loans use the Food Bundles platform provider configured in the
  // Loan Access tab; fall back to the legacy plan-linked provider if none exists.
  const platform =
    (await prisma.loanProvider.findFirst({
      where: { name: { contains: "food", mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    })) ?? (await resolveFoodBundlesProvider(restaurantId));
  if (platform?.unlockFeeEnabled && (platform.unlockFeePercentage ?? 0) > 0) {
    return { enabled: true, percentage: platform.unlockFeePercentage ?? 0 };
  }
  return { enabled: false, percentage: 0 };
};

// Resolve what happens to a loan session's leftover amount (approved - used)
// after it has been consumed at checkout. Configured per provider in the Loan
// Access tab, same pattern as resolveUnlockFeeConfig:
//   - TRADER: the funding trader's wallet.
//   - FOOD_BUNDLES: the Food Bundles platform loan provider.
// Values: "USELESS" (default — leftover is recorded but never usable again) or
// "TOPUP_WALLET" (leftover is credited to the restaurant's wallet balance).
export const resolveLoanLeftoverPolicy = async (
  restaurantId: string,
  options?: {
    loanProviderType?: string | null;
    fundingTraderId?: string | null;
  },
): Promise<"TOPUP_WALLET" | "USELESS"> => {
  if (options?.loanProviderType === "TRADER" && options.fundingTraderId) {
    const wallet = await prisma.wallet.findUnique({
      where: { traderId: options.fundingTraderId },
    });
    return wallet?.leftoverPolicy === "TOPUP_WALLET" ? "TOPUP_WALLET" : "USELESS";
  }

  const platform =
    (await prisma.loanProvider.findFirst({
      where: { name: { contains: "food", mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
    })) ?? (await resolveFoodBundlesProvider(restaurantId));
  return platform?.leftoverPolicy === "TOPUP_WALLET" ? "TOPUP_WALLET" : "USELESS";
};

export const approveLoanSessionService = async (
  sessionId: string,
  adminId: string,
  data: {
    approvedAmount?: number;
    approvalPercentage?: number;
    repaymentDays: number;
    notes?: string;
    fundingTraderId?: string | null;
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

  // The provider that will actually fund this approval. An explicit admin choice
  // wins — including an explicit platform selection (null) — otherwise we follow
  // the provider the restaurant picked when requesting (session.fundingTraderId).
  const effectiveTraderId =
    data.fundingTraderId !== undefined
      ? data.fundingTraderId
      : session.fundingTraderId;

  // Resolve the effective unlock fee config — set on the selected loan provider (trader wallet
  // for TRADER, or the Food Bundles platform provider for FOOD_BUNDLES).
  // There is no default fee: if the selected provider has no unlock fee enabled, no fee applies.
  // Admin may override at approval time via requireUnlockFee (undefined → follow resolved config).
  // The unlock fee percentage is not static — the admin may override it at approval time too.
  const config = await resolveUnlockFeeConfig(session.restaurantId, {
    loanProviderType: effectiveTraderId ? "TRADER" : "FOOD_BUNDLES",
    fundingTraderId: effectiveTraderId,
  });
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
      fundingTraderId: effectiveTraderId ?? null,
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
      loanTermsAndConditions: true,
      requiresSubscription: true,
      traderWallet: {
        select: {
          id: true,
          balance: true,
          pendingApprovedAmount: true,
          pendingWithdrawBalance: true,
          isActive: true,
          canTradeOnBehalf: true,
          delegationStatus: true,
          unlockFeeEnabled: true,
          unlockFeePercentage: true,
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
        termsAndConditions: t.loanTermsAndConditions || t.termsAndConditions,
        requiresSubscription: t.requiresSubscription,
        availableBalance,
        canTradeOnBehalf: wallet?.canTradeOnBehalf ?? false,
        delegationStatus: wallet?.delegationStatus ?? "NORMAL",
        unlockFeeEnabled: wallet?.unlockFeeEnabled ?? false,
        unlockFeePercentage: wallet?.unlockFeePercentage ?? null,
      };
    });
};

// Live check of a trader's loan capacity vs a requested amount (fresh from DB).
// Used by the admin before accepting a loan and sending it to a trader, so the
// admin knows right away whether the trader can fund the amount.
export const checkTraderLoanCapacityService = async (
  traderId: string,
  amount?: number,
) => {
  const trader = await prisma.admin.findUnique({
    where: { id: traderId, role: "TRADER" },
    select: { id: true, username: true, email: true },
  });
  if (!trader) throw new Error("Trader not found");

  const wallet = await prisma.wallet.findUnique({ where: { traderId } });
  if (!wallet) {
    throw new Error(`Trader ${trader.username} does not have a wallet yet`);
  }

  const availableBalance = Math.max(
    0,
    wallet.balance - wallet.pendingApprovedAmount - wallet.pendingWithdrawBalance,
  );

  const requiredAmount = amount && amount > 0 ? amount : null;
  const canFund =
    requiredAmount === null || availableBalance >= requiredAmount;
  const shortfall =
    requiredAmount === null ? 0 : Math.max(0, requiredAmount - availableBalance);

  return {
    traderId,
    name: trader.username,
    email: trader.email,
    availableBalance,
    requiredAmount,
    canFund,
    shortfall,
  };
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
  let requiresSubscription = false;

  if (options.providerType === "TRADER") {
    if (!options.fundingTraderId) throw new Error("fundingTraderId is required for a trader provider");
    const trader = await prisma.admin.findUnique({ where: { id: options.fundingTraderId } });
    if (!trader || trader.role !== "TRADER") throw new Error("Selected trader does not exist");
    providerId = trader.id;
    providerName = trader.username;
    terms = trader.loanTermsAndConditions || trader.termsAndConditions || "";
    requiresSubscription = trader.requiresSubscription;
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

  const hasActiveSubscription = !!(await prisma.restaurantSubscription.findFirst({
    where: { restaurantId, status: SubscriptionStatus.ACTIVE },
  }));

  return {
    providerType: options.providerType,
    providerId,
    providerName,
    terms,
    accepted: !!accepted,
    requiresSubscription,
    hasActiveSubscription,
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
// The admin may also set the credit to grant (approval % / amount) and the repayment
// days here, which are stored as defaults the trader sees when approving. When a
// trader is involved, the trader's available balance is verified BEFORE accepting.
// Food Bundles admin may also accept then approve directly.
export const acceptLoanSessionService = async (
  sessionId: string,
  adminId: string,
  fundingTraderId?: string,
  options?: {
    approvalPercentage?: number;
    approvedAmount?: number;
    repaymentDays?: number;
  },
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

  // Resolve credit/repayment defaults and verify the trader can fund the amount.
  let approvalPct: number | undefined;
  let targetAmount: number | undefined;
  let repaymentDays: number | undefined;
  let dueDate: Date | undefined;
  if (options) {
    const basePct =
      options.approvalPercentage ??
      (options.approvedAmount && session.requestedAmount > 0
        ? (options.approvedAmount / session.requestedAmount) * 100
        : 100);
    approvalPct = Math.max(0, Math.min(100, basePct));
    targetAmount = Math.round(session.requestedAmount * (approvalPct / 100));

    if (traderId) {
      const traderWallet = await prisma.wallet.findUnique({ where: { traderId } });
      if (!traderWallet) throw new Error("Trader wallet not found");
      const availableBalance =
        traderWallet.balance -
        traderWallet.pendingApprovedAmount -
        traderWallet.pendingWithdrawBalance;
      if (availableBalance < targetAmount) {
        throw new Error(
          `Insufficient available balance. Available: ${availableBalance} RWF, Required: ${targetAmount} RWF`,
        );
      }
    }

    if (options.repaymentDays && options.repaymentDays > 0) {
      repaymentDays = options.repaymentDays;
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + options.repaymentDays);
    }
  }

  const updated = await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      status: LoanSessionStatus.ACCEPTED,
      ...(traderId ? { fundingTraderId: traderId } : {}),
      ...(approvalPct !== undefined ? { approvalPercentage: approvalPct } : {}),
      ...(targetAmount !== undefined ? { approvedAmount: targetAmount } : {}),
      ...(repaymentDays !== undefined ? { repaymentDays } : {}),
      ...(dueDate ? { dueDate } : {}),
      notes: session.notes
        ? `${session.notes}\nAccepted by admin.`
        : "Accepted by admin.",
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
  if (session.fundingTraderId && session.fundingTraderId !== traderId) {
    throw new Error("This loan was already assigned to another trader as the provider");
  }
  if (
    session.status !== LoanSessionStatus.REQUESTED &&
    session.status !== LoanSessionStatus.ACCEPTED
  ) {
    throw new Error(`Can only approve loans with REQUESTED or ACCEPTED status (current: ${session.status})`);
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
          data: {
            flwRef:
              response.data.ref ||
              response.data.transaction_id ||
              response.data.id,
            flwStatus: "pending",
          },
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

  // PayPack: verify the cashin against the PayPack API so the loan is
  // unlocked even if the webhook is delayed or missed.
  if (payment.flwRef) {
    try {
      const {
        status: paypackStatus,
        ref: paypackRef,
      } = await getPaypackTransactionStatus(payment.flwRef);

      if (
        paypackStatus === "successful" ||
        paypackStatus === "success" ||
        paypackStatus === "completed"
      ) {
        await prisma.unlockFeePayment.update({
          where: { id: payment.id },
          data: { flwStatus: "successful", transactionId: paypackRef },
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
  const payment = await prisma.unlockFeePayment.findUnique({
    where: { id: paymentId },
    include: {
      session: {
        include: {
          restaurant: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!payment) throw new Error("Payment record not found");

  // Idempotent: the payment (and loan) may already have been confirmed by a
  // webhook or a previous verify call. Never throw — return the current state so
  // both the webhook and manual verification can safely race.
  if (payment.status === PaymentStatus.COMPLETED) {
    return { payment, session: payment.session };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Confirm payment
    const confirmedPayment = await tx.unlockFeePayment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.COMPLETED, confirmedAt: new Date() },
    });

    // Any other pending unlock payments for this session are now obsolete —
    // mark them failed so they can never be confirmed later.
    await tx.unlockFeePayment.updateMany({
      where: {
        sessionId,
        id: { not: paymentId },
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.FAILED, flwStatus: "superseded" },
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

  // Attach the effective unlock fee config (resolved from the selected loan provider) so the admin
  // sees exactly what will apply at approval — no default fee.
  const decorated = await Promise.all(
    sessions.map(async (s) => {
      const config = await resolveUnlockFeeConfig(s.restaurantId, {
        loanProviderType: s.loanProviderType,
        fundingTraderId: s.fundingTraderId,
      });
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
        },
      },
      unlockPayments: { orderBy: { createdAt: "desc" } },
      authorizations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) throw new Error("Loan session not found");
  const config = await resolveUnlockFeeConfig(session.restaurantId, {
    loanProviderType: session.loanProviderType,
    fundingTraderId: session.fundingTraderId,
  });
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

// Validate an active loan session for checkout. Strict rule: a voucher/loan may
// ONLY be used when it can cover the ENTIRE order total. If the order total
// exceeds the loan's usable credit, the voucher is NOT usable — the restaurant
// must pay another way. No partial/split payment is allowed. Accepts either the
// session id or the RRN.
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
  if (orderAmount > availableCredit) {
    return {
      valid: false,
      error: `This loan's usable credit is ${availableCredit.toLocaleString()} RWF, which is less than the order total of ${orderAmount.toLocaleString()} RWF. You cannot use a voucher for this order — please choose another payment method.`,
    };
  }

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
      loanCovered: orderAmount,
      additionalPaymentNeeded: 0,
      canCoverFullAmount: true,
    },
    message: `This loan covers the full order amount of ${orderAmount.toLocaleString()} RWF.`,
  };
};

// Deduct credit from an active loan session toward an order at checkout.
// Strict rule: the loan must cover the ENTIRE order — if the order total
// exceeds the loan's usable credit the payment is rejected (no split payment).
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
  if (originalAmount > availableCredit) {
    throw new Error(
      `This loan's usable credit is ${availableCredit.toLocaleString()} RWF, which is less than the order total of ${originalAmount.toLocaleString()} RWF. You cannot use a voucher for this order — please choose another payment method.`,
    );
  }

  const loanCovered = originalAmount;
  const additionalPaymentNeeded = 0;

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
    },
  });

  // A loan session is consumed the moment it is used at checkout. Any credit
  // still left (approved - used) is settled per the provider's leftover policy:
  //   - TOPUP_WALLET: the leftover is credited to the restaurant's wallet.
  //   - USELESS (default): the leftover is recorded on the session but cannot be
  //     used again.
  const nextUsed = session.amountUsed + loanCovered;
  const leftover = Math.max(0, (session.approvedAmount ?? 0) - nextUsed);

  let leftoverApplied = "USELESS";
  let transferredToWallet = 0;
  if (leftover > 0) {
    try {
      const policy = await resolveLoanLeftoverPolicy(session.restaurantId, {
        loanProviderType: session.loanProviderType,
        fundingTraderId: session.fundingTraderId,
      });
      if (policy === "TOPUP_WALLET") {
        await transferVoucherAmountToWalletService({
          restaurantId: session.restaurantId,
          amount: leftover,
          loanSessionId: session.id,
          source: "LOAN_LEFTOVER",
          notes: `Leftover from loan session ${session.rrn} credited to wallet (voucher used once)`,
        });
        leftoverApplied = "TOPUP_WALLET";
        transferredToWallet = leftover;
      }
    } catch (leftoverError) {
      // Leftover settlement must never undo a successful payment.
      console.log("Failed to settle loan leftover policy:", leftoverError);
      leftoverApplied = "USELESS";
    }

    // Since the voucher is used once, mark the session consumed so the leftover
    // cannot be re-used in a later checkout/POS transaction.
    await prisma.loanSession
      .update({
        where: { id: session.id },
        data: { status: LoanSessionStatus.FULLY_USED },
      })
      .catch(console.error);
  }

  return {
    success: true,
    transactionId: authorization.stan,
    reference: authorization.id,
    flwRef: `LOAN_${session.rrn}`,
    status: "successful",
    message: `Payment completed using loan session ${session.rrn}`,
    voucherDetails: {
      voucherCode: session.rrn,
      amountCovered: loanCovered,
      remainingAmount: 0,
      creditUsed: loanCovered,
      remainingCredit: 0,
    },
    loanSessionDetails: {
      sessionId,
      rrn: session.rrn,
      approvedAmount: session.approvedAmount ?? 0,
      creditUsed: loanCovered,
      remainingCredit: 0,
      leftover,
      leftoverApplied,
      transferredToWallet,
    },
    requiresAdditionalPayment: false,
    additionalPaymentAmount: 0,
  };
};

// ============================================
// LOAN CONVERSION — voucher credit to wallet
// ============================================

// Convert a loan session's remaining usable credit into the restaurant's
// prepaid wallet. The voucher is consumed (status -> FULLY_USED) so it can never
// be used at checkout again; the wallet is credited with the full remaining
// amount so the restaurant can pay for its order from the wallet instead. This
// is the flow when the order total exceeds the loan's credit — instead of a
// dead end, the voucher's remaining value is moved to the wallet (and the user
// can top up the wallet further if still short of the order total).
export const convertLoanSessionToWalletService = async (
  rrn: string,
  restaurantId: string,
) => {
  const session = await prisma.loanSession.findFirst({
    where: { rrn, restaurantId },
  });
  if (!session) throw new Error("Loan session not found");

  if (
    session.status !== LoanSessionStatus.ACTIVE &&
    session.status !== LoanSessionStatus.PARTIALLY_USED
  ) {
    throw new Error(
      `Loan session cannot be converted (status: ${session.status})`,
    );
  }
  if (session.unlockStatus !== UnlockStatus.UNLOCKED) {
    throw new Error("Loan session is locked — pay the unlock fee first");
  }

  const remainingCredit = Math.max(
    0,
    (session.approvedAmount ?? 0) - session.amountUsed,
  );
  if (remainingCredit <= 0) {
    throw new Error("Loan session has no remaining credit to convert");
  }

  const result = await transferVoucherAmountToWalletService({
    restaurantId,
    amount: remainingCredit,
    loanSessionId: session.id,
    source: "LOAN_CONVERSION",
    notes: `Restaurant converted loan session ${session.rrn} to prepaid wallet (voucher used once)`,
  });

  // The voucher is now consumed — it can never be used at checkout again. The
  // full credit counts as "used" (whether spent on an order or moved to the
  // prepaid wallet) and the restaurant owes it, so outstanding grows too.
  await prisma.loanSession
    .update({
      where: { id: session.id },
      data: {
        status: LoanSessionStatus.FULLY_USED,
        amountUsed: session.approvedAmount ?? 0,
        outstandingAmount: (session.approvedAmount ?? 0) - session.amountRepaid,
      },
    })
    .catch(console.error);

  return {
    rrn: session.rrn,
    convertedAmount: remainingCredit,
    ...result,
  };
};

// ============================================
// LOAN REPAYMENT — "Pay Voucher"
// ============================================

/**
 * Initiate a Flutterwave hosted checkout for a loan-session repayment.
 * Mirrors the unlock-fee hosted payment flow.
 */
async function initiateFlutterwaveLoanRepayment(params: {
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
      title: "Voucher Loan Repayment - Food Bundles",
      description: `Voucher loan repayment for ${fullname}`,
      logo: `https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png`,
    },
    payment_options: paymentOptions,
    meta: {
      transaction_type: "LOAN_REPAYMENT",
      loan_repayment_ref: txRef,
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
      message: "Redirect to complete voucher repayment",
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

/**
 * Apply a confirmed repayment amount to a loan session (idempotent per payment):
 * increment amountRepaid, recompute outstanding = amountUsed - amountRepaid,
 * and settle the session (SETTLED) once zero outstanding remains.
 */
async function settleLoanRepayment(
  tx: any,
  sessionId: string,
  amount: number,
) {
  const session = await tx.loanSession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const newRepaid = (session.amountRepaid ?? 0) + amount;
  const newOutstanding = Math.max(0, (session.amountUsed ?? 0) - newRepaid);
  await tx.loanSession.update({
    where: { id: sessionId },
    data: {
      amountRepaid: newRepaid,
      outstandingAmount: newOutstanding,
      ...(newOutstanding <= 0
        ? { status: LoanSessionStatus.SETTLED, closedAt: new Date() }
        : {}),
    },
  });
}

async function notifyLoanRepaymentConfirmed(session: any, amount: number) {
  try {
    await createNotificationService({
      title: "Voucher Repayment Received",
      message: `Repayment of ${(amount ?? 0).toLocaleString()} RWF received for voucher. RRN: ${
        session?.rrn ?? ""
      }`,
      eventType: "PAYMENT_PROCESSED",
      targetType: "SPECIFIC_USER",
      targetId: session?.restaurantId ?? "",
      metadata: { sessionId: session?.id, amount },
    });
  } catch (e) {
    console.error("Repayment notification failed:", e);
  }
  try {
    if (session?.restaurant?.phone) {
      await sendMessage(
        `Repayment of ${(amount ?? 0).toLocaleString()} RWF received for your voucher. RRN: ${
          session?.rrn ?? ""
        }`,
        session.restaurant.phone,
      );
    }
  } catch (e) {
    console.error("Repayment SMS failed:", e);
  }
}

/**
 * Confirming a repayment: idempotent — marks the LoanRepayment COMPLETED,
 * supersedes any other pending repayments for the session, and applies the
 * amount to the loan session.
 */
export const confirmLoanRepaymentService = async (
  paymentId: string,
  sessionId: string,
) => {
  const payment = await prisma.loanRepayment.findUnique({
    where: { id: paymentId },
    include: {
      session: {
        include: {
          restaurant: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });
  if (!payment) throw new Error("Repayment record not found");

  if (payment.status === PaymentStatus.COMPLETED) {
    return { repayment: payment, session: payment.session };
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const confirmed = await tx.loanRepayment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        confirmedAt: new Date(),
      },
    });

    await tx.loanRepayment.updateMany({
      where: { sessionId, id: { not: paymentId } },
      data: { status: PaymentStatus.FAILED, flwStatus: "superseded" },
    });

    await settleLoanRepayment(tx, sessionId, payment.amount);

    const updated = await tx.loanSession.findUnique({
      where: { id: sessionId },
      include: {
        restaurant: { select: { id: true, name: true, phone: true } },
      },
    });

    return { repayment: confirmed, session: updated };
  });

  await notifyLoanRepaymentConfirmed(result.session, payment.amount);

  return result;
};

/**
 * Verify a pending loan repayment. For PayPack (MoMo) it checks the events feed;
 * for the Flutterwave hosted checkout it verifies by tx_ref. Confirms on success.
 */
export const verifyLoanRepaymentService = async (
  sessionId: string,
  restaurantId: string,
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      restaurantId: true,
      outstandingAmount: true,
      status: true,
    },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.restaurantId !== restaurantId) {
    throw new Error("Unauthorized access to this loan session");
  }
  if (session.outstandingAmount <= 0) {
    return {
      success: true,
      verified: true,
      alreadySettled: true,
      message: "This voucher is already fully repaid.",
    };
  }

  const payment = await prisma.loanRepayment.findFirst({
    where: { sessionId, status: PaymentStatus.PENDING },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) {
    throw new Error("No pending repayment payment found for this voucher.");
  }

  // Flutterwave hosted checkout (no provider ref yet) — verify by tx_ref
  if (!payment.flwRef || payment.flwStatus === "pending_flutterwave") {
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
        await retryDatabaseOperation(async () => {
          return await prisma.loanRepayment.update({
            where: { id: payment.id },
            data: {
              flwRef: response.data.data.flw_ref,
              flwStatus: "successful",
              transactionId: response.data.data.id?.toString(),
            },
          });
        });
        const confirmed = await confirmLoanRepaymentService(
          payment.id,
          sessionId,
        );
        return { success: true, verified: true, data: confirmed };
      }
      return {
        success: false,
        verified: false,
        status: "pending",
        message: "Payment not yet confirmed. Please complete the payment and try again.",
      };
    } catch (error: any) {
      console.log("Flutterwave repayment verify error:", error.message);
      return {
        success: false,
        verified: false,
        status: "pending",
        message: "Could not verify payment status. Please try again.",
      };
    }
  }

  // PayPack mobile money — check the events feed for real status
  try {
    const { status: ppStatus, ref: ppRef } = await getPaypackTransactionStatus(
      payment.flwRef,
    );
    if (
      ppStatus === "successful" ||
      ppStatus === "success" ||
      ppStatus === "completed"
    ) {
      await retryDatabaseOperation(async () => {
        return await prisma.loanRepayment.update({
          where: { id: payment.id },
          data: { flwStatus: "successful", transactionId: ppRef },
        });
      });
      const confirmed = await confirmLoanRepaymentService(payment.id, sessionId);
      return { success: true, verified: true, data: confirmed };
    }
    if (ppStatus === "failed" || ppStatus === "cancelled") {
      await retryDatabaseOperation(async () => {
        return await prisma.loanRepayment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, flwStatus: ppStatus },
        });
      });
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
        ppStatus === "processing"
          ? "Payment is still processing. Please confirm it on your phone."
          : "Payment is still pending. Please confirm the payment on your phone.",
    };
  } catch (error: any) {
    console.log("PayPack repayment verify error:", error.message);
    return {
      success: false,
      verified: false,
      status: "pending",
      message: "Could not verify payment status. Please try again.",
    };
  }
};

/**
 * Repay the outstanding credit on a voucher loan session ("Pay Voucher").
 * The repayment amount is the session's outstanding = amountUsed - amountRepaid.
 * Payment methods: CASH (prepaid wallet) debits immediately and confirms;
 * MOBILE_MONEY / CARD create a pending repayment and initiate payment
 * (PayPack cashin with Flutterwave fallback, or Flutterwave hosted checkout).
 */
export const repayLoanSessionService = async (
  sessionId: string,
  restaurantId: string,
  paymentData: {
    paymentMethod: string;
    paymentReference?: string;
    phoneNumber?: string;
  },
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.restaurantId !== restaurantId) {
    throw new Error("Unauthorized access to this loan session");
  }
  if (
    session.status !== LoanSessionStatus.ACTIVE &&
    session.status !== LoanSessionStatus.PARTIALLY_USED &&
    session.status !== LoanSessionStatus.FULLY_USED &&
    session.status !== LoanSessionStatus.OVERDUE
  ) {
    throw new Error(
      `This voucher cannot be repaid (status: ${session.status})`,
    );
  }
  if (session.outstandingAmount <= 0) {
    throw new Error("This voucher has no outstanding balance to pay");
  }

  const method = (paymentData.paymentMethod || "").toUpperCase();
  if (!["CASH", "MOBILE_MONEY", "CARD"].includes(method)) {
    throw new Error(`Unsupported payment method: ${method}`);
  }

  const amount = session.outstandingAmount;
  const txRef = `LR_${sessionId.slice(0, 8)}_${Date.now()}_${Math.floor(
    Math.random() * 1000,
  )}`;

  // PREPAID WALLET — debit immediately and confirm right away.
  if (method === "CASH") {
    const wallet = await getWalletByRestaurantIdService(restaurantId);
    if (!wallet.isActive) {
      throw new Error("Wallet is inactive. Please contact support.");
    }
    if (wallet.balance < amount) {
      throw new Error(
        `Insufficient wallet balance. Available: ${wallet.balance} ${wallet.currency}, Required: ${amount} RWF`,
      );
    }

    const walletDebitResult = await debitWalletService({
      walletId: wallet.id,
      amount,
      description: `Voucher repayment for session ${session.rrn}`,
      reference: txRef,
      restaurantId,
    });

    const payment = await prisma.$transaction(async (tx: any) => {
      const record = await tx.loanRepayment.create({
        data: {
          sessionId,
          amount,
          paymentMethod: method,
          paymentReference: txRef,
          phoneNumber: paymentData.phoneNumber,
          txRef,
          flwRef: `WALLET_${Date.now()}`,
          flwStatus: "successful",
          status: PaymentStatus.COMPLETED,
          confirmedAt: new Date(),
        },
      });
      await tx.loanRepayment.updateMany({
        where: { sessionId, id: { not: record.id } },
        data: { status: PaymentStatus.FAILED, flwStatus: "superseded" },
      });
      await settleLoanRepayment(tx, sessionId, amount);
      return record;
    });

    await notifyLoanRepaymentConfirmed(session, amount);

    return {
      success: true,
      status: "completed",
      payment,
      message: "Voucher repayment completed using your prepaid wallet",
      walletDetails: {
        previousBalance: walletDebitResult.transaction.previousBalance,
        newBalance: walletDebitResult.newBalance,
        transactionId: walletDebitResult.transaction.id,
      },
    };
  }

  // MOBILE_MONEY / CARD — record a pending repayment then initiate payment.
  const payment = await prisma.loanRepayment.create({
    data: {
      sessionId,
      amount,
      paymentMethod: method,
      paymentReference: paymentData.paymentReference,
      phoneNumber: paymentData.phoneNumber,
      txRef,
      status: PaymentStatus.PENDING,
    },
  });

  const email = session.restaurant?.email || "";
  const fullname = session.restaurant?.name || "";

  if (method === "MOBILE_MONEY") {
    const cleanedPhone = cleanPhoneNumber(paymentData.phoneNumber || "");
    if (!isValidRwandaPhone(cleanedPhone)) {
      throw new Error(
        "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX",
      );
    }
    try {
      const response = await getPaypack().cashin({
        number: cleanedPhone,
        amount,
        environment:
          process.env.NODE_ENV === "production" ? "production" : "development",
      });
      if (response?.data) {
        await retryDatabaseOperation(async () => {
          return await prisma.loanRepayment.update({
            where: { id: payment.id },
            data: {
              flwRef:
                response.data.ref ||
                response.data.transaction_id ||
                response.data.id,
              flwStatus: "pending",
            },
          });
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
      console.log(
        "PayPack repayment cashin failed, falling back to Flutterwave:",
        error.message,
      );
      const flwResult = await initiateFlutterwaveLoanRepayment({
        txRef,
        amount,
        email,
        fullname,
        currency: "RWF",
        paymentOptions: "mobilemoney",
        phoneNumber: cleanedPhone,
      });
      await retryDatabaseOperation(async () => {
        return await prisma.loanRepayment.update({
          where: { id: payment.id },
          data: { flwStatus: "pending_flutterwave" },
        });
      });
      return { ...flwResult, paymentId: payment.id, txRef };
    }
  }

  if (method === "CARD") {
    const flwResult = await initiateFlutterwaveLoanRepayment({
      txRef,
      amount,
      email,
      fullname,
      currency: "RWF",
      paymentOptions: "card",
      phoneNumber: session.restaurant?.phone || "",
    });
    await retryDatabaseOperation(async () => {
      return await prisma.loanRepayment.update({
        where: { id: payment.id },
        data: { flwStatus: "pending_flutterwave" },
      });
    });
    return { ...flwResult, paymentId: payment.id, txRef };
  }

  throw new Error(`Unsupported payment method: ${method}`);
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
