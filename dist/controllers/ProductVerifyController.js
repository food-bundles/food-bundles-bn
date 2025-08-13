"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const ProductVerifyService_1 = require("../services/ProductVerifyService");
const client_1 = require("@prisma/client");
class ProductVerifyController {
}
_a = ProductVerifyController;
ProductVerifyController.purchaseProduct = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { acceptedQty, unitPrice } = req.body;
        const foodBundleId = req.user.id;
        if (!acceptedQty || !unitPrice) {
            return res.status(400).json({
                message: "acceptedQty and unitPrice are required",
            });
        }
        if (acceptedQty <= 0 || unitPrice <= 0) {
            return res.status(400).json({
                message: "acceptedQty and unitPrice must be positive numbers",
            });
        }
        const result = await (0, ProductVerifyService_1.purchaseProductService)(submissionId, acceptedQty, unitPrice, foodBundleId);
        res.status(200).json({
            message: "Product purchased successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to purchase product",
        });
    }
};
ProductVerifyController.updateSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { acceptedQty, unitPrice } = req.body;
        const foodBundleId = req.user.id;
        if (!acceptedQty || !unitPrice) {
            return res.status(400).json({
                message: "acceptedQty and accepted price are required",
            });
        }
        if (acceptedQty <= 0 || unitPrice <= 0) {
            return res.status(400).json({
                message: "acceptedQty and unitPrice must be positive numbers",
            });
        }
        const result = await (0, ProductVerifyService_1.updateSubmissionService)(submissionId, acceptedQty, unitPrice, foodBundleId);
        res.status(200).json({
            message: "Submission updated successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update submission",
        });
    }
};
ProductVerifyController.clearSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const result = await (0, ProductVerifyService_1.clearSubmissionService)(submissionId);
        res.status(200).json({
            message: "Submission cleared successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to clear submission",
        });
    }
};
ProductVerifyController.getAllSubmissions = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, sortBy = "submittedAt", sortOrder = "desc", status, productName, } = req.query;
        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const result = await (0, ProductVerifyService_1.getAllSubmissionsService)({
            userId: user.id,
            userRole: user.role,
            options: {
                page: pageNum,
                limit: limitNum,
                sortBy: sortBy,
                sortOrder: sortOrder,
                status: status,
                productName: productName,
            },
        });
        res.status(200).json({
            success: true,
            message: "Submissions retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get submissions",
        });
    }
};
// Get submission by ID
ProductVerifyController.getSubmissionById = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const user = req.user;
        if (!submissionId) {
            return res.status(400).json({
                success: false,
                message: "Submission ID is required",
            });
        }
        const result = await (0, ProductVerifyService_1.getSubmissionByIdService)(submissionId, user.id, user.role);
        res.status(200).json({
            success: true,
            message: "Submission retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        const statusCode = error.message.includes("not found")
            ? 404
            : error.message.includes("Access denied")
                ? 403
                : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to get submission",
        });
    }
};
// Get submissions by status
ProductVerifyController.getSubmissionsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const user = req.user;
        const { page = 1, limit = 10, sortBy = "submittedAt", sortOrder = "desc", productName, } = req.query;
        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required",
            });
        }
        // Validate status
        const validStatuses = ["PENDING", "VERIFIED", "APPROVED", "PAID"];
        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be one of: " + validStatuses.join(", "),
            });
        }
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const result = await (0, ProductVerifyService_1.getSubmissionsByStatusService)({
            userId: user.id,
            userRole: user.role,
            status: status.toUpperCase(),
            options: {
                page: pageNum,
                limit: limitNum,
                sortBy: sortBy,
                sortOrder: sortOrder,
                productName: productName,
            },
        });
        res.status(200).json({
            success: true,
            message: `Submissions with status ${status} retrieved successfully`,
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get submissions by status",
        });
    }
};
ProductVerifyController.getSubmissionStats = async (req, res) => {
    try {
        const user = req.user;
        const result = await (0, ProductVerifyService_1.getSubmissionStatsService)(user.id, user.role);
        res.status(200).json({
            success: true,
            message: "Submission statistics retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get submission statistics",
        });
    }
};
// Get user's own submissions (for farmers)
ProductVerifyController.getMySubmissions = async (req, res) => {
    try {
        const user = req.user;
        const { page = 1, limit = 10, sortBy = "submittedAt", sortOrder = "desc", status, productName, } = req.query;
        // This endpoint is mainly for farmers to get their own submissions
        if (user.role !== client_1.Role.FARMER) {
            return res.status(403).json({
                success: false,
                message: "This endpoint is for farmers only",
            });
        }
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const result = await (0, ProductVerifyService_1.getAllSubmissionsService)({
            userId: user.id,
            userRole: user.role,
            options: {
                page: pageNum,
                limit: limitNum,
                sortBy: sortBy,
                sortOrder: sortOrder,
                status: status,
                productName: productName,
            },
        });
        res.status(200).json({
            success: true,
            message: "Your submissions retrieved successfully",
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to get your submissions",
        });
    }
};
exports.default = ProductVerifyController;
