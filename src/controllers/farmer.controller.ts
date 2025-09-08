import { NextFunction, Request, Response } from "express";
import {
  submitFarmerFeedbackService,
  getPendingFeedbackSubmissionsService,
  getFarmerFeedbackHistoryService,
  updateFarmerFeedbackService,
  type IFarmerFeedbackRequest,
  submitProductService,
} from "../services/farmer.service";
import { FarmerFeedbackStatus, Role } from "@prisma/client";
import { PaginationService } from "../services/paginationService";
import { ProductSubmissionInput } from "../types/productTypes";
import errorHandler, { catchAsyncError } from "../utils/errorhandler.utlity";

export default class FarmerController {
  static submitFarmerFeedback = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { feedbackStatus, notes, counterOffer, counterQty } = req.body;
      const farmerId = (req as any).user.id;
      const userRole = (req as any).user.role;

      // Ensure only farmers can submit feedback
      if (userRole !== Role.FARMER) {
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
      const validStatuses: FarmerFeedbackStatus[] = [
        "ACCEPTED",
        "REJECTED",
        "EXTENDED",
      ];
      if (!validStatuses.includes(feedbackStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid feedback status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
        });
      }

      const feedbackData: IFarmerFeedbackRequest = {
        feedbackStatus,
        notes,
        counterOffer,
        counterQty,
      };

      const result = await submitFarmerFeedbackService(
        submissionId,
        farmerId,
        feedbackData
      );

      res.status(200).json({
        success: true,
        message: "Farmer feedback submitted successfully",
        data: result,
      });
    } catch (error: any) {
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
  static getPendingFeedbackSubmissions = async (
    req: Request,
    res: Response
  ) => {
    try {
      const farmerId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== Role.FARMER) {
        return res.status(403).json({
          success: false,
          message: "Only farmers can access this endpoint",
        });
      }

      const {
        page = 1,
        limit = 10,
        sortBy = "verifiedAt",
        sortOrder = "desc",
      } = req.query;

      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );

      const result = await getPendingFeedbackSubmissionsService(farmerId, {
        page: paginationQuery.page,
        limit: paginationQuery.limit,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      });

      res.status(200).json({
        success: true,
        message: "Pending feedback submissions retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get pending feedback submissions",
      });
    }
  };

  // Get farmer's feedback history
  static getFarmerFeedbackHistory = async (req: Request, res: Response) => {
    try {
      const farmerId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== Role.FARMER) {
        return res.status(403).json({
          success: false,
          message: "Only farmers can access this endpoint",
        });
      }

      const {
        page = 1,
        limit = 10,
        sortBy = "farmerFeedbackAt",
        sortOrder = "desc",
        feedbackStatus,
      } = req.query;

      // Validate feedback status filter if provided
      if (feedbackStatus) {
        const validStatuses: FarmerFeedbackStatus[] = [
          "ACCEPTED",
          "REJECTED",
          "EXTENDED",
        ];
        if (!validStatuses.includes(feedbackStatus as FarmerFeedbackStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid feedback status filter. Must be one of: ${validStatuses.join(
              ", "
            )}`,
          });
        }
      }

      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );

      const result = await getFarmerFeedbackHistoryService(farmerId, {
        page: paginationQuery.page,
        limit: paginationQuery.limit,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
        feedbackStatus: feedbackStatus as FarmerFeedbackStatus,
      });

      res.status(200).json({
        success: true,
        message: "Farmer feedback history retrieved successfully",
        ...result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get farmer feedback history",
      });
    }
  };

  // Update farmer feedback (before deadline)
  static updateFarmerFeedback = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { feedbackStatus, notes, counterOffer, counterQty } = req.body;
      const farmerId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== Role.FARMER) {
        return res.status(403).json({
          success: false,
          message: "Only farmers can update feedback",
        });
      }

      // Validate feedback status if provided
      if (feedbackStatus) {
        const validStatuses: FarmerFeedbackStatus[] = [
          "ACCEPTED",
          "REJECTED",
          "EXTENDED",
        ];
        if (!validStatuses.includes(feedbackStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid feedback status. Must be one of: ${validStatuses.join(
              ", "
            )}`,
          });
        }
      }

      const feedbackData = {
        feedbackStatus,
        notes,
        counterOffer,
        counterQty,
      };

      const result = await updateFarmerFeedbackService(
        submissionId,
        farmerId,
        feedbackData
      );

      res.status(200).json({
        success: true,
        message: "Farmer feedback updated successfully",
        data: result,
      });
    } catch (error: any) {
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
}

export const submitProductController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const { productId } = req.params;

    const { quantity, wishedPrice, province, district, sector, cell, village } =
      req.body;

    // Validate required fields
    if (!quantity || !wishedPrice) {
      return next(
        new errorHandler({
          message: "Quantity, and wishedPrice are required",
          statusCode: 400,
        })
      );
    }

    // Validate numeric fields
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      return next(
        new errorHandler({
          message: "quantity must be a positive number",
          statusCode: 400,
        })
      );
    }

    if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
      return next(
        new errorHandler({
          message: "wishedPrice must be a positive number",
          statusCode: 400,
        })
      );
    }

    // Validate user authentication
    if (!userId) {
      return next(
        new errorHandler({
          message: "User authentication required",
          statusCode: 401,
        })
      );
    }

    const submissionData: ProductSubmissionInput = {
      farmerId: userId,
      productId: productId,
      submittedQty: parseFloat(quantity),
      wishedPrice: parseFloat(wishedPrice),
      province,
      district,
      sector,
      cell,
      village,
    };

    const result = await submitProductService(submissionData);

    res.status(201).json({
      success: true,
      message: "Product submitted successfully",
      data: result,
    });
  }
);
