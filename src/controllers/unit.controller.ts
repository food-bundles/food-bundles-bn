import { Request, Response } from "express";
import {
  createProductUnitService,
  getAllProductUnitsService,
  getProductUnitByIdService,
  updateProductUnitService,
  deleteProductUnitService,
  getActiveProductUnitsService,
  updateUnitStatusService,
} from "../services/unit.service";

// Create ProductUnit
export const createProductUnit = async (req: Request, res: Response) => {
  try {
    const { tableTronicId, name, description, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        message: "Unit name is required",
      });
    }

    const productUnit = await createProductUnitService({
      tableTronicId,
      name,
      description,
      isActive,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Product unit created successfully",
      data: productUnit,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create product unit",
    });
  }
};

// Get all ProductUnits
export const getAllProductUnits = async (req: Request, res: Response) => {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await getAllProductUnitsService({
      search: search as string,
      isActive: isActive ? isActive === "true" : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Product units retrieved successfully",
      data: result.units,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get product units",
    });
  }
};

// Get active ProductUnits for dropdown/selection
export const getActiveProductUnits = async (req: Request, res: Response) => {
  try {
    const units = await getActiveProductUnitsService();

    res.status(200).json({
      message: "Active product units retrieved successfully",
      data: units,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get active product units",
    });
  }
};

// Get ProductUnit by ID
export const getProductUnitById = async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;

    const unit = await getProductUnitByIdService(unitId);

    res.status(200).json({
      message: "Product unit retrieved successfully",
      data: unit,
    });
  } catch (error: any) {
    if (error.message === "Product unit not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get product unit",
    });
  }
};

// Update ProductUnit
export const updateProductUnit = async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;
    const updateData = req.body;
    const adminId = (req as any).user.id;

    const updatedUnit = await updateProductUnitService(
      unitId,
      updateData,
      adminId
    );

    res.status(200).json({
      message: "Product unit updated successfully",
      data: updatedUnit,
    });
  } catch (error: any) {
    if (error.message === "Product unit not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (
      error.message === "Only ADMIN users can update product units" ||
      error.message === "Product unit name already exists"
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update product unit",
    });
  }
};

// Delete ProductUnit
export const deleteProductUnit = async (req: Request, res: Response) => {
  try {
    const { unitId } = req.params;

    const result = await deleteProductUnitService(unitId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "Product unit not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to delete product unit",
    });
  }
};

// Bulk update unit status (activate/deactivate)
export const updateUnitStatus = async (req: Request, res: Response) => {
  try {
    const { unitIds, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!unitIds || !Array.isArray(unitIds) || unitIds.length === 0) {
      return res.status(400).json({
        message: "Unit IDs array is required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive boolean value is required",
      });
    }

    const result = await updateUnitStatusService(unitIds, isActive, adminId);

    res.status(200).json({
      message: result.message,
      data: {
        updatedCount: result.updatedCount,
      },
    });
  } catch (error: any) {
    if (error.message === "Only ADMIN users can update product units") {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update unit status",
    });
  }
};