"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSubmission = exports.getVerifiedSubmissions = exports.getProductById = exports.getProductsByRole = exports.getAllProducts = exports.deleteProduct = exports.updateProduct = exports.createProductFromSubmission = exports.updateProductQuantityFromSubmission = exports.createProduct = void 0;
const productService_1 = require("../services/productService");
const imageUpload_1 = require("../utils/imageUpload");
const prisma_1 = __importDefault(require("../prisma"));
const cloudinary_utility_1 = __importDefault(require("../utils/cloudinary.utility"));
const index_1 = require("../index");
const createProduct = async (req, res) => {
    try {
        const { productName, unitPrice, purchasePrice, categoryId, bonus, sku, quantity, expiryDate, unit, } = req.body;
        const adminId = req.user.id;
        // Handle image upload
        let imageUrls = [];
        // Type guard to check if req.files is a dictionary
        if (req.files && !Array.isArray(req.files)) {
            const filesDict = req.files;
            if (filesDict["images"]) {
                for (let index = 0; index < filesDict["images"].length; index++) {
                    const uploadResult = await cloudinary_utility_1.default.v2.uploader.upload(filesDict["images"][index].path);
                    imageUrls.push(uploadResult.secure_url);
                }
            }
        }
        const product = await (0, productService_1.createProductService)({
            productName,
            unitPrice,
            purchasePrice,
            categoryId,
            bonus,
            sku,
            quantity,
            images: imageUrls.length > 0 ? imageUrls : [],
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            unit,
            createdBy: adminId,
        });
        // ✅ BROADCAST NEW PRODUCT VIA WEBSOCKET
        index_1.wsManager.broadcastNewProduct(product);
        res.status(201).json({
            message: "Product created successfully",
            data: product,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create product",
        });
    }
};
exports.createProduct = createProduct;
const updateProductQuantityFromSubmission = async (req, res) => {
    try {
        const { submissionId, productId } = req.params;
        const adminId = req.user.id;
        // Verify admin
        const admin = await prisma_1.default.admin.findUnique({
            where: { id: adminId },
        });
        if (!admin || admin.role !== "ADMIN") {
            throw new Error("Only ADMIN users can perform this action");
        }
        const result = await (0, productService_1.updateProductQuantityFromSubmissionService)({
            submissionId,
            productId,
        });
        // ✅ BROADCAST PRODUCT UPDATE VIA WEBSOCKET
        index_1.wsManager.broadcastProductUpdate({
            productId: result.product.id,
            productName: result.product.productName,
            action: "UPDATED",
            timestamp: new Date().toISOString(),
            data: result,
        });
        res.status(200).json({
            message: "Product quantity updated and submission approved successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update product quantity",
        });
    }
};
exports.updateProductQuantityFromSubmission = updateProductQuantityFromSubmission;
const createProductFromSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { productName, unitPrice, purchasePrice, categoryId, bonus, sku, quantity, expiryDate, unit, } = req.body;
        const adminId = req.user.id;
        // Handle image upload
        const images = req.files;
        let imageUrls = [];
        if (images && images.length > 0) {
            if (images.length > 4) {
                return res.status(400).json({
                    message: "Maximum 4 images allowed",
                });
            }
            imageUrls = await (0, imageUpload_1.uploadImages)(images);
        }
        const existingQty = await prisma_1.default.farmerSubmission.findUnique({
            where: { id: submissionId },
            select: { acceptedQty: true, productName: true },
        });
        const result = await (0, productService_1.createProductFromSubmissionService)({
            submissionId,
            productData: {
                productName: existingQty?.productName || productName,
                unitPrice,
                purchasePrice,
                categoryId,
                bonus,
                sku,
                quantity: existingQty?.acceptedQty || quantity,
                images: imageUrls,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                unit,
                createdBy: adminId,
            },
        });
        // ✅ BROADCAST NEW PRODUCT VIA WEBSOCKET
        index_1.wsManager.broadcastNewProduct(result.product);
        res.status(201).json({
            message: "Product created and submission approved successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create product",
        });
    }
};
exports.createProductFromSubmission = createProductFromSubmission;
// Update existing product
const updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const updateData = req.body;
        const adminId = req.user.id;
        // Handle image upload
        let imageUrls = [];
        // Type guard to check if req.files is a dictionary
        if (req.files && !Array.isArray(req.files)) {
            const filesDict = req.files;
            if (filesDict["images"]) {
                for (let index = 0; index < filesDict["images"].length; index++) {
                    const uploadResult = await cloudinary_utility_1.default.v2.uploader.upload(filesDict["images"][index].path);
                    imageUrls.push(uploadResult.secure_url);
                }
            }
            updateData.images = imageUrls.length > 0 ? imageUrls : [];
        }
        if (updateData.expiryDate) {
            updateData.expiryDate = new Date(updateData.expiryDate);
        }
        const result = await (0, productService_1.updateProductService)(productId, updateData, adminId);
        // ✅ BROADCAST PRODUCT UPDATE VIA WEBSOCKET
        index_1.wsManager.broadcastProductUpdate({
            productId: result.id,
            productName: result.productName,
            action: "UPDATED",
            timestamp: new Date().toISOString(),
            data: result,
        });
        res.status(200).json({
            message: "Product updated successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update product",
        });
    }
};
exports.updateProduct = updateProduct;
// Delete product
const deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        await (0, productService_1.deleteProductService)(productId);
        // ✅ BROADCAST PRODUCT DELETION VIA WEBSOCKET
        index_1.wsManager.broadcastProductUpdate({
            productId,
            productName: "Deleted Product",
            action: "DELETED",
            timestamp: new Date().toISOString(),
        });
        res.status(200).json({
            message: "Product deleted successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to delete product",
        });
    }
};
exports.deleteProduct = deleteProduct;
// Get all products
const getAllProducts = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 10 } = req.query;
        const result = await (0, productService_1.getAllProductsService)({
            category: category,
            search: search,
            page: parseInt(page),
            limit: parseInt(limit),
        });
        res.status(200).json({
            message: "Products retrieved successfully",
            data: result.products,
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
            message: error.message || "Failed to get products",
        });
    }
};
exports.getAllProducts = getAllProducts;
// Get products by user role
const getProductsByRole = async (req, res) => {
    try {
        const { category, search, page = 1, limit = 10 } = req.query;
        const userRole = req.user.role;
        // Validate role
        const validRoles = ["ADMIN", "AGGREGATOR", "LOGISTICS"];
        if (!validRoles.includes(userRole)) {
            return res.status(403).json({
                message: "Access denied. Invalid user role.",
            });
        }
        const result = await (0, productService_1.getProductsByRoleService)({
            role: userRole,
            category: category,
            search: search,
            page: parseInt(page),
            limit: parseInt(limit),
        });
        res.status(200).json({
            message: "Products retrieved successfully",
            data: result.products,
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
            message: error.message || "Failed to get products",
        });
    }
};
exports.getProductsByRole = getProductsByRole;
// Get product by ID
const getProductById = async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await (0, productService_1.getProductByIdService)(productId);
        res.status(200).json({
            message: "Product retrieved successfully",
            data: product,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get product",
        });
    }
};
exports.getProductById = getProductById;
// Get verified submissions ready for approval
const getVerifiedSubmissions = async (req, res) => {
    try {
        const submissions = await (0, productService_1.getVerifiedSubmissionsService)();
        res.status(200).json({
            message: "Verified submissions retrieved successfully",
            data: submissions,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get verified submissions",
        });
    }
};
exports.getVerifiedSubmissions = getVerifiedSubmissions;
// Approve submission without creating product (direct approval)
const approveSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const result = await (0, productService_1.approveSubmissionService)(submissionId);
        // NEW PRODUCT VIA WEBSOCKET
        index_1.wsManager.broadcastNewProduct(result);
        res.status(200).json({
            message: "Submission approved successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to approve submission",
        });
    }
};
exports.approveSubmission = approveSubmission;
