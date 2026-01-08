import { Request, Response } from "express";
import {
  createAffiliatorService,
  getRestaurantAffiliatorsService,
  getAffiliatorByIdService,
  updateAffiliatorService,
  deleteAffiliatorService,
  getAllAffiliatorsService,
} from "../services/affiliator.service";

/**
 * Create new affiliator (Restaurant only)
 * POST /affiliators
 */
export const createAffiliator = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { name, email, phone } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        message: "Either email or phone number must be provided",
      });
    }

    const affiliator = await createAffiliatorService({
      name,
      email,
      phone,
      restaurantId,
    });

    res.status(201).json({
      message: "Affiliator created successfully",
      data: affiliator,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create affiliator",
    });
  }
};

/**
 * Get restaurant's affiliators
 * GET /affiliators/my-affiliators
 */
export const getMyAffiliators = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let restaurantId: string;

    if (user.role === "RESTAURANT") {
      restaurantId = user.id;
    } else if (user.role === "AFFILIATOR") {
      restaurantId = user.restaurantId;
    } else if (user.role === "ADMIN") {
      restaurantId = (req.query.restaurantId as string) || (req.query.userId as string);
      if (!restaurantId) {
        return res.status(400).json({
          message: "Restaurant ID is required for admin to view affiliators",
        });
      }
    } else {
      return res.status(403).json({
        message: "Unauthorized: Invalid role",
      });
    }

    const affiliators = await getRestaurantAffiliatorsService(restaurantId);

    res.status(200).json({
      message: "Affiliators retrieved successfully",
      data: affiliators,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get affiliators",
    });
  }
};

/**
 * Get all affiliators (Admin only)
 * GET /affiliators
 */
export const getAllAffiliators = async (req: Request, res: Response) => {
  try {
    const { restaurantId, page, limit } = req.query;

    const filters: any = {};
    if (restaurantId) filters.restaurantId = restaurantId as string;
    if (page) filters.page = parseInt(page as string);
    if (limit) filters.limit = parseInt(limit as string);

    const result = await getAllAffiliatorsService(filters);

    res.status(200).json({
      message: "Affiliators retrieved successfully",
      data: result.affiliators,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get affiliators",
    });
  }
};

/**
 * Get affiliator by ID
 * GET /affiliators/:id
 */
export const getAffiliatorById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    const affiliator = await getAffiliatorByIdService(id);

    // Check authorization
    const isOwner = (userRole === "RESTAURANT" && affiliator.restaurantId === userId) ||
      (userRole === "AFFILIATOR" && affiliator.restaurantId === (req as any).user.restaurantId) ||
      (userRole === "ADMIN");

    if (!isOwner) {
      return res.status(403).json({
        message: "Unauthorized: Affiliator does not belong to your restaurant",
      });
    }

    res.status(200).json({
      message: "Affiliator retrieved successfully",
      data: affiliator,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get affiliator",
    });
  }
};

/**
 * Update affiliator
 * PATCH /affiliators/:id
 */
export const updateAffiliator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Check authorization for restaurants
    if (userRole === "RESTAURANT") {
      const affiliator = await getAffiliatorByIdService(id);
      if (affiliator.restaurantId !== userId) {
        return res.status(403).json({
          message: "Unauthorized: Affiliator does not belong to this restaurant",
        });
      }
    }

    const updatedAffiliator = await updateAffiliatorService(id, {
      name,
      email,
      phone,
    });

    res.status(200).json({
      message: "Affiliator updated successfully",
      data: updatedAffiliator,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update affiliator",
    });
  }
};

/**
 * Delete affiliator
 * DELETE /affiliators/:id
 */
export const deleteAffiliator = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    // Check authorization for restaurants
    if (userRole === "RESTAURANT") {
      const affiliator = await getAffiliatorByIdService(id);
      if (affiliator.restaurantId !== userId) {
        return res.status(403).json({
          message: "Unauthorized: Affiliator does not belong to this restaurant",
        });
      }
    }

    const result = await deleteAffiliatorService(id);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to delete affiliator",
    });
  }
};