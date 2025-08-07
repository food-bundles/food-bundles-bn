import prisma from "../prisma";
import { Role } from "@prisma/client";
import { IGetSubmissionsParams, IPaginationOptions } from "../types/productVerifyTypes";
import { PaginationService } from "./paginationService";

export const purchaseProductService = async (
  submissionId: string,
  acceptedQty: number,
  acceptedPrice: number,
  foodBundleId: string
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

  const foodBundle = await prisma.admin.findUnique({
    where: { id: foodBundleId },
  });

  if (!foodBundle) {
    throw new Error("Food bundle not found");
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
      foodBundleId,
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
      foodBundle: {
        select: {
          id: true,
          phone: true,
        },
      },
    },
  });

  return updatedSubmission;
};

export const updateSubmissionService = async (
  submissionId: string,
  acceptedQty: number,
  acceptedPrice: number,
  foodBundleId: string
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

  if (existingSubmission.foodBundleId !== foodBundleId) {
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
      foodBundle: {
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
      foodBundleId: null,
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

  // Add foodBundle and approvedProduct for ADMIN and FOOD_BUNDLE roles
  if (userRole === Role.ADMIN || userRole === Role.FOOD_BUNDLE) {
    return {
      ...baseInclude,
      foodBundle: {
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
    case Role.FOOD_BUNDLE:
      whereCondition.foodBundleId = userId;
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
      canManage: userRole === Role.ADMIN || userRole === Role.FOOD_BUNDLE,
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
    case Role.FOOD_BUNDLE:
      // Food bundle can see submissions they're assigned to or unassigned ones
      if (submission.foodBundleId && submission.foodBundleId !== userId) {
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
      canManage: userRole === Role.ADMIN || userRole === Role.FOOD_BUNDLE,
      isOwner: userRole === Role.FARMER && submission.farmerId === userId,
      isAssigned:
        userRole === Role.FOOD_BUNDLE && submission.foodBundleId === userId,
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