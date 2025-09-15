"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubmissionStatsService = exports.getSubmissionsByStatusService = exports.getSubmissionByIdService = exports.getAllSubmissionsService = exports.clearSubmissionService = exports.updateSubmissionService = exports.purchaseProductService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const paginationService_1 = require("./paginationService");
const purchaseProductService = async (submissionId, acceptedQty, acceptedPrice, aggregatorId, feedbackDeadline) => {
    const existingSubmission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
        include: {
            farmer: {
                select: {
                    id: true,
                    phone: true,
                },
            },
        },
    });
    if (!existingSubmission) {
        throw new Error("Submission not found");
    }
    const aggregator = await prisma_1.default.admin.findUnique({
        where: { id: aggregatorId },
    });
    if (!aggregator) {
        throw new Error("AGGREGATOR not found");
    }
    if (existingSubmission.submittedQty === null ||
        acceptedQty > existingSubmission.submittedQty) {
        throw new Error("Accepted quantity is greater than submitted quantity");
    }
    const totalAmount = acceptedQty * acceptedPrice;
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
        where: { id: submissionId },
        data: {
            acceptedQty,
            acceptedPrice,
            feedbackDeadline: feedbackDeadline ? feedbackDeadline : null,
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
exports.purchaseProductService = purchaseProductService;
const updateSubmissionService = async (submissionId, acceptedQty, acceptedPrice, aggregatorId, feedbackDeadline) => {
    const existingSubmission = await prisma_1.default.farmerSubmission.findUnique({
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
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
        where: { id: submissionId },
        data: {
            acceptedQty,
            acceptedPrice,
            feedbackDeadline: feedbackDeadline ? feedbackDeadline : null,
            totalAmount,
            verifiedAt: new Date(),
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
                },
            },
        },
    });
    return updatedSubmission;
};
exports.updateSubmissionService = updateSubmissionService;
const clearSubmissionService = async (submissionId) => {
    const existingSubmission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
    });
    if (!existingSubmission) {
        throw new Error("Submission not found");
    }
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
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
                },
            },
        },
    });
    return updatedSubmission;
};
exports.clearSubmissionService = clearSubmissionService;
const getIncludeConfig = (userRole) => {
    const baseInclude = {
        farmer: {
            select: {
                id: true,
                phone: true,
                email: true,
            },
        },
    };
    // Add aggregator and approvedProduct for ADMIN and AGGREGATOR roles
    if (userRole === client_1.Role.ADMIN || userRole === client_1.Role.AGGREGATOR) {
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
const getFilterConditions = async (userId, userRole, options) => {
    let whereCondition = {};
    // Role-based filtering
    switch (userRole) {
        case client_1.Role.FARMER:
            whereCondition.farmerId = userId;
            break;
        case client_1.Role.AGGREGATOR:
            // Get aggregator's location details
            const aggregator = await prisma_1.default.admin.findUnique({
                where: { id: userId },
                select: {
                    province: true,
                    district: true,
                },
            });
            if (!aggregator) {
                throw new Error("Aggregator not found");
            }
            // Filter submissions by aggregator's province and district
            whereCondition.AND = [
                { province: aggregator.province },
                { district: aggregator.district },
                {
                    OR: [
                        { aggregatorId: userId }, // Submissions already assigned to this aggregator
                        { aggregatorId: null }, // Unassigned submissions in their location
                    ],
                },
            ];
            break;
        case client_1.Role.ADMIN:
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
const getAllSubmissionsService = async ({ userId, userRole, options = {}, }) => {
    const paginationParams = paginationService_1.PaginationService.validatePaginationParams(options.page?.toString(), options.limit?.toString());
    const { page, limit, sortBy = "submittedAt", sortOrder = "desc", } = { ...paginationParams, ...options };
    const skip = (page - 1) * limit;
    // FIXED: Added await here
    const whereCondition = await getFilterConditions(userId, userRole, options);
    const includeConfig = getIncludeConfig(userRole);
    // Get total count for pagination
    const totalCount = await prisma_1.default.farmerSubmission.count({
        where: whereCondition,
    });
    // Get submissions with pagination
    const submissions = await prisma_1.default.farmerSubmission.findMany({
        where: whereCondition,
        include: {
            farmer: true,
            category: {
                select: {
                    id: true,
                    name: true,
                    description: true,
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
        userContext: {
            role: userRole,
            canManage: userRole === client_1.Role.ADMIN || userRole === client_1.Role.AGGREGATOR,
        },
    };
};
exports.getAllSubmissionsService = getAllSubmissionsService;
const getSubmissionByIdService = async (submissionId, userId, userRole) => {
    const includeConfig = getIncludeConfig(userRole);
    const submission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
        include: includeConfig,
    });
    if (!submission) {
        throw new Error("Submission not found");
    }
    // Role-based access control for AGGREGATOR - check location-based access
    switch (userRole) {
        case client_1.Role.FARMER:
            if (submission.farmerId !== userId) {
                throw new Error("Access denied: You can only view your own submissions");
            }
            break;
        case client_1.Role.AGGREGATOR:
            // Check if aggregator has location-based access to this submission
            const aggregator = await prisma_1.default.admin.findUnique({
                where: { id: userId },
                select: {
                    province: true,
                    district: true,
                },
            });
            if (!aggregator) {
                throw new Error("Aggregator not found");
            }
            // Check if submission is in aggregator's location or assigned to them
            const hasLocationAccess = submission.province === aggregator.province &&
                submission.district === aggregator.district;
            const isAssigned = submission.aggregatorId === userId;
            if (!hasLocationAccess && !isAssigned) {
                throw new Error("Access denied: You can only view submissions in your location or assigned to you");
            }
            break;
        case client_1.Role.ADMIN:
            // Admin can see all submissions
            break;
        default:
            throw new Error("Unauthorized role");
    }
    return {
        data: submission,
        userContext: {
            role: userRole,
            canManage: userRole === client_1.Role.ADMIN || userRole === client_1.Role.AGGREGATOR,
            isOwner: userRole === client_1.Role.FARMER && submission.farmerId === userId,
            isAssigned: userRole === client_1.Role.AGGREGATOR && submission.aggregatorId === userId,
        },
    };
};
exports.getSubmissionByIdService = getSubmissionByIdService;
// Additional service for getting submissions by status (useful for dashboards)
const getSubmissionsByStatusService = async ({ userId, userRole, status, options = {}, }) => {
    return (0, exports.getAllSubmissionsService)({
        userId,
        userRole,
        options: { ...options, status },
    });
};
exports.getSubmissionsByStatusService = getSubmissionsByStatusService;
// Service to get submission statistics (for dashboards)
const getSubmissionStatsService = async (userId, userRole) => {
    // FIXED: Added await here
    const whereCondition = await getFilterConditions(userId, userRole);
    const stats = await prisma_1.default.farmerSubmission.groupBy({
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
    const totalSubmissions = await prisma_1.default.farmerSubmission.count({
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
        }, {}),
        userContext: {
            role: userRole,
        },
    };
};
exports.getSubmissionStatsService = getSubmissionStatsService;
