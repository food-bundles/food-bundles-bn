import { Request, Response } from "express";
import {
  createPromoCodeService,
  getAllPromoCodesService,
  getPromoCodeByIdService,
  getPromoCodeByCodeService,
  updatePromoCodeService,
  deletePromoCodeService,
  validatePromoCodeService,
  applyPromoCodeService,
  excludeRestaurantService,
  removeRestaurantExclusionService,
  includeRestaurantService,
  removeRestaurantInclusionService,
  getActivePromoCodesService,
  getMyPromoCodesService,
  calculateCartWithPromoService,
  createPromoCodeWithInclusionsService,
} from "../services/promo.service";
import { PromoCodeType, DiscountType } from "@prisma/client";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const createPromoCode = async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      description,
      type,
      discountType,
      discountValue,
      isReusable,
      maxUsageCount,
      maxUsagePerUser,
      minOrderAmount,
      minItemQuantity,
      applyToAllProducts,
      applicableProductIds,
      applicableCategoryIds,
      startDate,
      expiryDate,
    } = req.body;

    if (
      !code ||
      !name ||
      !type ||
      !discountType ||
      discountValue === undefined
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: code, name, type, discountType, discountValue",
      });
    }

    if (
      discountType === "PERCENTAGE" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      return res.status(400).json({
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountType === "FIXED_AMOUNT" && discountValue < 0) {
      return res.status(400).json({
        message: "Fixed amount discount must be positive",
      });
    }

    const promoCode = await createPromoCodeService({
      code: code.toUpperCase(),
      name,
      description,
      type: type as PromoCodeType,
      discountType: discountType as DiscountType,
      discountValue,
      isReusable,
      maxUsageCount,
      maxUsagePerUser,
      minOrderAmount,
      minItemQuantity,
      applyToAllProducts,
      applicableProductIds,
      applicableCategoryIds,
      startDate: startDate ? new Date(startDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      createdBy: (req as any).user?.id,
    });

    res.status(201).json({
      message: "Promo code created successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to create promo code",
    });
  }
};

export const getAllPromoCodes = async (req: Request, res: Response) => {
  try {
    const { type, isActive, search } = req.query;

    const filters: any = {};
    if (type) filters.type = type as PromoCodeType;
    if (isActive !== undefined) filters.isActive = isActive === "true";
    if (search) filters.search = search as string;

    const promoCodes = await getAllPromoCodesService(filters);

    res.status(200).json({
      message: "Promo codes retrieved successfully",
      data: promoCodes,
      count: promoCodes.length,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to retrieve promo codes",
    });
  }
};

export const getPromoCodeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const promoCode = await getPromoCodeByIdService(id);

    res.status(200).json({
      message: "Promo code retrieved successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(404).json({
      message: error.message || "Promo code not found",
    });
  }
};

export const getPromoCodeByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    const promoCode = await getPromoCodeByCodeService(code.toUpperCase());

    res.status(200).json({
      message: "Promo code retrieved successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(404).json({
      message: error.message || "Promo code not found",
    });
  }
};

export const updatePromoCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.code) {
      updateData.code = updateData.code.toUpperCase();
    }

    if (
      updateData.discountType === "PERCENTAGE" &&
      updateData.discountValue !== undefined
    ) {
      if (updateData.discountValue < 0 || updateData.discountValue > 100) {
        return res.status(400).json({
          message: "Percentage discount must be between 0 and 100",
        });
      }
    }

    if (
      updateData.discountType === "FIXED_AMOUNT" &&
      updateData.discountValue !== undefined
    ) {
      if (updateData.discountValue < 0) {
        return res.status(400).json({
          message: "Fixed amount discount must be positive",
        });
      }
    }

    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }

    if (updateData.expiryDate) {
      updateData.expiryDate = new Date(updateData.expiryDate);
    }

    const promoCode = await updatePromoCodeService(id, updateData);

    res.status(200).json({
      message: "Promo code updated successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to update promo code",
    });
  }
};

export const deletePromoCode = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await deletePromoCodeService(id);

    res.status(200).json({
      message: "Promo code deleted successfully",
    });
  } catch (error: any) {
    res.status(404).json({
      message: error.message || "Promo code not found",
    });
  }
};

export const validatePromoCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { orderAmount } = req.body;
    const restaurantId = (req as any).user?.id;

    if (!restaurantId) {
      return res.status(401).json({
        message: "Restaurant authentication required",
      });
    }

    if (!orderAmount || orderAmount <= 0) {
      return res.status(400).json({
        message: "Valid order amount is required",
      });
    }

    const promoCode = await validatePromoCodeService(
      code.toUpperCase(),
      restaurantId,
      orderAmount,
    );

    // Calculate potential discount
    let discountAmount = 0;
    if (promoCode.discountType === "PERCENTAGE") {
      discountAmount = (orderAmount * promoCode.discountValue) / 100;
    } else {
      discountAmount = Math.min(promoCode.discountValue, orderAmount);
    }

    const finalAmount = orderAmount - discountAmount;

    res.status(200).json({
      message: "Promo code is valid",
      data: {
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          name: promoCode.name,
          description: promoCode.description,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
        },
        discount: {
          originalAmount: orderAmount,
          discountAmount,
          finalAmount,
          savings: discountAmount,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Invalid promo code",
    });
  }
};

export const applyPromoCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { orderId, items } = req.body;
    const restaurantId = (req as any).user?.id;

    if (!restaurantId) {
      return res.status(401).json({
        message: "Restaurant authentication required",
      });
    }

    if (!orderId || !items || !Array.isArray(items)) {
      return res.status(400).json({
        message: "Missing required fields: orderId, items (array)",
      });
    }

    const result = await applyPromoCodeService(
      code.toUpperCase(),
      restaurantId,
      orderId,
      items,
    );

    res.status(200).json({
      message: "Promo code applied successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to apply promo code",
    });
  }
};

export const excludeRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { restaurantId, reason } = req.body;
    const excludedBy = (req as any).user?.id;

    if (!restaurantId || !reason) {
      return res.status(400).json({
        message: "Missing required fields: restaurantId, reason",
      });
    }

    const promoCode = await excludeRestaurantService(
      id,
      restaurantId,
      reason,
      excludedBy,
    );

    res.status(200).json({
      message: "Restaurant excluded successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to exclude restaurant",
    });
  }
};

export const includeRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { restaurantId, reason } = req.body;
    const includedBy = (req as any).user?.id;

    if (!restaurantId || !reason) {
      return res.status(400).json({
        message: "Missing required fields: restaurantId, reason",
      });
    }

    const promoCode = await includeRestaurantService(
      id,
      restaurantId,
      reason,
      includedBy,
    );

    res.status(200).json({
      message: "Restaurant included successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to include restaurant",
    });
  }
};

export const removeRestaurantInclusion = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, restaurantId } = req.params;

    const promoCode = await removeRestaurantInclusionService(id, restaurantId);

    res.status(200).json({
      message: "Restaurant inclusion removed successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to remove restaurant inclusion",
    });
  }
};

export const removeRestaurantExclusion = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, restaurantId } = req.params;

    const promoCode = await removeRestaurantExclusionService(id, restaurantId);

    res.status(200).json({
      message: "Restaurant exclusion removed successfully",
      data: promoCode,
    });
  } catch (error: any) {
    res.status(400).json({
      message: error.message || "Failed to remove restaurant exclusion",
    });
  }
};

// New controllers for requested endpoints

export const getActivePromoCodes = async (req: Request, res: Response) => {
  try {
    const promoCodes = await getActivePromoCodesService();

    res.status(200).json({
      success: true,
      data: promoCodes,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyPromoCodes = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const restaurantId = req.user?.id;

    if (!restaurantId) {
      return res.status(401).json({
        success: false,
        message: "Restaurant authentication required",
      });
    }

    const promoCodes = await getMyPromoCodesService(restaurantId);

    res.status(200).json({
      success: true,
      data: promoCodes,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const calculateCartWithPromo = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { cartId, promoCode } = req.body;
    const restaurantId = req.user?.id;

    if (!restaurantId) {
      return res.status(401).json({
        success: false,
        message: "Restaurant authentication required",
      });
    }

    if (!cartId || !promoCode) {
      return res.status(400).json({
        success: false,
        message: "Cart ID and promo code are required",
      });
    }

    const calculation = await calculateCartWithPromoService(
      cartId,
      promoCode,
      restaurantId,
    );

    res.status(200).json({
      success: true,
      data: calculation,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
