import { Request, Response } from "express";
import {
  mobileCalculatePromo,
  mobileGetMyPromoCodes,
} from "../../../services/mobile/restaurant/promo.service";

export const calculatePromoController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { cartId, code } = req.body;
    if (!cartId || !code) {
      res.status(400).json({ message: "cartId and code are required" });
      return;
    }
    const result = await mobileCalculatePromo(cartId, code, restaurantId);
    res.status(200).json({ message: "Promo applied", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to apply promo code" });
  }
};

export const getMyPromoCodesController = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const result = await mobileGetMyPromoCodes(restaurantId);
    res.status(200).json({ message: "Promo codes retrieved", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to fetch promo codes" });
  }
};
