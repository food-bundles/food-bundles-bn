import { Request, Response } from "express";
import { getMyVouchersService, submitLoanApplicationService } from "../../../services/voucher.service";

export const mobileVouchersList = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { status, activeOnly } = req.query;

    const vouchers = await getMyVouchersService(restaurantId, undefined, {
      ...(status ? { status: status as any } : {}),
      ...(activeOnly === "true" ? { activeOnly: true } : {}),
    });

    res.status(200).json({ message: "Vouchers retrieved", data: vouchers });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get vouchers" });
  }
};

// POST /mobile/restaurant/vouchers/apply
// Restaurant submits a loan/voucher application
export const mobileVoucherApply = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { requestedAmount, purpose, voucherDays = 30 } = req.body;
    if (!requestedAmount || requestedAmount <= 0) {
      return res.status(400).json({ message: "requestedAmount is required and must be > 0" });
    }
    const loan = await submitLoanApplicationService({
      restaurantId,
      requestedAmount: Number(requestedAmount),
      purpose,
      voucherDays: Number(voucherDays),
    });
    res.status(201).json({ message: "Voucher application submitted", data: { loanId: loan.id, status: loan.status } });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to submit voucher application" });
  }
};
