import { Request, Response } from "express";
import {
  initiateSubmissionPayoutService,
  confirmSubmissionPayoutService,
  getSubmissionPayoutsService,
} from "../services/submissionPayout.service";
import {
  forceCompleteSubmissionService,
  reverseSubmissionStatusService,
  rejectSubmissionService,
  deleteSubmissionService,
  getSubmissionStatusHistoryService,
} from "../services/submissionOverride.service";

export default class SubmissionPayoutController {
  static initiatePayout = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { phoneNumber } = req.body;
      const initiatedBy = (req as any).user.id;

      if (!phoneNumber) {
        return res
          .status(400)
          .json({ success: false, message: "phoneNumber is required" });
      }

      const result = await initiateSubmissionPayoutService(
        submissionId,
        phoneNumber,
        initiatedBy
      );

      res.status(200).json({
        success: true,
        message: "Payout initiated successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to initiate payout",
      });
    }
  };

  static confirmPayout = async (req: Request, res: Response) => {
    try {
      const { submissionId, payoutId } = req.params;
      const { outcome } = req.body;

      if (outcome !== "COMPLETED" && outcome !== "FAILED") {
        return res.status(400).json({
          success: false,
          message: "outcome must be COMPLETED or FAILED",
        });
      }

      const result = await confirmSubmissionPayoutService(
        submissionId,
        payoutId,
        outcome
      );

      res.status(200).json({
        success: true,
        message: "Payout confirmed successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to confirm payout",
      });
    }
  };

  static getPayouts = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const result = await getSubmissionPayoutsService(submissionId);
      res
        .status(200)
        .json({ success: true, message: "Payouts retrieved", data: result });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get payouts",
      });
    }
  };

  static forceComplete = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { reason } = req.body;
      const adminId = (req as any).user.id;

      const result = await forceCompleteSubmissionService(
        submissionId,
        adminId,
        reason
      );

      res.status(200).json({
        success: true,
        message: "Submission force-completed successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to force-complete submission",
      });
    }
  };

  static reverseStatus = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { toStatus, reason } = req.body;
      const adminId = (req as any).user.id;

      if (!toStatus) {
        return res
          .status(400)
          .json({ success: false, message: "toStatus is required" });
      }

      const result = await reverseSubmissionStatusService(
        submissionId,
        toStatus,
        adminId,
        reason
      );

      res.status(200).json({
        success: true,
        message: "Submission status reversed successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reverse submission status",
      });
    }
  };

  static getStatusHistory = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const result = await getSubmissionStatusHistoryService(submissionId);
      res.status(200).json({
        success: true,
        message: "Status history retrieved",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get status history",
      });
    }
  };

  static reject = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const { reason } = req.body;
      const adminId = (req as any).user.id;

      const result = await rejectSubmissionService(
        submissionId,
        adminId,
        reason
      );

      res.status(200).json({
        success: true,
        message: "Submission rejected successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reject submission",
      });
    }
  };

  static deleteSubmission = async (req: Request, res: Response) => {
    try {
      const { submissionId } = req.params;
      const result = await deleteSubmissionService(submissionId);

      res.status(200).json({
        success: true,
        message: "Submission deleted successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to delete submission",
      });
    }
  };
}
