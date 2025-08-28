import { Request, Response } from "express";
import {
  createProductCategoryService,
  getAllProductCategoriesService,
  getProductCategoryByIdService,
  updateProductCategoryService,
  deleteProductCategoryService,
  getActiveProductCategoriesService,
  updateCategoryStatusService,
} from "../services/product_category.service";

// Create ProductCategory
export const createProductCategory = async (req: Request, res: Response) => {
  try {
    const { name, description, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const productCategory = await createProductCategoryService({
      name,
      description,
      isActive,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Product category created successfully",
      data: productCategory,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create product category",
    });
  }
};

// Get all ProductCategories
export const getAllProductCategories = async (req: Request, res: Response) => {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await getAllProductCategoriesService({
      search: search as string,
      isActive: isActive ? isActive === "true" : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Product categories retrieved successfully",
      data: result.categories,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get product categories",
    });
  }
};

// Get active ProductCategories for dropdown/selection
export const getActiveProductCategories = async (
  req: Request,
  res: Response
) => {
  try {
    const categories = await getActiveProductCategoriesService();

    res.status(200).json({
      message: "Active product categories retrieved successfully",
      data: categories,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get active product categories",
    });
  }
};

// Get ProductCategory by ID
export const getProductCategoryById = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const category = await getProductCategoryByIdService(categoryId);

    res.status(200).json({
      message: "Product category retrieved successfully",
      data: category,
    });
  } catch (error: any) {
    if (error.message === "Product category not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get product category",
    });
  }
};

// Update ProductCategory
export const updateProductCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const updateData = req.body;
    const adminId = (req as any).user.id;

    const updatedCategory = await updateProductCategoryService(
      categoryId,
      updateData,
      adminId
    );

    res.status(200).json({
      message: "Product category updated successfully",
      data: updatedCategory,
    });
  } catch (error: any) {
    if (error.message === "Product category not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (
      error.message === "Only ADMIN users can update product categories" ||
      error.message === "Product category name already exists"
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update product category",
    });
  }
};

// Delete ProductCategory
export const deleteProductCategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const result = await deleteProductCategoryService(categoryId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "Product category not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (
      error.message.includes("Cannot delete category") ||
      error.message.includes("associated products") ||
      error.message.includes("associated farmer submissions")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to delete product category",
    });
  }
};

// Bulk update category status (activate/deactivate)
export const updateCategoryStatus = async (req: Request, res: Response) => {
  try {
    const { categoryIds, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({
        message: "Category IDs array is required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive boolean value is required",
      });
    }

    const result = await updateCategoryStatusService(
      categoryIds,
      isActive,
      adminId
    );

    res.status(200).json({
      message: result.message,
      data: {
        updatedCount: result.updatedCount,
      },
    });
  } catch (error: any) {
    if (error.message === "Only ADMIN users can update product categories") {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update category status",
    });
  }
};