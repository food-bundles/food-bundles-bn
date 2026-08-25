import prisma from "../prisma";
import { CardStatus, LoanSessionStatus, UnlockStatus, PaymentStatus } from "@prisma/client";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import { wsManager } from "../index";

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
// LOAN SESSION — REQUEST
// ============================================

export const requestLoanSessionService = async (
  restaurantId: string,
  data: { requestedAmount: number; purpose?: string; repaymentDays?: number },
) => {
  const { requestedAmount, purpose, repaymentDays } = data;

  if (requestedAmount <= 0) throw new Error("Requested amount must be greater than zero");

  const card = await prisma.voucherCard.findUnique({ where: { restaurantId } });
  if (!card) throw new Error("No voucher card found. Request a card first.");
  if (card.status !== CardStatus.ACTIVE) throw new Error(`Card is ${card.status}`);

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
    message: `${restaurant?.name} requested a loan of ${requestedAmount.toLocaleString()} RWF (RRN: ${rrn})`,
    eventType: "VOUCHER_APPLIED",
    targetType: "ROLE_BASED",
    targetRole: "ADMIN",
    metadata: { sessionId: session.id, rrn, requestedAmount },
  });

  try {
    await sendMessage(
      `New loan request: ${restaurant?.name} — ${requestedAmount.toLocaleString()} RWF. RRN: ${rrn}`,
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

export const approveLoanSessionService = async (
  sessionId: string,
  adminId: string,
  data: {
    approvedAmount: number;
    approvalPercentage?: number;
    repaymentDays: number;
    notes?: string;
    fundingTraderId?: string;
  },
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: { restaurant: true },
  });
  if (!session) throw new Error("Loan session not found");
  if (session.status !== LoanSessionStatus.REQUESTED) {
    throw new Error(`Cannot approve session with status: ${session.status}`);
  }

  const DEFAULT_UNLOCK_FEE_PCT = parseFloat(process.env.VOUCHER_UNLOCK_FEE_PCT ?? "4.5");
  const unlockFee = data.approvedAmount * (DEFAULT_UNLOCK_FEE_PCT / 100);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + data.repaymentDays);

  const updated = await prisma.loanSession.update({
    where: { id: sessionId },
    data: {
      approvedAmount: data.approvedAmount,
      approvalPercentage: data.approvalPercentage ?? 100,
      unlockFeePercentage: DEFAULT_UNLOCK_FEE_PCT,
      unlockFee,
      repaymentDays: data.repaymentDays,
      dueDate,
      notes: data.notes,
      fundingTraderId: data.fundingTraderId,
      approvedBy: adminId,
      approvedAt: new Date(),
      status: LoanSessionStatus.APPROVED_LOCKED,
      unlockStatus: UnlockStatus.LOCKED,
      outstandingAmount: data.approvedAmount,
    },
    include: {
      restaurant: { select: { id: true, name: true, email: true, phone: true } },
      approver: { select: { id: true, username: true } },
    },
  });

  await createNotificationService({
    title: "Loan Approved — Unlock Fee Required",
    message: `Your loan of ${data.approvedAmount.toLocaleString()} RWF has been approved. Pay unlock fee of ${unlockFee.toLocaleString()} RWF to activate.`,
    eventType: "VOUCHER_ISSUED",
    targetType: "SPECIFIC_USER",
    targetId: session.restaurantId,
    metadata: { sessionId, unlockFee, approvedAmount: data.approvedAmount },
  });

  try {
    if (updated.restaurant.phone) {
      await sendMessage(
        `Dear ${updated.restaurant.name}, your loan of ${data.approvedAmount.toLocaleString()} RWF is approved. Pay unlock fee of ${unlockFee.toLocaleString()} RWF to activate. RRN: ${updated.rrn}`,
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
      data: { approvedAmount: data.approvedAmount, status: updated.status },
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
// UNLOCK FEE PAYMENT
// ============================================

export const payUnlockFeeService = async (
  sessionId: string,
  restaurantId: string,
  paymentData: { paymentMethod: string; paymentReference?: string; phoneNumber?: string },
) => {
  const session = await prisma.loanSession.findUnique({
    where: { id: sessionId },
    include: { restaurant: true },
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

  // Create payment record (PENDING — in production, initiate real payment here)
  const payment = await prisma.unlockFeePayment.create({
    data: {
      sessionId,
      amount: session.unlockFee,
      paymentMethod: paymentData.paymentMethod,
      paymentReference: paymentData.paymentReference,
      phoneNumber: paymentData.phoneNumber,
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

  // TODO: In production, initiate real payment (Flutterwave/Paypack) here
  // and only call confirmUnlockFeePaymentService on webhook confirmation.
  // For now, auto-confirm to unblock frontend development.
  const confirmed = await confirmUnlockFeePaymentService(payment.id, sessionId);
  return confirmed;
};

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
        card: { select: { id: true, pan: true } },
        unlockPayments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.loanSession.count({ where }),
  ]);

  return {
    data: sessions,
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
      card: { select: { id: true, pan: true } },
      unlockPayments: { orderBy: { createdAt: "desc" } },
      authorizations: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) throw new Error("Loan session not found");
  return session;
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
    unlockFeePct: parseFloat(process.env.VOUCHER_UNLOCK_FEE_PCT ?? "4.5"),
    minQualifyingOrders: parseInt(process.env.VOUCHER_MIN_QUALIFYING_ORDERS ?? "5"),
  };
};
