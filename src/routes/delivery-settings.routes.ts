import { Router, Request, Response } from "express";
import { allow, isAuthenticated } from "../middleware/authMiddleware";
import {
  getDeliverySettings,
  resetDeliverySettings,
  updateDeliverySettings,
} from "../services/delivery-fee.service";

// Delivery fee rules (fee, free-delivery minimum order, free-delivery timing)
const deliverySettingsRoutes = Router();

/**
 * GET /delivery-settings — any signed-in user (checkout shows the fee preview)
 */
deliverySettingsRoutes.get("/", isAuthenticated, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getDeliverySettings() });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to load delivery settings" });
  }
});

/**
 * PUT /delivery-settings — { deliveryFee?, freeDeliveryMinOrder?, freeDeliveryMinDaysAhead? }
 */
deliverySettingsRoutes.put(
  "/",
  isAuthenticated,
  allow("delivery_settings"),
  async (req: Request, res: Response) => {
    try {
      const data = await updateDeliverySettings(req.body ?? {}, (req as any).user?.id);
      res.json({ success: true, message: "Delivery settings saved", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to save delivery settings" });
    }
  },
);

/**
 * DELETE /delivery-settings — remove the saved settings (back to defaults)
 */
deliverySettingsRoutes.delete(
  "/",
  isAuthenticated,
  allow("delivery_settings"),
  async (_req: Request, res: Response) => {
    try {
      const data = await resetDeliverySettings();
      res.json({ success: true, message: "Delivery settings reset to defaults", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to reset delivery settings" });
    }
  },
);

export default deliverySettingsRoutes;
