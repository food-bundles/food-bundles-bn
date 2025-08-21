import { FarmerFeedbackStatus, SubmissionStatus } from "@prisma/client";
import { IPaginationOptions } from "../types/productVerifyTypes";
import { PaginationService } from "./paginationService";
import { sendMessage } from "../utils/sms.utility";
import prisma from "../prisma";

// Interface for farmer feedback request
export interface IFarmerFeedbackRequest {
  feedbackStatus: FarmerFeedbackStatus;
  notes?: string;
  counterOffer?: number;
  counterQty?: number;
}

// Service to handle farmer feedback on verified submissions
export const submitFarmerFeedbackService = async (
  submissionId: string,
  farmerId: string,
  feedbackData: IFarmerFeedbackRequest
) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          phone: true,
          username: true,
        },
      },
    },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  // Verify farmer owns this submission
  if (existingSubmission.farmerId !== farmerId) {
    throw new Error("You can only provide feedback on your own submissions");
  }

  // Check if submission is verified (ready for farmer feedback)
  if (existingSubmission.status !== "VERIFIED") {
    throw new Error("Can only provide feedback on VERIFIED submissions");
  }

  // Check if feedback deadline has passed (if set)
  if (
    existingSubmission.feedbackDeadline &&
    new Date() > existingSubmission.feedbackDeadline
  ) {
    throw new Error("Feedback deadline has passed");
  }

  // Check if farmer has already provided feedback
  if (
    existingSubmission.farmerFeedbackStatus &&
    existingSubmission.farmerFeedbackStatus !== "PENDING"
  ) {
    throw new Error("Feedback has already been submitted for this purchase");
  }

  // Validate counter offers if provided
  if (feedbackData.feedbackStatus === "EXTENDED") {
    if (feedbackData.counterOffer && feedbackData.counterOffer <= 0) {
      throw new Error("Counter offer price must be positive");
    }
    if (
      feedbackData.counterQty &&
      (feedbackData.counterQty <= 0 ||
        feedbackData.counterQty > existingSubmission.submittedQty!)
    ) {
      throw new Error(
        "Counter offer quantity must be positive and not exceed submitted quantity"
      );
    }
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      farmerFeedbackStatus: feedbackData.feedbackStatus,
      farmerFeedbackAt: new Date(),
      farmerFeedbackNotes: feedbackData.notes,
      farmerCounterOffer: feedbackData.counterOffer,
      farmerCounterQty: feedbackData.counterQty,
      // Update main status based on feedback
      status:
        feedbackData.feedbackStatus === "ACCEPTED"
          ? "APPROVED"
          : feedbackData.feedbackStatus === "REJECTED"
          ? "PENDING"
          : "VERIFIED", // EXTENDED keeps it VERIFIED for negotiation
      approvedAt:
        feedbackData.feedbackStatus === "ACCEPTED" ? new Date() : null,
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          phone: true,
          username: true,
        },
      },
    },
  });

  // Send notification to aggregator about farmer's feedback
  if (existingSubmission.aggregator?.phone) {
    let message = `🌾 Farmer feedback on ${existingSubmission.productName}:\n`;

    switch (feedbackData.feedbackStatus) {
      case "ACCEPTED":
        message += `✅ ACCEPTED - Ready for payment\nQty: ${existingSubmission.acceptedQty}kg at ${existingSubmission.acceptedPrice}RWF/kg`;
        break;
      case "REJECTED":
        message += `❌ REJECTED - Purchase declined\n${
          feedbackData.notes ? `Reason: ${feedbackData.notes}` : ""
        }`;
        break;
      case "EXTENDED":
        message += `💬 NEGOTIATION REQUESTED\n`;
        if (feedbackData.counterOffer)
          message += `Counter price: ${feedbackData.counterOffer}RWF/kg\n`;
        if (feedbackData.counterQty)
          message += `Counter qty: ${feedbackData.counterQty}kg\n`;
        if (feedbackData.notes) message += `Notes: ${feedbackData.notes}`;
        break;
    }

    // Uncomment to send SMS
    // sendMessage(message.trim(), existingSubmission.aggregator.phone);
  }

  return updatedSubmission;
};

// Service to get pending feedback submissions for farmer
export const getPendingFeedbackSubmissionsService = async (
  farmerId: string,
  options: IPaginationOptions = {}
) => {
  const paginationParams = PaginationService.validatePaginationParams(
    options.page?.toString(),
    options.limit?.toString()
  );

  const {
    page,
    limit,
    sortBy = "verifiedAt",
    sortOrder = "desc",
  } = { ...paginationParams, ...options };

  const skip = (page - 1) * limit;

  const whereCondition = {
    farmerId,
    status: SubmissionStatus.VERIFIED,
    farmerFeedbackStatus: FarmerFeedbackStatus.PENDING,
    // Only show submissions that haven't passed deadline
    OR: [{ feedbackDeadline: null }, { feedbackDeadline: { gt: new Date() } }],
  };

  const totalCount = await prisma.farmerSubmission.count({
    where: whereCondition,
  });

  const submissions = await prisma.farmerSubmission.findMany({
    where: whereCondition,
    include: {
      aggregator: {
        select: {
          id: true,
          username: true,
          phone: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: submissions,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      limit,
    },
  };
};

// Service to get farmer's feedback history
export const getFarmerFeedbackHistoryService = async (
  farmerId: string,
  options: IPaginationOptions & { feedbackStatus?: FarmerFeedbackStatus } = {}
) => {
  const paginationParams = PaginationService.validatePaginationParams(
    options.page?.toString(),
    options.limit?.toString()
  );

  const {
    page,
    limit,
    sortBy = "farmerFeedbackAt",
    sortOrder = "desc",
  } = { ...paginationParams, ...options };

  const skip = (page - 1) * limit;

  const whereCondition: any = {
    farmerId,
    farmerFeedbackStatus: { not: "PENDING" },
  };

  if (options.feedbackStatus) {
    whereCondition.farmerFeedbackStatus = options.feedbackStatus;
  }

  const totalCount = await prisma.farmerSubmission.count({
    where: whereCondition,
  });

  const submissions = await prisma.farmerSubmission.findMany({
    where: whereCondition,
    include: {
      aggregator: {
        select: {
          id: true,
          username: true,
          phone: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip,
    take: limit,
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: submissions,
    pagination: {
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      limit,
    },
  };
};

// Service to update farmer feedback (allow editing before deadline)
export const updateFarmerFeedbackService = async (
  submissionId: string,
  farmerId: string,
  feedbackData: Partial<IFarmerFeedbackRequest>
) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  if (existingSubmission.farmerId !== farmerId) {
    throw new Error("You can only update feedback on your own submissions");
  }

  if (existingSubmission.farmerFeedbackStatus === "PENDING") {
    throw new Error("No feedback has been submitted yet");
  }

  // Check if feedback can still be updated (within deadline)
  if (
    existingSubmission.feedbackDeadline &&
    new Date() > existingSubmission.feedbackDeadline
  ) {
    throw new Error("Feedback deadline has passed, cannot update");
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      ...(feedbackData.feedbackStatus && {
        farmerFeedbackStatus: feedbackData.feedbackStatus,
      }),
      ...(feedbackData.notes && { farmerFeedbackNotes: feedbackData.notes }),
      ...(feedbackData.counterOffer && {
        farmerCounterOffer: feedbackData.counterOffer,
      }),
      ...(feedbackData.counterQty && {
        farmerCounterQty: feedbackData.counterQty,
      }),
      farmerFeedbackAt: new Date(),
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          phone: true,
          username: true,
        },
      },
    },
  });

  return updatedSubmission;
};
