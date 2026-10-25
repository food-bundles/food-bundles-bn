import prisma from "../prisma";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import { fulfillSupplyRequestSubmission, requestPriceFor } from "./supply-request.service";

/**
 * Farmer submission flow — one stage at a time:
 *
 *   PENDING (submitted)
 *     → price decision: the price ≥ what the farmer asks → APPROVED
 *                       the price <  what the farmer asks → NEGOTIATING (counter offer)
 *   NEGOTIATING → farmer accepts → APPROVED · declines → REJECTED · counters → PENDING
 *   APPROVED (price agreed) → verify face to face (weigh, record qty) → VERIFIED
 *   VERIFIED → pay (MoMo payout or cash) → PAID (counts as an expense)
 *
 * PENDING, NEGOTIATING and APPROVED can also be REJECTED.
 *
 * The starting price is the Food Bundles buying price of the product (its
 * purchase price in stock). Only users with "Set price" may use another price.
 */

export class SubmissionFlowError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const notifyFarmer = async (
  submission: { id: string; farmerId: string; productName: string },
  title: string,
  message: string,
  eventType: string,
  phone?: string | null,
) => {
  try {
    await createNotificationService({
      title,
      message,
      eventType,
      targetType: "SPECIFIC_USER",
      targetId: submission.farmerId,
      metadata: { submissionId: submission.id, productName: submission.productName },
    });
  } catch (error) {
    console.error(`Failed to create ${eventType} notification:`, error);
  }
  if (phone) {
    try {
      await sendMessage(`FoodBundles: ${message}`, phone);
    } catch (error) {
      console.error(`Failed to send ${eventType} SMS:`, error);
    }
  }
};

const rwf = (value: number) => `${Math.round(value).toLocaleString()} RWF`;

/** Food Bundles buying price for a product (its purchase price in stock), or null. */
export const getFoodBundlesPrice = async (productName: string) => {
  const product = await prisma.product.findUnique({
    where: { productName },
    select: { purchasePrice: true },
  });
  return product && product.purchasePrice > 0 ? product.purchasePrice : null;
};

/**
 * Price both sides agreed. Submissions approved before the new flow kept it
 * in acceptedPrice (or only the farmer's price), so fall back to those.
 */
export const agreedPriceOf = (submission: {
  agreedPrice: number | null;
  acceptedPrice: number | null;
  farmerCounterOffer: number | null;
  wishedPrice: number | null;
}) =>
  submission.agreedPrice ?? submission.acceptedPrice ?? submission.farmerCounterOffer ?? submission.wishedPrice ?? 0;

/** What the farmer currently asks per unit (their latest counter, else the original). */
export const askedPrice = (submission: { wishedPrice: number | null; farmerCounterOffer: number | null }) =>
  submission.farmerCounterOffer ?? submission.wishedPrice ?? 0;

const loadSubmission = async (submissionId: string) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: { farmer: { select: { id: true, phone: true, name: true } } },
  });
  if (!submission) throw new SubmissionFlowError("Submission not found", 404);
  return submission;
};

const writeHistory = (
  tx: any,
  submissionId: string,
  fromStatus: string,
  toStatus: string,
  changedBy: string,
  reason?: string | null,
) =>
  tx.submissionStatusHistory.create({
    data: { submissionId, fromStatus, toStatus, changedBy, reason: reason || null },
  });

/** Prices shown when deciding: the farmer's asking price and the Food Bundles price. */
export const getPriceContext = async (submissionId: string) => {
  const submission = await loadSubmission(submissionId);
  // Submissions to a supply request use the request price as the reference
  const foodBundlesPrice =
    (await requestPriceFor(submission)) ?? (await getFoodBundlesPrice(submission.productName));
  return {
    submissionId,
    status: submission.status,
    askedPrice: askedPrice(submission),
    originalPrice: submission.wishedPrice,
    foodBundlesPrice,
    agreedPrice: submission.agreedPrice,
    counterOfferPrice: submission.counterOfferPrice,
  };
};

/**
 * Stage 2 — decide the price of a submitted (PENDING) product.
 * The price is the Food Bundles price unless the actor may set prices.
 * At or above what the farmer asks → APPROVED; below → counter offer.
 */
export const decideSubmissionPrice = async (
  submissionId: string,
  actorId: string,
  options: { price?: number; canSetPrice: boolean },
) => {
  const submission = await loadSubmission(submissionId);
  if (submission.status !== "PENDING") {
    throw new SubmissionFlowError(
      submission.status === "NEGOTIATING"
        ? "A counter-offer was already sent to the farmer"
        : "Only submitted (pending) products can be approved",
    );
  }

  // Submissions to a supply request use the request price as the reference
  const foodBundlesPrice =
    (await requestPriceFor(submission)) ?? (await getFoodBundlesPrice(submission.productName));
  let price = foodBundlesPrice;
  if (options.price !== undefined && options.price !== null) {
    if (!options.canSetPrice) {
      throw new SubmissionFlowError("You can't change the price; the Food Bundles price is used", 403);
    }
    price = Number(options.price);
  }
  if (!price || !Number.isFinite(price) || price <= 0) {
    throw new SubmissionFlowError(
      "This product has no Food Bundles price in stock yet. Someone allowed to set prices must enter one.",
    );
  }

  const asked = askedPrice(submission);
  const approve = price >= asked;
  const toStatus = approve ? "APPROVED" : "NEGOTIATING";

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: approve
        ? {
            status: "APPROVED",
            agreedPrice: price,
            foodBundlesPrice,
            counterOfferPrice: null,
            approvedAt: new Date(),
            farmerFeedbackStatus: "ACCEPTED",
          }
        : {
            status: "NEGOTIATING",
            counterOfferPrice: price,
            foodBundlesPrice,
            negotiatedAt: new Date(),
            farmerFeedbackStatus: "PENDING",
            farmerFeedbackAt: null,
          },
    });
    await writeHistory(
      tx,
      submissionId,
      submission.status,
      toStatus,
      actorId,
      approve
        ? `Approved at ${rwf(price)} per unit (farmer asked ${rwf(asked)})`
        : `Counter offer ${rwf(price)} (farmer asked ${rwf(asked)})`,
    );
    return result;
  });

  if (approve) {
    await notifyFarmer(
      submission,
      "Submission Approved",
      `Your ${submission.submittedQty ?? ""} ${submission.productName} is approved at ${rwf(price)} per unit. We will meet you to weigh and receive it.`,
      "SUBMISSION_APPROVED",
      submission.farmer?.phone,
    );
  } else {
    await notifyFarmer(
      submission,
      "Counter Offer",
      `We can buy your ${submission.productName} at ${rwf(price)} per unit (you asked ${rwf(asked)}). Open the FoodBundles app to accept or decline.`,
      "SUBMISSION_COUNTER_OFFER",
      submission.farmer?.phone,
    );
  }
  return updated;
};

/**
 * The farmer answers a counter offer: accept → APPROVED at the offer,
 * decline → REJECTED, counter → back to PENDING with their new price.
 */
export const answerCounterOffer = async (
  submissionId: string,
  farmerId: string,
  answer: { decision: "ACCEPT" | "DECLINE" | "COUNTER"; counterPrice?: number; notes?: string },
) => {
  const submission = await loadSubmission(submissionId);
  if (submission.farmerId !== farmerId) {
    throw new SubmissionFlowError("You can only answer offers on your own submissions", 403);
  }
  if (submission.status !== "NEGOTIATING" || !submission.counterOfferPrice) {
    throw new SubmissionFlowError("There is no offer waiting for your answer");
  }

  const offer = submission.counterOfferPrice;
  let data: Record<string, unknown>;
  let toStatus: string;
  let message: string;

  if (answer.decision === "ACCEPT") {
    toStatus = "APPROVED";
    data = {
      status: "APPROVED",
      agreedPrice: offer,
      approvedAt: new Date(),
      farmerFeedbackStatus: "ACCEPTED",
      farmerFeedbackAt: new Date(),
      farmerFeedbackNotes: answer.notes || null,
    };
    message = `Farmer accepted ${rwf(offer)} for ${submission.productName}. Ready to verify (weigh).`;
  } else if (answer.decision === "DECLINE") {
    toStatus = "REJECTED";
    data = {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: answer.notes || "Farmer declined the counter offer",
      farmerFeedbackStatus: "REJECTED",
      farmerFeedbackAt: new Date(),
      farmerFeedbackNotes: answer.notes || null,
    };
    message = `Farmer declined ${rwf(offer)} for ${submission.productName}.`;
  } else {
    const counter = Number(answer.counterPrice);
    if (!Number.isFinite(counter) || counter <= 0) {
      throw new SubmissionFlowError("Enter the price you want per unit");
    }
    toStatus = "PENDING";
    data = {
      status: "PENDING",
      farmerCounterOffer: counter,
      counterOfferPrice: null,
      farmerFeedbackStatus: "EXTENDED",
      farmerFeedbackAt: new Date(),
      farmerFeedbackNotes: answer.notes || null,
    };
    message = `Farmer asks ${rwf(counter)} for ${submission.productName} (offer was ${rwf(offer)}). Review the new price.`;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.farmerSubmission.update({ where: { id: submissionId }, data });
    await writeHistory(tx, submissionId, submission.status, toStatus, farmerId, answer.notes || message);
    return result;
  });

  try {
    await createNotificationService({
      title: "Farmer answered the offer",
      message,
      eventType: "SUBMISSION_FEEDBACK_RECEIVED",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: { submissionId, decision: answer.decision },
    });
  } catch (error) {
    console.error("Failed to notify admins of the farmer's answer:", error);
  }
  return updated;
};

/**
 * Stage 3 — verify face to face: record the quantity received and the price
 * per unit (the agreed price unless the actor may set prices). Adds the
 * quantity to the product's stock.
 */
export const verifySubmission = async (
  submissionId: string,
  actorId: string,
  options: { quantity: number; price?: number; canSetPrice: boolean },
) => {
  const submission = await loadSubmission(submissionId);
  if (submission.status !== "APPROVED") {
    throw new SubmissionFlowError("Only approved submissions can be verified");
  }

  const quantity = Number(options.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new SubmissionFlowError("Enter the quantity received");
  }
  if (submission.submittedQty !== null && quantity > submission.submittedQty) {
    throw new SubmissionFlowError(
      `Quantity received can't be more than the ${submission.submittedQty} submitted`,
    );
  }

  let price = agreedPriceOf(submission);
  if (options.price !== undefined && options.price !== null && Number(options.price) !== price) {
    if (!options.canSetPrice) {
      throw new SubmissionFlowError("You can't change the agreed price", 403);
    }
    price = Number(options.price);
  }
  if (!price || price <= 0) {
    throw new SubmissionFlowError("This submission has no agreed price");
  }
  const totalAmount = Math.round(quantity * price * 100) / 100;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        status: "VERIFIED",
        acceptedQty: quantity,
        acceptedPrice: price,
        totalAmount,
        aggregatorId: actorId,
        verifiedAt: new Date(),
      },
    });
    // Goods received: add them to stock (no-op when the product isn't in stock yet)
    await tx.product.updateMany({
      where: { productName: submission.productName },
      data: { quantity: { increment: quantity } },
    });
    await writeHistory(
      tx,
      submissionId,
      submission.status,
      "VERIFIED",
      actorId,
      `Received ${quantity} at ${rwf(price)} = ${rwf(totalAmount)}`,
    );
    return result;
  });

  await notifyFarmer(
    submission,
    "Produce Received",
    `We received ${quantity} ${submission.productName} at ${rwf(price)} each. Total ${rwf(totalAmount)} will be paid to you.`,
    "SUBMISSION_VERIFIED",
    submission.farmer?.phone,
  );
  return updated;
};

/**
 * Stage 4 (cash) — the farmer was paid by hand. Records the payout and marks
 * the submission PAID, which adds it to Food Bundles' expenses.
 */
export const markSubmissionPaidInCash = async (submissionId: string, actorId: string) => {
  const submission = await loadSubmission(submissionId);
  if (submission.status !== "VERIFIED") {
    throw new SubmissionFlowError("Only verified submissions can be paid");
  }
  if (!submission.totalAmount || submission.totalAmount <= 0) {
    throw new SubmissionFlowError("This submission has no amount to pay");
  }
  const active = await prisma.submissionPayout.findFirst({
    where: { submissionId, status: { in: ["PENDING", "PROCESSING", "COMPLETED"] } },
  });
  if (active) {
    throw new SubmissionFlowError("A payment for this submission is already recorded or in progress");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.submissionPayout.create({
      data: {
        submissionId,
        amount: submission.totalAmount!,
        phoneNumber: submission.farmer?.phone || "CASH",
        initiatedBy: actorId,
        method: "CASH",
        status: "COMPLETED",
        confirmedAt: new Date(),
      },
    });
    const result = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: { status: "PAID", paidAt: new Date(), paymentMethod: "CASH" },
    });
    await writeHistory(tx, submissionId, "VERIFIED", "PAID", actorId, `Paid ${rwf(submission.totalAmount!)} in cash`);
    return result;
  });

  await notifyFarmer(
    submission,
    "Payment Received",
    `Paid ${rwf(submission.totalAmount)} for ${submission.acceptedQty} ${submission.productName}. Thank you!`,
    "SUBMISSION_PAID",
    submission.farmer?.phone,
  );
  // Bought for a customer's supply request: goes into their order for that day
  await fulfillPaidRequestSubmission(submissionId);
  return updated;
};

/** Paid submission from a supply request → the customer's order (never blocks the payment). */
export const fulfillPaidRequestSubmission = async (submissionId: string) => {
  try {
    await fulfillSupplyRequestSubmission(submissionId);
  } catch (error) {
    console.error("Failed to add the paid submission to the customer's order:", error);
  }
};

/** Close a submission without buying (allowed before it is verified). */
export const rejectSubmissionFlow = async (submissionId: string, actorId: string, reason?: string) => {
  const submission = await loadSubmission(submissionId);
  if (!["PENDING", "NEGOTIATING", "APPROVED"].includes(submission.status)) {
    throw new SubmissionFlowError(
      submission.status === "REJECTED"
        ? "This submission is already rejected"
        : "Verified or paid submissions can't be rejected",
    );
  }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: reason || null,
        farmerFeedbackStatus: "REJECTED",
      },
    });
    await writeHistory(tx, submissionId, submission.status, "REJECTED", actorId, reason || "Rejected");
    return result;
  });
  await notifyFarmer(
    submission,
    "Submission Rejected",
    `Sorry, we cannot buy your ${submission.productName} this time.${reason ? ` Reason: ${reason}` : ""}`,
    "SUBMISSION_REJECTED",
    submission.farmer?.phone,
  );
  return updated;
};
