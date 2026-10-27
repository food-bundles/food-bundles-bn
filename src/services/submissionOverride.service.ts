import prisma from "../prisma";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";

/**
 * Force-completes a submission on admin authority, bypassing the wait for
 * farmer feedback. Mirrors approveSubmissionService's product-quantity
 * increment (productService.ts) since no productId is available here — if a
 * caller already has a productId, prefer updateProductQuantityFromSubmissionService
 * instead, which links approvedProductId properly via a transaction.
 */
export const forceCompleteSubmissionService = async (
  submissionId: string,
  adminId: string,
  reason?: string
) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status === "APPROVED" || submission.status === "PAID") {
    throw new Error("Submission is already approved or paid");
  }

  if (submission.acceptedQty === null || submission.acceptedPrice === null) {
    throw new Error(
      "Submission must be verified (accepted quantity and price set) before it can be force-completed"
    );
  }

  const fromStatus = submission.status;

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const updated = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        farmerFeedbackStatus: "ACCEPTED",
        farmerFeedbackAt: submission.farmerFeedbackAt ?? new Date(),
        status: "APPROVED",
        approvedAt: new Date(),
      },
      include: {
        farmer: { select: { id: true, phone: true } },
      },
    });

    const existingProduct = await tx.product.findUnique({
      where: { productName: submission.productName },
    });

    if (existingProduct) {
      await tx.product.update({
        where: { productName: submission.productName },
        data: { quantity: { increment: submission.acceptedQty ?? 0 } },
      });
    }

    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        fromStatus,
        toStatus: "APPROVED",
        reason: reason || "Force-completed by admin",
        changedBy: adminId,
      },
    });

    return updated;
  });

  try {
    await createNotificationService({
      title: "Submission Force-Completed",
      message: `Your submission of ${submission.productName} was marked complete by an administrator.`,
      eventType: "SUBMISSION_FORCE_COMPLETED",
      targetType: "SPECIFIC_USER",
      targetId: updatedSubmission.farmerId,
      metadata: { submissionId, reason },
    });
  } catch (notifError) {
    console.error("Failed to create submission-force-completed notification:", notifError);
  }

  try {
    if (updatedSubmission.farmer?.phone) {
      await sendMessage(
        `Your submission of ${submission.productName} was marked complete and will be paid out soon.`,
        updatedSubmission.farmer.phone,
      );
    }
  } catch (smsError) {
    console.error("Failed to send submission-force-completed SMS:", smsError);
  }

  return updatedSubmission;
};

// Flow order: PENDING → APPROVED → VERIFIED → PAID (plus NEGOTIATING / REJECTED)
const VALID_STATUSES = ["PENDING", "NEGOTIATING", "APPROVED", "VERIFIED", "PAID", "REJECTED"] as const;
type SubmissionStatusValue = (typeof VALID_STATUSES)[number];

/**
 * General-purpose admin status reversal. Unlike clearSubmissionService
 * (always resets to PENDING), this allows reversing to any prior status and
 * always writes an audit row. Kept separate from clearSubmissionService,
 * which remains unchanged and in use elsewhere.
 */
export const reverseSubmissionStatusService = async (
  submissionId: string,
  toStatus: SubmissionStatusValue,
  adminId: string,
  reason?: string
) => {
  if (!VALID_STATUSES.includes(toStatus)) {
    throw new Error(`Invalid target status: ${toStatus}`);
  }

  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  const fromStatus = submission.status;

  if (toStatus === fromStatus) {
    throw new Error(
      `Submission is already ${fromStatus}; choose a different target status to reverse it`
    );
  }

  const data: Record<string, unknown> = { status: toStatus };

  // Null out fields inconsistent with the target status, preserving what's
  // still valid (e.g. reversing APPROVED -> VERIFIED keeps acceptedQty/Price
  // but clears the approval-specific fields).
  // Moving back clears what the later stages recorded (new order:
  // PENDING → APPROVED → VERIFIED → PAID)
  if (toStatus === "PENDING" || toStatus === "NEGOTIATING") {
    data.acceptedQty = null;
    data.acceptedPrice = null;
    data.totalAmount = null;
    data.aggregatorId = null;
    data.verifiedAt = null;
    data.approvedAt = null;
    data.agreedPrice = null;
    data.approvedProductId = null;
    data.paidAt = null;
    data.rejectedAt = null;
    data.rejectionReason = null;
    if (toStatus === "PENDING") data.counterOfferPrice = null;
  } else if (toStatus === "APPROVED") {
    data.acceptedQty = null;
    data.acceptedPrice = null;
    data.totalAmount = null;
    data.verifiedAt = null;
    data.paidAt = null;
    data.rejectedAt = null;
    data.rejectionReason = null;
  } else if (toStatus === "VERIFIED") {
    data.paidAt = null;
  }

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const updated = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data,
      include: { farmer: { select: { id: true, phone: true } } },
    });

    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        fromStatus,
        toStatus,
        reason: reason || null,
        changedBy: adminId,
      },
    });

    return updated;
  });

  // Notify the farmer their submission status was changed — isolated so a
  // notification failure can never affect the already-committed reversal.
  try {
    await createNotificationService({
      title: "Submission Status Updated",
      message: `Your submission of ${submission.productName} was reverted from ${fromStatus} to ${toStatus} by an administrator.${reason ? ` Reason: ${reason}` : ""}`,
      eventType: "SUBMISSION_STATUS_REVERSED",
      targetType: "SPECIFIC_USER",
      targetId: updatedSubmission.farmerId,
      metadata: { submissionId, fromStatus, toStatus, reason },
    });
  } catch (notifError) {
    console.error("Failed to create submission-reversed notification:", notifError);
  }

  try {
    if (updatedSubmission.farmer?.phone) {
      await sendMessage(
        `Your submission of ${submission.productName} was updated from ${fromStatus} to ${toStatus}.${reason ? ` Reason: ${reason}` : ""}`,
        updatedSubmission.farmer.phone,
      );
    }
  } catch (smsError) {
    console.error("Failed to send submission-reversed SMS:", smsError);
  }

  return updatedSubmission;
};

export const getSubmissionStatusHistoryService = async (
  submissionId: string
) => {
  return prisma.submissionStatusHistory.findMany({
    where: { submissionId },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Admin-side rejection of a VERIFIED offer, independent of the farmer's own
 * feedback flow (submitFarmerFeedbackService). Lets an admin close out an
 * offer the farmer appears unresponsive to, or that is being withdrawn.
 */
export const rejectSubmissionService = async (
  submissionId: string,
  adminId: string,
  reason?: string
) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status === "APPROVED" || submission.status === "PAID") {
    throw new Error("Cannot reject a submission that is already approved or paid");
  }

  const updatedSubmission = await prisma.$transaction(async (tx) => {
    const updated = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        farmerFeedbackStatus: "REJECTED",
        farmerFeedbackAt: new Date(),
        farmerFeedbackNotes: reason || submission.farmerFeedbackNotes,
      },
      include: { farmer: { select: { id: true, phone: true } } },
    });

    // This rejects the farmer's offer feedback, not the submission's own
    // status field (still `submission.status`), so the audit row records
    // that distinction instead of a misleading no-op fromStatus===toStatus.
    await tx.submissionStatusHistory.create({
      data: {
        submissionId,
        fromStatus: submission.farmerFeedbackStatus || "PENDING",
        toStatus: "REJECTED",
        reason: reason || "Rejected by admin",
        changedBy: adminId,
      },
    });

    return updated;
  });

  // Notify the farmer of the rejection — isolated so a notification failure
  // can never affect the already-committed rejection.
  try {
    await createNotificationService({
      title: "Submission Rejected",
      message: `Your submission of ${submission.productName} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
      eventType: "SUBMISSION_REJECTED",
      targetType: "SPECIFIC_USER",
      targetId: updatedSubmission.farmerId,
      metadata: { submissionId, reason },
    });
  } catch (notifError) {
    console.error("Failed to create submission-rejected notification:", notifError);
  }

  try {
    if (updatedSubmission.farmer?.phone) {
      await sendMessage(
        `Your submission of ${submission.productName} was rejected.${reason ? ` Reason: ${reason}` : ""}`,
        updatedSubmission.farmer.phone,
      );
    }
  } catch (smsError) {
    console.error("Failed to send submission-rejected SMS:", smsError);
  }

  return updatedSubmission;
};

export const deleteSubmissionService = async (submissionId: string) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status === "APPROVED" || submission.status === "PAID") {
    throw new Error(
      "Cannot delete a submission that is already approved or paid"
    );
  }

  await prisma.farmerSubmission.delete({ where: { id: submissionId } });
  return { id: submissionId };
};
