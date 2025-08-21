import prisma from "../prisma";
import { Role } from "@prisma/client";
import {
  IGetSubmissionsParams,
  IPaginationOptions,
} from "../types/productVerifyTypes";
import { PaginationService } from "./paginationService";
import { sendMessage } from "../utils/sms.utility";

export const purchaseProductService = async (
  submissionId: string,
  acceptedQty: number,
  acceptedPrice: number,
  aggregatorId: string
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
    },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  const aggregator = await prisma.admin.findUnique({
    where: { id: aggregatorId },
  });

  if (!aggregator) {
    throw new Error("AGGREGATOR not found");
  }

  if (
    existingSubmission.submittedQty === null ||
    acceptedQty > existingSubmission.submittedQty
  ) {
    throw new Error("Accepted quantity is greater than submitted quantity");
  }

  const totalAmount = acceptedQty * acceptedPrice;

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty,
      acceptedPrice,
      totalAmount,
      aggregatorId,
      status: "VERIFIED",
      verifiedAt: new Date(),
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
        },
      },
    },
  });

  // Send notification to farmer
  //   sendMessage(
  //     `🌾 ${existingSubmission.productName} verified!
  // Accepted: ${acceptedQty}kg for ${acceptedPrice}RWF/kg
  // Total: ${acceptedQty * acceptedPrice}RWF
  // Reply: ACCEPT / REJECT / EXTEND
  //   `.trim(),
  //     existingSubmission.farmer.phone!
  //   );

  return updatedSubmission;
};

export const updateSubmissionService = async (
  submissionId: string,
  acceptedQty: number,
  acceptedPrice: number,
  aggregatorId: string
) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  if (existingSubmission.status !== "VERIFIED") {
    throw new Error("Can only update submissions with VERIFIED status");
  }

  if (existingSubmission.aggregatorId !== aggregatorId) {
    throw new Error("You can only update submissions you have verified");
  }

  const totalAmount = acceptedQty * acceptedPrice;

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty,
      acceptedPrice,
      totalAmount,
      verifiedAt: new Date(),
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
        },
      },
    },
  });

  return updatedSubmission;
};

export const clearSubmissionService = async (submissionId: string) => {
  const existingSubmission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!existingSubmission) {
    throw new Error("Submission not found");
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      acceptedQty: null,
      acceptedPrice: null,
      totalAmount: null,
      aggregatorId: null,
      status: "PENDING",
      verifiedAt: null,
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
    },
  });

  return updatedSubmission;
};

const getIncludeConfig = (userRole: Role) => {
  const baseInclude = {
    farmer: {
      select: {
        id: true,
        phone: true,
        location: true,
        email: true,
      },
    },
  };

  // Add aggregator and approvedProduct for ADMIN and AGGREGATOR roles
  if (userRole === Role.ADMIN || userRole === Role.AGGREGATOR) {
    return {
      ...baseInclude,
      aggregator: {
        select: {
          id: true,
          username: true,
          phone: true,
          email: true,
        },
      },
      approvedProduct: {
        select: {
          id: true,
          productName: true,
          unitPrice: true,
          category: true,
          sku: true,
        },
      },
    };
  }

  return baseInclude;
};

// Get filter conditions based on user role
const getFilterConditions = (
  userId: string,
  userRole: Role,
  options?: IPaginationOptions
) => {
  let whereCondition: any = {};

  // Role-based filtering
  switch (userRole) {
    case Role.FARMER:
      whereCondition.farmerId = userId;
      break;
    case Role.AGGREGATOR:
      whereCondition.aggregatorId = userId;
      break;
    case Role.ADMIN:
      // Admin can see all submissions - no additional filter needed
      break;
    default:
      throw new Error("Unauthorized role");
  }

  // Additional filters
  if (options?.status) {
    whereCondition.status = options.status;
  }

  if (options?.productName) {
    whereCondition.productName = {
      contains: options.productName,
      mode: "insensitive",
    };
  }

  return whereCondition;
};

export const getAllSubmissionsService = async ({
  userId,
  userRole,
  options = {},
}: IGetSubmissionsParams) => {
  const paginationParams = PaginationService.validatePaginationParams(
    options.page?.toString(),
    options.limit?.toString()
  );

  const {
    page,
    limit,
    sortBy = "submittedAt",
    sortOrder = "desc",
  } = { ...paginationParams, ...options };

  const skip = (page - 1) * limit;
  const whereCondition = getFilterConditions(userId, userRole, options);
  const includeConfig = getIncludeConfig(userRole);

  // Get total count for pagination
  const totalCount = await prisma.farmerSubmission.count({
    where: whereCondition,
  });

  // Get submissions with pagination
  const submissions = await prisma.farmerSubmission.findMany({
    where: whereCondition,
    include: includeConfig,
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
    userContext: {
      role: userRole,
      canManage: userRole === Role.ADMIN || userRole === Role.AGGREGATOR,
    },
  };
};

export const getSubmissionByIdService = async (
  submissionId: string,
  userId: string,
  userRole: Role
) => {
  const includeConfig = getIncludeConfig(userRole);

  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: includeConfig,
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  // Role-based access control
  switch (userRole) {
    case Role.FARMER:
      if (submission.farmerId !== userId) {
        throw new Error(
          "Access denied: You can only view your own submissions"
        );
      }
      break;
    case Role.AGGREGATOR:
      // AGGREGATOR can see submissions they're assigned to or unassigned ones
      if (submission.aggregatorId && submission.aggregatorId !== userId) {
        throw new Error(
          "Access denied: You can only view submissions assigned to you"
        );
      }
      break;
    case Role.ADMIN:
      // Admin can see all submissions
      break;
    default:
      throw new Error("Unauthorized role");
  }

  return {
    data: submission,
    userContext: {
      role: userRole,
      canManage: userRole === Role.ADMIN || userRole === Role.AGGREGATOR,
      isOwner: userRole === Role.FARMER && submission.farmerId === userId,
      isAssigned:
        userRole === Role.AGGREGATOR && submission.aggregatorId === userId,
    },
  };
};

// Additional service for getting submissions by status (useful for dashboards)
export const getSubmissionsByStatusService = async ({
  userId,
  userRole,
  status,
  options = {},
}: IGetSubmissionsParams & { status: string }) => {
  return getAllSubmissionsService({
    userId,
    userRole,
    options: { ...options, status },
  });
};

// Service to get submission statistics (for dashboards)
export const getSubmissionStatsService = async (
  userId: string,
  userRole: Role
) => {
  const whereCondition = getFilterConditions(userId, userRole);

  const stats = await prisma.farmerSubmission.groupBy({
    by: ["status"],
    where: whereCondition,
    _count: {
      status: true,
    },
    _sum: {
      submittedQty: true,
      acceptedQty: true,
      totalAmount: true,
    },
  });

  const totalSubmissions = await prisma.farmerSubmission.count({
    where: whereCondition,
  });

  return {
    totalSubmissions,
    byStatus: stats.reduce((acc, stat) => {
      acc[stat.status] = {
        count: stat._count.status,
        totalSubmittedQty: stat._sum.submittedQty || 0,
        totalAcceptedQty: stat._sum.acceptedQty || 0,
        totalAmount: stat._sum.totalAmount || 0,
      };
      return acc;
    }, {} as Record<string, any>),
    userContext: {
      role: userRole,
    },
  };
};
