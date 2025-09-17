"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImages = exports.deleteImages = exports.uploadImages = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
// Create uploads directory if it doesn't exist
const uploadDir = "uploads/products";
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Multer configuration for image upload
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
// File filter to accept only images
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
    }
};
// Multer upload configuration
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit per file
        files: 4, // Maximum 4 files
    },
});
// Function to upload images and return URLs
const uploadImages = async (files) => {
    if (!files || files.length === 0) {
        return [];
    }
    if (files.length > 4) {
        throw new Error("Maximum 4 images allowed");
    }
    // Generate URLs for uploaded files
    const imageUrls = files.map((file) => {
        return `/uploads/products/${file.filename}`;
    });
    return imageUrls;
};
exports.uploadImages = uploadImages;
// Function to delete images from disk
const deleteImages = async (imageUrls) => {
    for (const url of imageUrls) {
        try {
            const filename = path_1.default.basename(url);
            const filePath = path_1.default.join(uploadDir, filename);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.error(`Error deleting image ${url}:`, error);
        }
    }
};
exports.deleteImages = deleteImages;
// Middleware to handle image validation
const validateImages = (req, res, next) => {
    const files = req.files;
    if (!files || files.length === 0) {
        return next();
    }
    if (files.length > 4) {
        return res.status(400).json({
            message: "Maximum 4 images allowed",
        });
    }
    // Check file sizes
    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                message: "Each image must be less than 5MB",
            });
        }
    }
    next();
};
exports.validateImages = validateImages;
