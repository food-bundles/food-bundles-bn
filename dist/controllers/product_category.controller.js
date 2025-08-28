"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategoryStatus = exports.deleteProductCategory = exports.updateProductCategory = exports.getProductCategoryById = exports.getActiveProductCategories = exports.getAllProductCategories = exports.createProductCategory = void 0;
const product_category_service_1 = require("../services/product_category.service");
// Create ProductCategory
const createProductCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const adminId = req.user.id;
        // Validate required fields
        if (!name) {
            return res.status(400).json({
                message: "Category name is required",
            });
        }
        const productCategory = await (0, product_category_service_1.createProductCategoryService)({
            name,
            description,
            isActive,
            createdBy: adminId,
        });
        res.status(201).json({
            message: "Product category created successfully",
            data: productCategory,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create product category",
        });
    }
};
exports.createProductCategory = createProductCategory;
// Get all ProductCategories
const getAllProductCategories = async (req, res) => {
    try {
        const { search, isActive, page = 1, limit = 10 } = req.query;
        const result = await (0, product_category_service_1.getAllProductCategoriesService)({
            search: search,
            isActive: isActive ? isActive === "true" : undefined,
            page: parseInt(page),
            limit: parseInt(limit),
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
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get product categories",
        });
    }
};
exports.getAllProductCategories = getAllProductCategories;
// Get active ProductCategories for dropdown/selection
const getActiveProductCategories = async (req, res) => {
    try {
        const categories = await (0, product_category_service_1.getActiveProductCategoriesService)();
        res.status(200).json({
            message: "Active product categories retrieved successfully",
            data: categories,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get active product categories",
        });
    }
};
exports.getActiveProductCategories = getActiveProductCategories;
// Get ProductCategory by ID
const getProductCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const category = await (0, product_category_service_1.getProductCategoryByIdService)(categoryId);
        res.status(200).json({
            message: "Product category retrieved successfully",
            data: category,
        });
    }
    catch (error) {
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
exports.getProductCategoryById = getProductCategoryById;
// Update ProductCategory
const updateProductCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const updateData = req.body;
        const adminId = req.user.id;
        const updatedCategory = await (0, product_category_service_1.updateProductCategoryService)(categoryId, updateData, adminId);
        res.status(200).json({
            message: "Product category updated successfully",
            data: updatedCategory,
        });
    }
    catch (error) {
        if (error.message === "Product category not found") {
            return res.status(404).json({
                message: error.message,
            });
        }
        if (error.message === "Only ADMIN users can update product categories" ||
            error.message === "Product category name already exists") {
            return res.status(403).json({
                message: error.message,
            });
        }
        res.status(500).json({
            message: error.message || "Failed to update product category",
        });
    }
};
exports.updateProductCategory = updateProductCategory;
// Delete ProductCategory
const deleteProductCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const result = await (0, product_category_service_1.deleteProductCategoryService)(categoryId);
        res.status(200).json({
            message: result.message,
        });
    }
    catch (error) {
        if (error.message === "Product category not found") {
            return res.status(404).json({
                message: error.message,
            });
        }
        if (error.message.includes("Cannot delete category") ||
            error.message.includes("associated products") ||
            error.message.includes("associated farmer submissions")) {
            return res.status(400).json({
                message: error.message,
            });
        }
        res.status(500).json({
            message: error.message || "Failed to delete product category",
        });
    }
};
exports.deleteProductCategory = deleteProductCategory;
// Bulk update category status (activate/deactivate)
const updateCategoryStatus = async (req, res) => {
    try {
        const { categoryIds, isActive } = req.body;
        const adminId = req.user.id;
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
        const result = await (0, product_category_service_1.updateCategoryStatusService)(categoryIds, isActive, adminId);
        res.status(200).json({
            message: result.message,
            data: {
                updatedCount: result.updatedCount,
            },
        });
    }
    catch (error) {
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
exports.updateCategoryStatus = updateCategoryStatus;
