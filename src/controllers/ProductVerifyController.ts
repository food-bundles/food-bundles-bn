import { Request, Response } from "express";
import {
  purchaseProductService,
  updateSubmissionService,
  clearSubmissionService,
  getAllSubmissionsService,
  getSubmissionByIdService,
} from "../services/ProductVerifyService";

export const purchaseProduct = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { acceptedQty, unitPrice } = req.body;
    const foodBundleId = (req as any).user.id;

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
      foodBundleId
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

export const updateSubmission = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { acceptedQty, unitPrice } = req.body;
    const foodBundleId = (req as any).user.id;

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

    const result = await updateSubmissionService(
      submissionId,
      acceptedQty,
      unitPrice,
      foodBundleId
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

export const clearSubmission = async (req: Request, res: Response) => {
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

export const getAllSubmissions = async (req: Request, res: Response) => {
  try {
    const submissions = await getAllSubmissionsService();

    res.status(200).json({
      message: "Submissions retrieved successfully",
      data: submissions,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get submissions",
    });
  }
};

// Get submission by ID
export const getSubmissionById = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await getSubmissionByIdService(submissionId);

    res.status(200).json({
      message: "Submission retrieved successfully",
      data: submission,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get submission",
    });
  }
};
