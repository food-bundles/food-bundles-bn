import prisma from "../prisma";
import { cleanPhoneNumber, isValidRwandaPhone } from "../utils/emailTemplates";
import { createNotificationService } from "./notification.services";

// Payment client - lazy initialized to ensure env vars are loaded
let _paypack: any = null;

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

/**
 * Look up the real status of a PayPack cashout via the PayPack events API.
 * Mirrors wallet.service.ts's getPaypackTransactionStatus (cashin equivalent) —
 * the `transaction(ref)` endpoint never includes a `status` field, so it must
 * never be used alone to decide success.
 */
async function getPaypackCashoutStatus(paypackRef: string) {
  try {
    const res: any = await getPaypack().events({ ref: paypackRef });
    const txs: any[] = res?.data?.transactions;
    if (Array.isArray(txs) && txs.length) {
      const applicable = txs
        .filter((t) => t && t.data && typeof t.data.status === "string")
        .sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
        );
      const latest = applicable[0];
      if (latest?.data) {
        return {
          status: latest.data.status as string | undefined,
          ref: latest.data.ref || paypackRef,
        };
      }
    }
  } catch (e: any) {
    console.log("PayPack events lookup failed:", e.message);
  }
  try {
    const tx: any = await getPaypack().transaction(paypackRef);
    if (tx?.data?.ref) return { status: tx.data.status, ref: tx.data.ref };
  } catch (e: any) {
    console.log("PayPack transaction lookup failed:", e.message);
  }
  return { status: undefined, ref: paypackRef };
}

export const initiateSubmissionPayoutService = async (
  submissionId: string,
  phoneNumber: string,
  initiatedBy: string
) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: { farmer: { select: { id: true, phone: true } } },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "APPROVED") {
    throw new Error("Only APPROVED submissions can be paid out");
  }

  if (!submission.totalAmount || submission.totalAmount <= 0) {
    throw new Error("Submission has no payable amount");
  }

  const existingPayout = await prisma.submissionPayout.findFirst({
    where: {
      submissionId,
      status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
    },
  });

  if (existingPayout) {
    throw new Error(
      "A payout for this submission already exists or is in progress"
    );
  }

  const cleanedPhoneNumber = cleanPhoneNumber(phoneNumber);
  if (!isValidRwandaPhone(cleanedPhoneNumber)) {
    throw new Error(
      "Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX"
    );
  }

  const payout = await prisma.submissionPayout.create({
    data: {
      submissionId,
      amount: submission.totalAmount,
      phoneNumber: cleanedPhoneNumber,
      initiatedBy,
      status: "PENDING",
    },
  });

  try {
    const response = await getPaypack().cashout({
      number: cleanedPhoneNumber,
      amount: submission.totalAmount,
      environment:
        process.env.NODE_ENV === "production" ? "production" : "development",
    });

    if (!response || !response.data) {
      throw new Error("PayPack response invalid or missing reference");
    }

    const updatedPayout = await prisma.submissionPayout.update({
      where: { id: payout.id },
      data: {
        paypackRef: response.data.ref,
        paypackStatus: response.data.status,
        status: "PROCESSING",
      },
    });

    return updatedPayout;
  } catch (error: any) {
    await prisma.submissionPayout.update({
      where: { id: payout.id },
      data: { status: "FAILED" },
    });
    throw new Error(
      `PayPack cashout failed: ${error.message || "unknown error"}`
    );
  }
};

export const confirmSubmissionPayoutService = async (
  submissionId: string,
  payoutId: string,
  outcome: "COMPLETED" | "FAILED"
) => {
  const payout = await prisma.submissionPayout.findUnique({
    where: { id: payoutId },
  });

  if (!payout || payout.submissionId !== submissionId) {
    throw new Error("Payout not found for this submission");
  }

  if (payout.status === "COMPLETED" || payout.status === "FAILED") {
    throw new Error("This payout has already been confirmed");
  }

  let liveStatus: string | undefined;
  if (payout.paypackRef) {
    const lookup = await getPaypackCashoutStatus(payout.paypackRef);
    liveStatus = lookup.status;
  }

  const updatedPayout = await prisma.submissionPayout.update({
    where: { id: payoutId },
    data: {
      status: outcome,
      paypackStatus: liveStatus || payout.paypackStatus,
      confirmedAt: new Date(),
    },
  });

  if (outcome === "COMPLETED") {
    const submission = await prisma.farmerSubmission.update({
      where: { id: submissionId },
      data: { status: "PAID", paidAt: new Date() },
    });

    await createNotificationService({
      title: "Submission Paid",
      message: `Your submission of ${submission.productName} has been paid out.`,
      eventType: "SUBMISSION_PAID",
      targetType: "SPECIFIC_USER",
      targetId: submission.farmerId,
      metadata: {
        submissionId: submission.id,
        payoutId: updatedPayout.id,
        amount: updatedPayout.amount,
      },
    });
  }

  return updatedPayout;
};

export const getSubmissionPayoutsService = async (submissionId: string) => {
  return prisma.submissionPayout.findMany({
    where: { submissionId },
    orderBy: { createdAt: "desc" },
  });
};
