"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFarmerFeedbackService = exports.getFarmerFeedbackHistoryService = exports.getPendingFeedbackSubmissionsService = exports.submitFarmerFeedbackService = void 0;
exports.submitProductService = submitProductService;
exports.getProductsFromDatabase = getProductsFromDatabase;
const client_1 = require("@prisma/client");
const paginationService_1 = require("./paginationService");
const prisma_1 = __importDefault(require("../prisma"));
const location_service_1 = require("./location.service");
// Service to handle farmer feedback on verified submissions
const submitFarmerFeedbackService = async (submissionId, farmerId, feedbackData) => {
    const existingSubmission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
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
    if (existingSubmission.feedbackDeadline &&
        new Date() > existingSubmission.feedbackDeadline) {
        throw new Error("Feedback deadline has passed");
    }
    // Check if farmer has already provided feedback
    if (existingSubmission.farmerFeedbackStatus &&
        existingSubmission.farmerFeedbackStatus !== "PENDING") {
        throw new Error("Feedback has already been submitted for this purchase");
    }
    // Validate counter offers if provided
    if (feedbackData.feedbackStatus === "EXTENDED") {
        if (feedbackData.counterOffer && feedbackData.counterOffer <= 0) {
            throw new Error("Counter offer price must be positive");
        }
        if (feedbackData.counterQty &&
            (feedbackData.counterQty <= 0 ||
                feedbackData.counterQty > existingSubmission.submittedQty)) {
            throw new Error("Counter offer quantity must be positive and not exceed submitted quantity");
        }
    }
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
        where: { id: submissionId },
        data: {
            farmerFeedbackStatus: feedbackData.feedbackStatus,
            farmerFeedbackAt: new Date(),
            farmerFeedbackNotes: feedbackData.feedbackStatus === "ACCEPTED" ? null : feedbackData.notes,
            farmerCounterOffer: feedbackData.feedbackStatus === "ACCEPTED"
                ? existingSubmission.acceptedPrice
                : feedbackData.counterOffer,
            farmerCounterQty: feedbackData.feedbackStatus === "ACCEPTED"
                ? existingSubmission.acceptedQty
                : feedbackData.counterQty,
            approvedAt: feedbackData.feedbackStatus === "ACCEPTED" ? new Date() : null,
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
    // Send notification to aggregator about farmer's feedback
    if (existingSubmission.aggregator?.phone) {
        let message = `🌾 Farmer feedback on ${existingSubmission.productName}:\n`;
        switch (feedbackData.feedbackStatus) {
            case "ACCEPTED":
                message += `✅ ACCEPTED - Ready for payment\nQty: ${existingSubmission.acceptedQty}kg at ${existingSubmission.acceptedPrice}RWF/kg`;
                break;
            case "REJECTED":
                message += `❌ REJECTED - Purchase declined\n${feedbackData.notes ? `Reason: ${feedbackData.notes}` : ""}`;
                break;
            case "EXTENDED":
                message += `💬 NEGOTIATION REQUESTED\n`;
                if (feedbackData.counterOffer)
                    message += `Counter price: ${feedbackData.counterOffer}RWF/kg\n`;
                if (feedbackData.counterQty)
                    message += `Counter qty: ${feedbackData.counterQty}kg\n`;
                if (feedbackData.notes)
                    message += `Notes: ${feedbackData.notes}`;
                break;
        }
    }
    return updatedSubmission;
};
exports.submitFarmerFeedbackService = submitFarmerFeedbackService;
// Service to get pending feedback submissions for farmer
const getPendingFeedbackSubmissionsService = async (farmerId, options = {}) => {
    const paginationParams = paginationService_1.PaginationService.validatePaginationParams(options.page?.toString(), options.limit?.toString());
    const { page, limit, sortBy = "verifiedAt", sortOrder = "desc", } = { ...paginationParams, ...options };
    const skip = (page - 1) * limit;
    const whereCondition = {
        farmerId,
        status: client_1.SubmissionStatus.VERIFIED,
        farmerFeedbackStatus: client_1.FarmerFeedbackStatus.PENDING,
        // Only show submissions that haven't passed deadline
        OR: [{ feedbackDeadline: null }, { feedbackDeadline: { gt: new Date() } }],
    };
    const totalCount = await prisma_1.default.farmerSubmission.count({
        where: whereCondition,
    });
    const submissions = await prisma_1.default.farmerSubmission.findMany({
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
exports.getPendingFeedbackSubmissionsService = getPendingFeedbackSubmissionsService;
// Service to get farmer's feedback history
const getFarmerFeedbackHistoryService = async (farmerId, options = {}) => {
    const paginationParams = paginationService_1.PaginationService.validatePaginationParams(options.page?.toString(), options.limit?.toString());
    const { page, limit, sortBy = "farmerFeedbackAt", sortOrder = "desc", } = { ...paginationParams, ...options };
    const skip = (page - 1) * limit;
    const whereCondition = {
        farmerId,
        farmerFeedbackStatus: { not: "PENDING" },
    };
    if (options.feedbackStatus) {
        whereCondition.farmerFeedbackStatus = options.feedbackStatus;
    }
    const totalCount = await prisma_1.default.farmerSubmission.count({
        where: whereCondition,
    });
    const submissions = await prisma_1.default.farmerSubmission.findMany({
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
exports.getFarmerFeedbackHistoryService = getFarmerFeedbackHistoryService;
// Service to update farmer feedback (allow editing before deadline)
const updateFarmerFeedbackService = async (submissionId, farmerId, feedbackData) => {
    const existingSubmission = await prisma_1.default.farmerSubmission.findUnique({
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
    if (existingSubmission.feedbackDeadline &&
        new Date() > existingSubmission.feedbackDeadline) {
        throw new Error("Feedback deadline has passed, cannot update");
    }
    // Validate feedback data for counter offer
    if (existingSubmission.submittedQty &&
        feedbackData.counterQty &&
        existingSubmission.submittedQty < feedbackData.counterQty) {
        throw new Error(`Counter offer quantity ${feedbackData.counterQty} cannot be greater than submitted quantity ${existingSubmission.submittedQty}`);
    }
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
        where: { id: submissionId },
        data: {
            ...(feedbackData.feedbackStatus && {
                farmerFeedbackStatus: feedbackData.feedbackStatus,
                approvedAt: feedbackData.feedbackStatus === "ACCEPTED" ? new Date() : null,
                farmerCounterOffer: feedbackData.feedbackStatus === "ACCEPTED"
                    ? existingSubmission.acceptedPrice
                    : existingSubmission.farmerCounterOffer,
                farmerCounterQty: feedbackData.feedbackStatus === "ACCEPTED"
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
    return updatedSubmission;
};
exports.updateFarmerFeedbackService = updateFarmerFeedbackService;
async function submitProductService(submissionData) {
    const productData = await prisma_1.default.product.findUnique({
        where: { id: submissionData.productId },
    });
    if (!productData) {
        throw new Error("Product not found");
    }
    // Get valid products from database
    const validProducts = await getProductsFromDatabase();
    // Validate product name
    if (!validProducts.includes(productData.productName)) {
        throw new Error(`Invalid product. Valid products are: ${validProducts.join(", ")}`);
    }
    // Validate quantity and price
    if (submissionData.submittedQty <= 0) {
        throw new Error("Quantity must be greater than 0");
    }
    if (submissionData.wishedPrice <= 0) {
        throw new Error("Price must be greater than 0");
    }
    // Check if farmer exists and get their location data
    const farmer = await prisma_1.default.farmer.findUnique({
        where: { id: submissionData.farmerId },
        select: {
            id: true,
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
    if (submissionData.province ||
        submissionData.district ||
        submissionData.sector ||
        submissionData.cell ||
        submissionData.village) {
        const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
            province: (submissionData?.province ?? farmer.province),
            district: (submissionData.district ?? farmer.district),
            sector: (submissionData.sector ?? farmer.sector),
            cell: (submissionData.cell ?? farmer.cell),
            village: (submissionData.village ?? farmer.village),
        });
        if (!locationValidation.isValid) {
            throw new Error(`Farmer location validation failed: ${locationValidation.errors.join(", ")}`);
        }
    }
    // Create submission with farmer's location data
    const submission = await prisma_1.default.farmerSubmission.create({
        data: {
            farmerId: submissionData.farmerId,
            productName: productData.productName,
            categoryId: productData.categoryId,
            submittedQty: submissionData.submittedQty,
            wishedPrice: submissionData.wishedPrice,
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
    return submission;
}
// Get products from database
async function getProductsFromDatabase() {
    try {
        const products = await prisma_1.default.product.findMany({
            where: { status: "ACTIVE" },
            select: { productName: true },
            distinct: ["productName"],
        });
        return products.map((p) => p.productName);
    }
    catch (error) {
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
