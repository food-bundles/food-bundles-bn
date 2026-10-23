import { Request, Response } from "express";
import { userCan } from "../middleware/authMiddleware";
import {
  decideSubmissionPrice,
  getPriceContext,
  markSubmissionPaidInCash,
  rejectSubmissionFlow,
  SubmissionFlowError,
  verifySubmission,
} from "../services/submission-flow.service";

// Farmer submission stages (see submission-flow.service.ts). Route guards check
// the stage permission; "Set price" decides whether another price is allowed.

const fail = (res: Response, error: any, fallback: string) =>
  res
    .status(error instanceof SubmissionFlowError ? error.status : 500)
    .json({ success: false, message: error?.message || fallback });

const optionalNumber = (value: unknown) =>
  value === undefined || value === null || value === "" ? undefined : Number(value);

/** GET /submissions/:submissionId/price — asked price and Food Bundles price */
export const getSubmissionPrice = async (req: Request, res: Response) => {
  try {
    const data = await getPriceContext(req.params.submissionId as string);
    res.json({
      success: true,
      data: { ...data, canSetPrice: userCan((req as any).user, "farmer_submissions.set_price") },
    });
  } catch (error) {
    fail(res, error, "Failed to load prices");
  }
};

/** PATCH /submissions/:submissionId/approve { price? } — approve, or send a counter offer */
export const approveOrCounterSubmission = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await decideSubmissionPrice(req.params.submissionId as string, user.id, {
      price: optionalNumber(req.body?.price),
      canSetPrice: userCan(user, "farmer_submissions.set_price"),
    });
    res.json({
      success: true,
      message:
        data.status === "APPROVED"
          ? "Submission approved"
          : "Counter offer sent to the farmer",
      data,
    });
  } catch (error) {
    fail(res, error, "Failed to approve submission");
  }
};

/** POST /submissions/:submissionId/purchase { acceptedQty, unitPrice? } — verify face to face */
export const verifySubmissionController = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await verifySubmission(req.params.submissionId as string, user.id, {
      quantity: Number(req.body?.acceptedQty),
      price: optionalNumber(req.body?.unitPrice),
      canSetPrice: userCan(user, "farmer_submissions.set_price"),
    });
    res.json({ success: true, message: "Submission verified", data });
  } catch (error) {
    fail(res, error, "Failed to verify submission");
  }
};

/** POST /submissions/:submissionId/pay-cash — the farmer was paid by hand */
export const paySubmissionInCash = async (req: Request, res: Response) => {
  try {
    const data = await markSubmissionPaidInCash(req.params.submissionId as string, (req as any).user.id);
    res.json({ success: true, message: "Payment recorded", data });
  } catch (error) {
    fail(res, error, "Failed to record the payment");
  }
};

/** PATCH /submissions/:submissionId/reject { reason? } */
export const rejectSubmissionController = async (req: Request, res: Response) => {
  try {
    const data = await rejectSubmissionFlow(
      req.params.submissionId as string,
      (req as any).user.id,
      req.body?.reason,
    );
    res.json({ success: true, message: "Submission rejected", data });
  } catch (error) {
    fail(res, error, "Failed to reject submission");
  }
};
