import { Request, Response } from "express";
import prisma from "../../../prisma";

// GET /mobile/restaurant/config/payment-methods
export const mobileGetPaymentMethods = async (_req: Request, res: Response) => {
  try {
    const methods = await prisma.paymentMethodConfig.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ message: "Payment methods retrieved", data: methods });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get payment methods" });
  }
};
