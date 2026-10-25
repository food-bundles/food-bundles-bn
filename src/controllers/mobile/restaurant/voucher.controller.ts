import { Request, Response } from "express";
import { getMyVouchersService } from "../../../services/voucher.service";

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
