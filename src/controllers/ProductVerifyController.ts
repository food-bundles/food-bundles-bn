import { Request, Response } from "express";
import {
  purchaseProductService,
  updateSubmissionService,
  clearSubmissionService,
  getAllSubmissionsService,
  getSubmissionByIdService,
  getSubmissionsByStatusService,
  getSubmissionStatsService,
} from "../services/ProductVerifyService";
import { PaginationService } from "../services/paginationService";
import { Role } from "@prisma/client";

export default class ProductVerifyController {
  static purchaseProduct = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { acceptedQty, unitPrice } = req.body;
      const aggregatorId = (req as any).user.id;

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

      const result = await purchaseProductService(
        submissionId,
        acceptedQty,
        unitPrice,
        aggregatorId
      );

      res.status(200).json({
        message: "Product purchased successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to purchase product",
      });
    }
  };

  static updateSubmission = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { acceptedQty, unitPrice } = req.body;
      const aggregatorId = (req as any).user.id;

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

      const result = await updateSubmissionService(
        submissionId,
        acceptedQty,
        unitPrice,
        aggregatorId
      );

      res.status(200).json({
        message: "Submission updated successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to update submission",
      });
    }
  };

  static clearSubmission = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;

      const result = await clearSubmissionService(submissionId);

      res.status(200).json({
        message: "Submission cleared successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        message: error.message || "Failed to clear submission",
      });
    }
  };

  static getAllSubmissions = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        page,
        limit,
        sortBy = "submittedAt",
        sortOrder = "desc",
        status,
        productName,
      } = req.query;
      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );

      const result = await getAllSubmissionsService({
        userId: user.id,
        userRole: user.role as Role,
        options: {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
          status: status as string,
          productName: productName as string,
        },
      });

      res.status(200).json({
        success: true,
        message: "Submissions retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get submissions",
      });
    }
  };

  // Get submission by ID
  static getSubmissionById = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const user = (req as any).user;

      if (!submissionId) {
        return res.status(400).json({
          success: false,
          message: "Submission ID is required",
        });
      }

      const result = await getSubmissionByIdService(
        submissionId,
        user.id,
        user.role as Role
      );

      res.status(200).json({
        success: true,
        message: "Submission retrieved successfully",
        ...result,
      });
    } catch (error: any) {
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
  static getSubmissionsByStatus = async (req: Request, res: Response) => {
    try {
      const { status } = req.params;
      const user = (req as any).user;
      const {
        page = 1,
        limit = 10,
        sortBy = "submittedAt",
        sortOrder = "desc",
        productName,
      } = req.query;

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
          message:
            "Invalid status. Must be one of: " + validStatuses.join(", "),
        });
      }

      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );

      const result = await getSubmissionsByStatusService({
        userId: user.id,
        userRole: user.role as Role,
        status: status.toUpperCase(),
        options: {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
          productName: productName as string,
        },
      });

      res.status(200).json({
        success: true,
        message: `Submissions with status ${status} retrieved successfully`,
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get submissions by status",
      });
    }
  };

  static getSubmissionStats = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      const result = await getSubmissionStatsService(
        user.id,
        user.role as Role
      );

      res.status(200).json({
        success: true,
        message: "Submission statistics retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get submission statistics",
      });
    }
  };

  // Get user's own submissions (for farmers)
  static getMySubmissions = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        page = 1,
        limit = 10,
        sortBy = "submittedAt",
        sortOrder = "desc",
        status,
        productName,
      } = req.query;

      // Farmer to get their own submissions
      if (user.role !== Role.FARMER) {
        return res.status(403).json({
          success: false,
          message: "This endpoint is for farmers only",
        });
      }

      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );

      const result = await getAllSubmissionsService({
        userId: user.id,
        userRole: user.role as Role,
        options: {
          page: paginationQuery.page,
          limit: paginationQuery.limit,
          sortBy: sortBy as string,
          sortOrder: sortOrder as "asc" | "desc",
          status: status as string,
          productName: productName as string,
        },
      });

      res.status(200).json({
        success: true,
        message: "Your submissions retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get your submissions",
      });
    }
  };
}
