"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/products");
    },
    filename: (req, file, cb) => {
        const uniqueName = `${(0, uuid_1.v4)()}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: function (req, file, callback) {
        if (file.mimetype === "image/jpeg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/jpg" ||
            file.mimetype === "image/webp" ||
            file.mimetype === "image/gif") {
            callback(null, true);
        }
        else {
            // prevent to upload files
            console.log("only jpeg, jpg, gif, webp & png supported!");
            callback(null, false);
        }
    },
});
const productImagesUpload = upload.fields([{ name: "images", maxCount: 15 }]);
exports.default = productImagesUpload;
