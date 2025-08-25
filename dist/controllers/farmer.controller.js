"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const farmer_service_1 = require("../services/farmer.service");
const client_1 = require("@prisma/client");
const paginationService_1 = require("../services/paginationService");
class FarmerController {
}
_a = FarmerController;
FarmerController.submitFarmerFeedback = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { feedbackStatus, notes, counterOffer, counterQty } = req.body;
        const farmerId = req.user.id;
        const userRole = req.user.role;
        // Ensure only farmers can submit feedback
        if (userRole !== client_1.Role.FARMER) {
            return res.status(403).json({
                success: false,
                message: "Only farmers can submit feedback",
            });
        }
        if (!feedbackStatus) {
            return res.status(400).json({
                success: false,
                message: "Feedback status is required",
            });
        }
        // Validate feedback status
        const validStatuses = [
            "ACCEPTED",
            "REJECTED",
            "EXTENDED",
        ];
        if (!validStatuses.includes(feedbackStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid feedback status. Must be one of: ${validStatuses.join(", ")}`,
            });
        }
        const feedbackData = {
            feedbackStatus,
            notes,
            counterOffer,
            counterQty,
        };
        const result = await (0, farmer_service_1.submitFarmerFeedbackService)(submissionId, farmerId, feedbackData);
        res.status(200).json({
            success: true,
            message: "Farmer feedback submitted successfully",
            data: result,
        });
    }
    catch (error) {
        const statusCode = error.message.includes("not found")
            ? 404
            : error.message.includes("only provide feedback")
                ? 403
                : error.message.includes("deadline")
                    ? 400
                    : 400;
        res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to submit farmer feedback",
        });
    }
};
// Get pending feedback submissions for farmer
FarmerController.getPendingFeedbackSubmissions = async (req, res) => {
    try {
        const farmerId = req.user.id;
        const userRole = req.user.role;
        if (userRole !== client_1.Role.FARMER) {
            return res.status(403).json({
                success: false,
                message: "Only farmers can access this endpoint",
            });
        }
        const { page = 1, limit = 10, sortBy = "verifiedAt", sortOrder = "desc", } = req.query;
        const paginationQuery = paginationService_1.PaginationService.validatePaginationParams(page, limit);
        const result = await (0, farmer_service_1.getPendingFeedbackSubmissionsService)(farmerId, {
            page: paginationQuery.page,
            limit: paginationQuery.limit,
            sortBy: sortBy,
            sortOrder: sortOrder,
        });
        res.status(200).json({
            success: true,
            message: "Pending feedback submissions retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get pending feedback submissions",
        });
    }
};
// Get farmer's feedback history
FarmerController.getFarmerFeedbackHistory = async (req, res) => {
    try {
        const farmerId = req.user.id;
        const userRole = req.user.role;
        if (userRole !== client_1.Role.FARMER) {
            return res.status(403).json({
                success: false,
                message: "Only farmers can access this endpoint",
            });
        }
        const { page = 1, limit = 10, sortBy = "farmerFeedbackAt", sortOrder = "desc", feedbackStatus, } = req.query;
        // Validate feedback status filter if provided
        if (feedbackStatus) {
            const validStatuses = [
                "ACCEPTED",
                "REJECTED",
                "EXTENDED",
            ];
            if (!validStatuses.includes(feedbackStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid feedback status filter. Must be one of: ${validStatuses.join(", ")}`,
                });
            }
        }
        const paginationQuery = paginationService_1.PaginationService.validatePaginationParams(page, limit);
        const result = await (0, farmer_service_1.getFarmerFeedbackHistoryService)(farmerId, {
            page: paginationQuery.page,
            limit: paginationQuery.limit,
            sortBy: sortBy,
            sortOrder: sortOrder,
            feedbackStatus: feedbackStatus,
        });
        res.status(200).json({
            success: true,
            message: "Farmer feedback history retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get farmer feedback history",
        });
    }
};
// Update farmer feedback (before deadline)
FarmerController.updateFarmerFeedback = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { feedbackStatus, notes, counterOffer, counterQty } = req.body;
        const farmerId = req.user.id;
        const userRole = req.user.role;
        if (userRole !== client_1.Role.FARMER) {
            return res.status(403).json({
                success: false,
                message: "Only farmers can update feedback",
            });
        }
        // Validate feedback status if provided
        if (feedbackStatus) {
            const validStatuses = [
                "ACCEPTED",
                "REJECTED",
                "EXTENDED",
            ];
            if (!validStatuses.includes(feedbackStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid feedback status. Must be one of: ${validStatuses.join(", ")}`,
                });
            }
        }
        const feedbackData = {
            feedbackStatus,
            notes,
            counterOffer,
            counterQty,
        };
        const result = await (0, farmer_service_1.updateFarmerFeedbackService)(submissionId, farmerId, feedbackData);
        res.status(200).json({
            success: true,
            message: "Farmer feedback updated successfully",
            data: result,
        });
    }
    catch (error) {
        const statusCode = error.message.includes("not found")
            ? 404
            : error.message.includes("only update feedback")
                ? 403
                : error.message.includes("deadline")
                    ? 400
                    : 400;
        res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to update farmer feedback",
        });
    }
};
exports.default = FarmerController;
