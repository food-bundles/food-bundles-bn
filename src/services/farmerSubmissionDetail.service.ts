import prisma from "../prisma";
import { siteForSubmission } from "./aggregationSite.service";

export type TimelineEvent =
  | "SUBMITTED"
  | "OFFER_RECEIVED"
  | "COUNTER_SENT"
  | "PRICE_AGREED"
  | "WEIGHED"
  | "PAID"
  | "REJECTED";

export interface TimelineEntry {
  event: TimelineEvent;
  at: Date;
}

// What a status change means to the farmer. Free-text notes and staff ids in the history rows are
// internal, so the farmer only ever gets these fixed events and their dates.
const eventFor = (from: string, to: string): TimelineEvent | null => {
  if (to === "NEGOTIATING") return "OFFER_RECEIVED";
  if (to === "PENDING") return from === "NEGOTIATING" ? "COUNTER_SENT" : null;
  if (to === "APPROVED") return "PRICE_AGREED";
  if (to === "VERIFIED") return "WEIGHED";
  if (to === "PAID") return "PAID";
  if (to === "REJECTED") return "REJECTED";
  return null;
};

/** One of the farmer's own submissions with its timeline, prices, payment and drop-off site. */
export async function getFarmerSubmissionDetail(farmerId: string, submissionId: string) {
  const s = await prisma.farmerSubmission.findFirst({
    where: { id: submissionId, farmerId },
    include: {
      aggregationSite: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payouts: { where: { status: "COMPLETED" }, orderBy: { confirmedAt: "desc" } },
    },
  });
  if (!s) return null;

  const timeline: TimelineEntry[] = [{ event: "SUBMITTED", at: s.submittedAt }];
  for (const row of s.statusHistory) {
    const event = eventFor(row.fromStatus, row.toStatus);
    if (event) timeline.push({ event, at: row.createdAt });
  }
  // Submissions that moved before history was recorded still show how far they got
  const seen = new Set(timeline.map((t) => t.event));
  if (s.status === "PAID" && !seen.has("PAID")) timeline.push({ event: "PAID", at: s.paidAt ?? s.updatedAt });
  if (s.status === "REJECTED" && !seen.has("REJECTED")) {
    timeline.push({ event: "REJECTED", at: s.rejectedAt ?? s.updatedAt });
  }

  const payout = s.payouts[0];
  const paid = s.status === "PAID";

  return {
    id: s.id,
    productName: s.productName,
    status: s.status,
    farmerFeedbackStatus: s.farmerFeedbackStatus,
    submittedQty: s.submittedQty,
    acceptedQty: s.acceptedQty,
    prices: {
      asked: s.wishedPrice,
      offered: s.counterOfferPrice,
      farmerCounter: s.farmerCounterOffer,
      agreed: s.agreedPrice ?? s.acceptedPrice,
    },
    totalAmount: s.totalAmount,
    rejectionReason: s.status === "REJECTED" ? s.rejectionReason : null,
    pickupPoint: s.pickupPoint,
    deliveryDate: s.deliveryDate,
    province: s.province,
    district: s.district,
    sector: s.sector,
    submittedAt: s.submittedAt,
    payment: paid
      ? {
          method: (payout?.method as "MOMO" | "CASH" | undefined) ?? (s.paymentMethod === "CASH" ? "CASH" : "MOMO"),
          amount: payout?.amount ?? s.totalAmount ?? 0,
          paidTo: payout?.method === "MOMO" ? payout.phoneNumber : null,
          paidAt: s.paidAt ?? payout?.confirmedAt ?? null,
        }
      : null,
    deliverySite: await siteForSubmission(farmerId, s).catch(() => null),
    timeline,
  };
}
