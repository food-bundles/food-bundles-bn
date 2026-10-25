import prisma from "../prisma";

export type PayMethod = "MOMO" | "CASH";

export interface ReportRecord {
  id: string;
  productName: string;
  /** Quantity bought (accepted quantity once weighed, otherwise what the farmer submitted) */
  quantity: number;
  status: string;
  farmerFeedbackStatus: string | null;
  /** Date the money moved (paid) or the harvest was submitted (everything else) */
  date: Date;
  /** What was paid, or what will be paid for an unpaid, agreed harvest */
  amount: number;
  /** How a PAID submission was paid, from its completed payout. Null until it is paid. */
  paymentMethod: PayMethod | null;
  /** Phone the MoMo payout went to */
  paidTo: string | null;
  aggregationSite: string | null;
}

export interface FarmerReport {
  /** Money that actually reached the farmer's Mobile Money, all time. This is the wallet. */
  wallet: { momoReceived: number; momoPayments: number };
  /** Agreed but not yet paid (approved or weighed). Not part of the wallet. */
  pending: { amount: number; count: number };
  /** Paid within the requested period, split by how it was paid */
  period: { paidMomo: number; paidCash: number; pending: number };
  records: ReportRecord[];
}

const price = (s: {
  agreedPrice: number | null;
  acceptedPrice: number | null;
  farmerCounterOffer: number | null;
  wishedPrice: number | null;
}) => s.agreedPrice ?? s.acceptedPrice ?? s.farmerCounterOffer ?? s.wishedPrice ?? 0;

/** Value of a submission: the recorded total once weighed, otherwise agreed price x quantity. */
const valueOf = (s: {
  totalAmount: number | null;
  acceptedQty: number | null;
  submittedQty: number | null;
  agreedPrice: number | null;
  acceptedPrice: number | null;
  farmerCounterOffer: number | null;
  wishedPrice: number | null;
}) => s.totalAmount || price(s) * (s.acceptedQty ?? s.submittedQty ?? 0);

export async function getFarmerReport(farmerId: string, from?: Date): Promise<FarmerReport> {
  const submissions = await prisma.farmerSubmission.findMany({
    where: { farmerId },
    include: {
      payouts: { where: { status: "COMPLETED" }, orderBy: { confirmedAt: "desc" } },
      aggregationSite: { select: { name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  let momoReceived = 0;
  let momoPayments = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  const period = { paidMomo: 0, paidCash: 0, pending: 0 };
  const records: ReportRecord[] = [];

  for (const s of submissions) {
    const payout = s.payouts[0];
    const paid = s.status === "PAID";
    const method: PayMethod | null = paid
      ? ((payout?.method as PayMethod | undefined) ?? (s.paymentMethod === "CASH" ? "CASH" : "MOMO"))
      : null;
    const amount = paid ? payout?.amount ?? valueOf(s) : s.status === "REJECTED" ? 0 : valueOf(s);
    const date = paid ? s.paidAt ?? payout?.confirmedAt ?? s.submittedAt : s.submittedAt;

    // Wallet = every completed Mobile Money payout, whatever the period
    if (paid && method === "MOMO") {
      momoReceived += amount;
      momoPayments++;
    }

    // Pending = agreed, not paid yet. Offers still being negotiated are not promised money.
    const isPending = s.status === "APPROVED" || s.status === "VERIFIED";
    if (isPending) {
      pendingAmount += amount;
      pendingCount++;
    }

    if (from && date < from) continue;
    if (paid && method === "MOMO") period.paidMomo += amount;
    if (paid && method === "CASH") period.paidCash += amount;
    if (isPending) period.pending += amount;

    records.push({
      id: s.id,
      productName: s.productName,
      quantity: s.acceptedQty ?? s.submittedQty ?? 0,
      status: s.status,
      farmerFeedbackStatus: s.farmerFeedbackStatus,
      date,
      amount,
      paymentMethod: method,
      paidTo: method === "MOMO" ? payout?.phoneNumber ?? null : null,
      aggregationSite: s.aggregationSite?.name ?? null,
    });
  }

  records.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    wallet: { momoReceived, momoPayments },
    pending: { amount: pendingAmount, count: pendingCount },
    period,
    records,
  };
}
