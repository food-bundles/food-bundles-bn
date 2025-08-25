"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSubmissionService = exports.getVerifiedSubmissionsService = exports.getProductByIdService = exports.getAllProductsService = exports.deleteProductService = exports.createProductFromSubmissionService = exports.updateProductService = exports.updateProductQuantityFromSubmissionService = exports.createProductService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const createProductService = async (productData) => {
    // Check if admin exists
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: productData.createdBy },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can create products");
    }
    // Check if SKU already exists
    const existingSku = await prisma_1.default.product.findUnique({
        where: { sku: productData.sku },
    });
    if (existingSku) {
        throw new Error("SKU already exists");
    }
    // Create the product with proper admin connection
    const product = await prisma_1.default.product.create({
        data: {
            productName: productData.productName,
            unitPrice: Number(productData.unitPrice),
            category: productData.category,
            bonus: Number(productData.bonus) || 0, // Use || instead of ?? for NaN handling
            sku: productData.sku,
            quantity: Number(productData.quantity),
            images: productData.images,
            expiryDate: productData.expiryDate,
            unit: productData.unit,
            admin: {
                connect: {
                    id: productData.createdBy,
                },
            },
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
    return product;
};
exports.createProductService = createProductService;
// Update product quantity from submission
const updateProductQuantityFromSubmissionService = async ({ submissionId, productId, }) => {
    // Check if submission exists and is VERIFIED
    const submission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
    });
    if (!submission) {
        throw new Error("Farmer submission not found");
    }
    if (submission.status !== "VERIFIED") {
        throw new Error("Only VERIFIED submissions can be approved");
    }
    // Check if product exists
    const product = await prisma_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!product) {
        throw new Error("Product not found");
    }
    // Update product quantity and submission status in a transaction
    const result = await prisma_1.default.$transaction(async (tx) => {
        // Update product quantity
        const updatedProduct = await tx.product.update({
            where: { id: productId },
            data: {
                quantity: {
                    increment: submission.acceptedQty || 0,
                },
            },
        });
        // Update submission status to APPROVED and link to product
        const updatedSubmission = await tx.farmerSubmission.update({
            where: { id: submissionId },
            data: {
                status: "APPROVED",
                approvedAt: new Date(),
                approvedProductId: product.id,
            },
            include: {
                farmer: {
                    select: {
                        id: true,
                        phone: true,
                    },
                },
                aggregator: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    },
                },
                approvedProduct: {
                    select: {
                        id: true,
                        productName: true,
                        sku: true,
                        unitPrice: true,
                    },
                },
            },
        });
        return {
            product: updatedProduct,
            submission: updatedSubmission,
        };
    });
    return result;
};
exports.updateProductQuantityFromSubmissionService = updateProductQuantityFromSubmissionService;
// Update existing product
const updateProductService = async (productId, updateData, adminId) => {
    // Check if product exists
    const existingProduct = await prisma_1.default.product.findUnique({
        where: { id: productId },
    });
    if (!existingProduct) {
        throw new Error("Product not found");
    }
    // Check if admin has permission
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: adminId },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can update products");
    }
    // Check SKU uniqueness if SKU is being updated
    if (updateData.sku && updateData.sku !== existingProduct.sku) {
        const existingSku = await prisma_1.default.product.findUnique({
            where: { sku: updateData.sku },
        });
        if (existingSku) {
            throw new Error("SKU already exists");
        }
    }
    // Update product
    const updatedProduct = await prisma_1.default.product.update({
        where: { id: productId },
        data: {
            ...(updateData.productName !== undefined && {
                productName: updateData.productName,
            }),
            ...(updateData.unitPrice !== undefined && {
                unitPrice: Number(updateData.unitPrice),
            }),
            ...(updateData.category !== undefined && {
                category: updateData.category,
            }),
            ...(updateData.bonus !== undefined && {
                bonus: Number(updateData.bonus),
            }),
            ...(updateData.sku !== undefined && { sku: updateData.sku }),
            ...(updateData.quantity !== undefined && {
                quantity: Number(updateData.quantity),
            }),
            ...(updateData.images !== undefined && { images: updateData.images }),
            ...(updateData.expiryDate !== undefined && {
                expiryDate: updateData.expiryDate,
            }),
            ...(updateData.unit !== undefined && { unit: updateData.unit }),
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
    return updatedProduct;
};
exports.updateProductService = updateProductService;
// Create product from verified farmer submission and approve it
const createProductFromSubmissionService = async ({ submissionId, productData, }) => {
    // Check if submission exists and is VERIFIED
    const submission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
        include: {
            farmer: {
                select: {
                    id: true,
                    phone: true,
                },
            },
            aggregator: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
        },
    });
    if (!submission) {
        throw new Error("Farmer submission not found");
    }
    if (submission.status !== "VERIFIED") {
        throw new Error("Only VERIFIED submissions can be approved");
    }
    // Check if admin exists
    const admin = await prisma_1.default.admin.findUnique({
        where: { id: productData.createdBy },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Only ADMIN users can create products");
    }
    // Check if SKU already exists
    const existingSku = await prisma_1.default.product.findUnique({
        where: { sku: productData.sku },
    });
    if (existingSku) {
        throw new Error("SKU already exists");
    }
    // Create product and update submission status in a transaction
    const result = await prisma_1.default.$transaction(async (tx) => {
        // Create the product
        const product = await tx.product.create({
            data: {
                productName: productData.productName,
                unitPrice: productData.unitPrice,
                category: productData.category,
                bonus: productData.bonus ?? 0,
                sku: productData.sku,
                quantity: productData.quantity,
                images: productData.images,
                expiryDate: productData.expiryDate,
                unit: productData.unit,
                createdBy: productData.createdBy,
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
        // Update submission status to APPROVED and link to product
        const updatedSubmission = await tx.farmerSubmission.update({
            where: { id: submissionId },
            data: {
                status: "APPROVED",
                approvedAt: new Date(),
                approvedProductId: product.id,
            },
            include: {
                farmer: {
                    select: {
                        id: true,
                        phone: true,
                    },
                },
                aggregator: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                    },
                },
                approvedProduct: {
                    select: {
                        id: true,
                        productName: true,
                        sku: true,
                        unitPrice: true,
                    },
                },
            },
        });
        return {
            product,
            submission: updatedSubmission,
        };
    });
    return result;
};
exports.createProductFromSubmissionService = createProductFromSubmissionService;
// Update existing product
// export const updateProductService = async (
//   productId: string,
//   updateData: Partial<ProductData>,
//   adminId: string
// ) => {
//   // Check if product exists
//   const existingProduct = await prisma.product.findUnique({
//     where: { id: productId },
//   });
//   if (!existingProduct) {
//     throw new Error("Product not found");
//   }
//   // Check if admin has permission
//   const admin = await prisma.admin.findUnique({
//     where: { id: adminId },
//   });
//   if (!admin || admin.role !== "ADMIN") {
//     throw new Error("Only ADMIN users can update products");
//   }
//   // Check SKU uniqueness if SKU is being updated
//   if (updateData.sku && updateData.sku !== existingProduct.sku) {
//     const existingSku = await prisma.product.findUnique({
//       where: { sku: updateData.sku },
//     });
//     if (existingSku) {
//       throw new Error("SKU already exists");
//     }
//   }
//   // Update product
//   const updatedProduct = await prisma.product.update({
//     where: { id: productId },
//     data: updateData,
//     include: {
//       admin: {
//         select: {
//           id: true,
//           username: true,
//           email: true,
//         },
//       },
//     },
//   });
//   return updatedProduct;
// };
// Delete product
const deleteProductService = async (productId) => {
    // Check if product has any orders
    const productWithOrders = await prisma_1.default.product.findUnique({
        where: { id: productId },
        include: {
            orderItems: true,
        },
    });
    if (!productWithOrders) {
        throw new Error("Product not found");
    }
    if (productWithOrders.orderItems.length > 0) {
        throw new Error("Cannot delete product that has been ordered");
    }
    // Delete product
    await prisma_1.default.product.delete({
        where: { id: productId },
    });
};
exports.deleteProductService = deleteProductService;
// Get all products with filtering and pagination
const getAllProductsService = async ({ category, search, page = 1, limit = 10, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (category) {
        where.category = category;
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { quantity: { gt: 0 }, status: "ACTIVE" },
        ];
    }
    const [products, total] = await Promise.all([
        prisma_1.default.product.findMany({
            where,
            skip,
            take: limit,
            include: {
                farmerSubmissions: false,
                admin: false,
                orderItems: false,
                CartItem: false,
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.product.count({ where }),
    ]);
    return {
        products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllProductsService = getAllProductsService;
// Get product by ID
const getProductByIdService = async (productId) => {
    const product = await prisma_1.default.product.findUnique({
        where: { id: productId },
        include: {
            admin: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
            farmerSubmissions: {
                include: {
                    farmer: {
                        select: {
                            id: true,
                            phone: true,
                        },
                    },
                },
            },
        },
    });
    if (!product) {
        throw new Error("Product not found");
    }
    return product;
};
exports.getProductByIdService = getProductByIdService;
// Get verified submissions ready for approval
const getVerifiedSubmissionsService = async () => {
    const submissions = await prisma_1.default.farmerSubmission.findMany({
        where: {
            status: "VERIFIED",
            approvedProductId: null, // Not yet converted to product
        },
        include: {
            farmer: {
                select: {
                    id: true,
                    phone: true,
                },
            },
            aggregator: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
        },
        orderBy: {
            verifiedAt: "asc",
        },
    });
    return submissions;
};
exports.getVerifiedSubmissionsService = getVerifiedSubmissionsService;
// Approve submission without creating product
const approveSubmissionService = async (submissionId) => {
    const submission = await prisma_1.default.farmerSubmission.findUnique({
        where: { id: submissionId },
    });
    if (!submission) {
        throw new Error("Submission not found");
    }
    if (submission.status !== "VERIFIED") {
        throw new Error("Only VERIFIED submissions can be approved");
    }
    if (submission.farmerFeedbackStatus !== "ACCEPTED") {
        throw new Error("Only submissions with ACCEPTED feedback from farmer can be approved");
    }
    const updatedSubmission = await prisma_1.default.farmerSubmission.update({
        where: { id: submissionId },
        data: {
            status: "APPROVED",
            approvedAt: new Date(),
        },
        include: {
            farmer: {
                select: {
                    id: true,
                    phone: true,
                },
            },
            aggregator: {
                select: {
                    id: true,
                    username: true,
                    email: true,
                },
            },
        },
    });
    if (!updatedSubmission) {
        throw new Error("Submission not found");
    }
    // Update product quantity of same name of farmer submission
    await prisma_1.default.product.update({
        where: {
            productName: submission.productName,
        },
        data: {
            quantity: {
                increment: submission.acceptedQty ?? 0,
            },
        },
    });
    return updatedSubmission;
};
exports.approveSubmissionService = approveSubmissionService;
