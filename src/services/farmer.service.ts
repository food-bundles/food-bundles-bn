import { FarmerFeedbackStatus, SubmissionStatus } from "@prisma/client";
import { answerCounterOffer } from "./submission-flow.service";
import { IPaginationOptions } from "../types/productVerifyTypes";
import { PaginationService } from "./paginationService";
import prisma from "../prisma";
import { LocationValidationService } from "./location.service";
import { ProductSubmissionInput } from "../types/productTypes";
import { createNotificationService } from "./notification.services";
import { sendMessage } from "../utils/sms.utility";
import { sendAdminSubmissionCreatedEmail } from "../utils/emails";
import { notifyPrivateReceiversService } from "./notification-recipient.service";

// Interface for farmer feedback request
export interface IFarmerFeedbackRequest {
  feedbackStatus: FarmerFeedbackStatus;
  notes?: string;
  counterOffer?: number;
  counterQty?: number;
}

// Service to handle farmer feedback on verified submissions
/**
 * The farmer answers Food Bundles' counter offer (submission NEGOTIATING):
 * ACCEPTED → approved at the offer, REJECTED → declined, EXTENDED → their new
 * price goes back for review. See submission-flow.service.ts.
 */
export const submitFarmerFeedbackService = async (
  submissionId: string,
  farmerId: string,
  feedbackData: IFarmerFeedbackRequest
) => {
  const decision =
    feedbackData.feedbackStatus === "ACCEPTED"
      ? "ACCEPT"
      : feedbackData.feedbackStatus === "REJECTED"
        ? "DECLINE"
        : feedbackData.feedbackStatus === "EXTENDED"
          ? "COUNTER"
          : null;
  if (!decision) {
    throw new Error("Choose accept, decline, or propose your own price");
  }
  return answerCounterOffer(submissionId, farmerId, {
    decision,
    counterPrice: feedbackData.counterOffer,
    notes: feedbackData.notes,
  });
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
    // Counter-offers sent to the farmer
    status: SubmissionStatus.NEGOTIATING,
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

  // Validate feedback data for counter offer
  if (
    existingSubmission.submittedQty &&
    feedbackData.counterQty &&
    existingSubmission.submittedQty < feedbackData.counterQty
  ) {
    throw new Error(
      `Counter offer quantity ${feedbackData.counterQty} cannot be greater than submitted quantity ${existingSubmission.submittedQty}`
    );
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      ...(feedbackData.feedbackStatus && {
        farmerFeedbackStatus: feedbackData.feedbackStatus,
        approvedAt:
          feedbackData.feedbackStatus === "ACCEPTED" ? new Date() : null,
        farmerCounterOffer:
          feedbackData.feedbackStatus === "ACCEPTED"
            ? existingSubmission.acceptedPrice
            : existingSubmission.farmerCounterOffer,
        farmerCounterQty:
          feedbackData.feedbackStatus === "ACCEPTED"
            ? existingSubmission.acceptedQty
            : existingSubmission.farmerCounterQty,
      }),
      ...(feedbackData.notes && { farmerFeedbackNotes: feedbackData.notes }),
      ...(feedbackData.counterOffer && {
        farmerCounterOffer: feedbackData.counterOffer,
        farmerFeedbackStatus: "EXTENDED",
      }),
      ...(feedbackData.counterQty && {
        farmerCounterQty: feedbackData.counterQty,
        farmerFeedbackStatus: "EXTENDED",
      }),

      farmerFeedbackAt: new Date(),
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
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

  const effectiveStatus = updatedSubmission.farmerFeedbackStatus ?? "PENDING";
  const updateNotificationPayload = {
    title: "Farmer Updated Feedback",
    message: `Farmer updated their feedback on ${existingSubmission.productName} to ${effectiveStatus}.${
      feedbackData.notes ? ` Notes: ${feedbackData.notes}` : ""
    }`,
    eventType: "SUBMISSION_FEEDBACK_RECEIVED",
    metadata: {
      submissionId: updatedSubmission.id,
      productName: existingSubmission.productName,
      feedbackStatus: effectiveStatus,
      farmerId: existingSubmission.farmerId,
    },
  };

  try {
    if (existingSubmission.aggregatorId) {
      await createNotificationService({
        ...updateNotificationPayload,
        targetType: "SPECIFIC_USER",
        targetId: existingSubmission.aggregatorId,
      });
    } else {
      await createNotificationService({
        ...updateNotificationPayload,
        targetType: "ROLE_BASED",
        targetRole: "ADMIN",
      });
    }
  } catch (notifError) {
    console.error("Failed to create feedback-updated notification:", notifError);
  }

  if (effectiveStatus === "REJECTED" || effectiveStatus === "EXTENDED" || effectiveStatus === "ACCEPTED") {
    const aggregatorPhone = updatedSubmission.aggregator?.phone;
    if (aggregatorPhone) {
      try {
        await sendMessage(updateNotificationPayload.message, aggregatorPhone);
      } catch (smsError) {
        console.error("Failed to send feedback-updated SMS:", smsError);
      }
    } else {
      notifyPrivateReceiversService({
        subject: `FoodBundles — Farmer Feedback Updated: ${effectiveStatus}`,
        body: updateNotificationPayload.message,
      }).catch((err) =>
        console.error("Failed to notify private receivers for feedback update:", err)
      );
    }
  }

  return updatedSubmission;
};

export async function submitProductService(
  submissionData: ProductSubmissionInput
) {
  const productData = await prisma.product.findUnique({
    where: { id: submissionData.productId },
  });

  if (!productData) {
    throw new Error("Product not found");
  }

  // Get valid products from database
  const validProducts = await getProductsFromDatabase();

  // Validate product name
  if (!validProducts.includes(productData.productName)) {
    throw new Error(
      `Invalid product. Valid products are: ${validProducts.join(", ")}`
    );
  }

  // Validate quantity and price
  if (submissionData.submittedQty <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  if (submissionData.wishedPrice <= 0) {
    throw new Error("Price must be greater than 0");
  }

  // Check if farmer exists and get their location data
  const farmer = await prisma.farmer.findUnique({
    where: { id: submissionData.farmerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
    },
  });

  if (!farmer) {
    throw new Error("Farmer not found");
  }

  if (
    submissionData.province ||
    submissionData.district ||
    submissionData.sector ||
    submissionData.cell ||
    submissionData.village
  ) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: (submissionData?.province ?? farmer.province) as string,
        district: (submissionData.district ?? farmer.district) as string,
        sector: (submissionData.sector ?? farmer.sector) as string,
        cell: (submissionData.cell ?? farmer.cell) as string,
        village: (submissionData.village ?? farmer.village) as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Farmer location validation failed: ${locationValidation.errors.join(
          ", "
        )}`
      );
    }
  }

  // Create submission with farmer's location data
  const submission = await prisma.farmerSubmission.create({
    data: {
      farmerId: submissionData.farmerId,
      productName: productData.productName,
      categoryId: productData.categoryId,
      submittedQty: submissionData.submittedQty,
      wishedPrice: submissionData.wishedPrice,
      deliveryDate: submissionData.deliveryDate,
      pickupPoint: submissionData.pickupPoint,
      latitude: submissionData.latitude,
      longitude: submissionData.longitude,
      status: "PENDING",
      location: submissionData.location || farmer.location,
      province: submissionData.province || farmer.province,
      district: submissionData.district || farmer.district,
      sector: submissionData.sector || farmer.sector,
      cell: submissionData.cell || farmer.cell,
      village: submissionData.village || farmer.village,
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          province: true,
          district: true,
          sector: true,
          cell: true,
          village: true,
        },
      },
    },
  });

  // Alert admin that a new submission is awaiting review — isolated so a
  // notification failure can never affect the already-committed submission.
  try {
    await createNotificationService({
      title: "New Farmer Submission",
      message: `${farmer.name || farmer.phone || "A farmer"} submitted ${submissionData.submittedQty} of ${productData.productName} for review.`,
      eventType: "SUBMISSION_CREATED",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        submissionId: submission.id,
        farmerId: farmer.id,
        productName: productData.productName,
        submittedQty: submissionData.submittedQty,
        wishedPrice: submissionData.wishedPrice,
      },
    });
  } catch (notifError) {
    console.error("Failed to create submission-created notification:", notifError);
  }

  try {
    await notifyPrivateReceiversService({
      subject: "FoodBundles — New Farmer Submission",
      body: `New submission: ${farmer.name || farmer.phone || "A farmer"} submitted ${submissionData.submittedQty} of ${productData.productName} for review.`,
    });
  } catch (smsError) {
    console.error("Failed to notify private receivers for submission-created:", smsError);
  }

  try {
    if (process.env.ADMIN_EMAIL) {
      await sendAdminSubmissionCreatedEmail({
        farmerName: farmer.name || "Farmer",
        farmerPhone: farmer.phone || undefined,
        productName: productData.productName,
        submittedQty: submissionData.submittedQty,
        wishedPrice: submissionData.wishedPrice,
      });
    }
  } catch (emailError) {
    console.error("Failed to send admin submission-created email:", emailError);
  }

  return submission;
}

// Get products from database
export async function getProductsFromDatabase(): Promise<string[]> {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { productName: true },
      distinct: ["productName"],
    });
    return products.map((p) => p.productName);
  } catch (error) {
    console.error("Error fetching products:", error);
    // Fallback to hardcoded list
    return [
      "Tomatoes",
      "Onions",
      "Maize",
      "Potatoes",
      "Cassava",
      "Irish Potatoes",
      "Banana",
    ];
  }
}
