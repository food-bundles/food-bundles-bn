"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategoryStatusService = exports.getActiveProductCategoriesService = exports.deleteProductCategoryService = exports.updateProductCategoryService = exports.getProductCategoryByIdService = exports.getAllProductCategoriesService = exports.createProductCategoryService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
// Create ProductCategory
const createProductCategoryService = async (categoryData) => {
    // Check if admin exists and has permission
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: categoryData.createdBy },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can create product categories");
    }
    // Check if category name already exists (case insensitive)
    const existingCategory = await prisma_1.default.productCategory.findFirst({
        where: {
            name: {
                equals: categoryData.name,
                mode: "insensitive",
            },
        },
    });
    if (existingCategory) {
        throw new Error("Product category name already exists");
    }
    // Create the product category
    const productCategory = await prisma_1.default.productCategory.create({
        data: {
            name: categoryData.name.trim(),
            description: categoryData.description?.trim(),
            isActive: categoryData.isActive ?? true,
            createdBy: categoryData.createdBy,
        },
        include: {
            admin: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
        },
    });
    return productCategory;
};
exports.createProductCategoryService = createProductCategoryService;
// Get all ProductCategories with filtering and pagination
const getAllProductCategoriesService = async ({ search, isActive, page = 1, limit = 10, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (isActive !== undefined) {
        where.isActive = isActive;
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ];
    }
    const [categories, total] = await Promise.all([
        prisma_1.default.productCategory.findMany({
            where,
            skip,
            take: limit,
            include: {
                admin: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        products: true,
                        farmerSubmissions: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.productCategory.count({ where }),
    ]);
    return {
        categories,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllProductCategoriesService = getAllProductCategoriesService;
// Get ProductCategory by ID
const getProductCategoryByIdService = async (categoryId) => {
    const category = await prisma_1.default.productCategory.findUnique({
        where: { id: categoryId },
        include: {
            admin: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
            _count: {
                select: {
                    products: true,
                    farmerSubmissions: true,
                },
            },
            products: {
                select: {
                    id: true,
                    productName: true,
                    sku: true,
                    quantity: true,
                    status: true,
                },
                where: {
                    status: "ACTIVE",
                },
                take: 10, // Limit to prevent large responses
            },
        },
    });
    if (!category) {
        throw new Error("Product category not found");
    }
    return category;
};
exports.getProductCategoryByIdService = getProductCategoryByIdService;
// Update ProductCategory
const updateProductCategoryService = async (categoryId, updateData, adminId) => {
    // Check if category exists
    const existingCategory = await prisma_1.default.productCategory.findUnique({
        where: { id: categoryId },
    });
    if (!existingCategory) {
        throw new Error("Product category not found");
    }
    // Check if admin has permission
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: adminId },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can update product categories");
    }
    // Check name uniqueness if name is being updated
    if (updateData.name && updateData.name !== existingCategory.name) {
        const existingName = await prisma_1.default.productCategory.findFirst({
            where: {
                name: {
                    equals: updateData.name,
                    mode: "insensitive",
                },
                NOT: {
                    id: categoryId,
                },
            },
        });
        if (existingName) {
            throw new Error("Product category name already exists");
        }
    }
    // Update product category
    const updatedCategory = await prisma_1.default.productCategory.update({
        where: { id: categoryId },
        data: {
            ...(updateData.name !== undefined && {
                name: updateData.name.trim(),
            }),
            ...(updateData.description !== undefined && {
                description: updateData.description?.trim(),
            }),
            ...(updateData.isActive !== undefined && {
                isActive: updateData.isActive,
            }),
        },
        include: {
            admin: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
            _count: {
                select: {
                    products: true,
                    farmerSubmissions: true,
                },
            },
        },
    });
    return updatedCategory;
};
exports.updateProductCategoryService = updateProductCategoryService;
// Delete ProductCategory
const deleteProductCategoryService = async (categoryId) => {
    // Check if category exists
    const category = await prisma_1.default.productCategory.findUnique({
        where: { id: categoryId },
        include: {
            _count: {
                select: {
                    products: true,
                    farmerSubmissions: true,
                },
            },
        },
    });
    if (!category) {
        throw new Error("Product category not found");
    }
    // Check if category has associated products or submissions
    if (category._count.products > 0) {
        throw new Error("Cannot delete category that has associated products. Please reassign or delete products first.");
    }
    if (category._count.farmerSubmissions > 0) {
        throw new Error("Cannot delete category that has associated farmer submissions. Please reassign or delete submissions first.");
    }
    // Delete category
    await prisma_1.default.productCategory.delete({
        where: { id: categoryId },
    });
    return { message: "Product category deleted successfully" };
};
exports.deleteProductCategoryService = deleteProductCategoryService;
// Get active ProductCategories for dropdowns/selection
const getActiveProductCategoriesService = async () => {
    const categories = await prisma_1.default.productCategory.findMany({
        where: {
            isActive: true,
        },
        select: {
            id: true,
            name: true,
            description: true,
        },
        orderBy: {
            name: "asc",
        },
    });
    return categories;
};
exports.getActiveProductCategoriesService = getActiveProductCategoriesService;
// Bulk update category status
const updateCategoryStatusService = async (categoryIds, isActive, adminId) => {
    // Check if admin has permission
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: adminId },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can update product categories");
    }
    // Update multiple categories
    const result = await prisma_1.default.productCategory.updateMany({
        where: {
            id: {
                in: categoryIds,
            },
        },
        data: {
            isActive,
        },
    });
    return {
        message: `${result.count} categories updated successfully`,
        updatedCount: result.count,
    };
};
exports.updateCategoryStatusService = updateCategoryStatusService;
