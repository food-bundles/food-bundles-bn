import { Router, Request, Response } from "express";
import { allow, isAuthenticated } from "../middleware/authMiddleware";
import prisma from "../prisma";
import {
  getDeliveryConfig,
  getDeliverySettingsFor,
  removeCustomerTypeDeliverySettings,
  resetDeliverySettings,
  updateDeliverySettings,
} from "../services/delivery-fee.service";

// Delivery fee rules (fee, free-delivery minimum order, free-delivery timing),
// default plus optional rules per customer type (schools, hotels…)
const deliverySettingsRoutes = Router();

// Customer accounts that order (their customer type picks the rules)
const CUSTOMER_ROLES = ["RESTAURANT", "HOTEL", "AFFILIATOR"];

/**
 * GET /delivery-settings — the rules that apply to the signed-in user:
 * a customer gets their customer type's rules (checkout fee preview), anyone
 * else the default. ?customerTypeId= previews a type (dashboard order forms).
 */
deliverySettingsRoutes.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let customerTypeId = typeof req.query.customerTypeId === "string" ? req.query.customerTypeId : undefined;
    if (!customerTypeId && CUSTOMER_ROLES.includes(user?.role)) {
      const customerId = user.role === "AFFILIATOR" ? user.restaurantId : user.id;
      const customer = customerId
        ? await prisma.restaurant.findUnique({ where: { id: customerId }, select: { customerTypeId: true } })
        : null;
      customerTypeId = customer?.customerTypeId ?? undefined;
    }
    res.json({ success: true, data: await getDeliverySettingsFor(customerTypeId) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to load delivery settings" });
  }
});

/**
 * GET /delivery-settings/config — default rules, each customer type's own
 * rules, and the customer types (for the settings page)
 */
deliverySettingsRoutes.get(
  "/config",
  isAuthenticated,
  allow("delivery_settings"),
  async (_req: Request, res: Response) => {
    try {
      const [config, customerTypes] = await Promise.all([
        getDeliveryConfig(),
        prisma.customerType.findMany({
          select: { id: true, name: true, isActive: true },
          orderBy: { name: "asc" },
        }),
      ]);
      res.json({ success: true, data: { ...config, customerTypes } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || "Failed to load delivery settings" });
    }
  },
);

/**
 * PUT /delivery-settings — { enabled?, deliveryFee?, freeDeliveryMinOrder?,
 * freeDeliveryMinDaysAhead?, customerTypeId? } — with customerTypeId the
 * rules are saved for that customer type only
 */
deliverySettingsRoutes.put(
  "/",
  isAuthenticated,
  allow("delivery_settings"),
  async (req: Request, res: Response) => {
    try {
      const { customerTypeId, ...rules } = req.body ?? {};
      const data = await updateDeliverySettings(
        rules,
        (req as any).user?.id,
        typeof customerTypeId === "string" && customerTypeId ? customerTypeId : undefined,
      );
      res.json({ success: true, message: "Delivery settings saved", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to save delivery settings" });
    }
  },
);

/**
 * DELETE /delivery-settings/customer-type/:customerTypeId — that customer type
 * goes back to the default rules
 */
deliverySettingsRoutes.delete(
  "/customer-type/:customerTypeId",
  isAuthenticated,
  allow.to("delivery_settings.edit"),
  async (req: Request, res: Response) => {
    try {
      const data = await removeCustomerTypeDeliverySettings(
        req.params.customerTypeId as string,
        (req as any).user?.id,
      );
      res.json({ success: true, message: "This customer type now pays the default delivery fee", data });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || "Failed to update delivery settings" });
    }
  },
);

/**
 * DELETE /delivery-settings — default rules back to the defaults
 * (customer types with their own rules keep them)
 */
deliverySettingsRoutes.delete(
  "/",
  isAuthenticated,
  allow.to("delivery_settings.reset"),
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
