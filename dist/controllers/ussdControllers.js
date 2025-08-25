"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitProductController = exports.ussdHealthCheck = exports.ussdHandler = void 0;
const ussdServices_1 = require("../services/ussdServices");
const errorhandler_utlity_1 = __importStar(require("../utils/errorhandler.utlity"));
const ussdHandler = async (req, res) => {
    try {
        const { sessionId, serviceCode, phoneNumber, text } = req.body;
        // Validate required parameters
        if (!sessionId) {
            return res.status(400).json({
                error: "sessionId is required",
                sessionId: null,
                timestamp: new Date().toISOString(),
            });
        }
        if (!phoneNumber) {
            return res.status(400).json({
                error: "phoneNumber is required",
                sessionId,
                timestamp: new Date().toISOString(),
            });
        }
        // Validate phone number format (basic validation)
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber)) {
            return res.status(400).json({
                error: "Invalid phone number format",
                sessionId,
                timestamp: new Date().toISOString(),
            });
        }
        const response = await (0, ussdServices_1.handleUssdLogic)({
            sessionId,
            serviceCode,
            phoneNumber,
            text: text || "",
        });
        res.set("Content-Type", "text/plain");
        res.send(response);
    }
    catch (error) {
        console.error("USSD Handler Error:", error);
        res.status(500).json({
            error: error.message || "Internal system error occurred",
            sessionId: req.body?.sessionId || null,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.ussdHandler = ussdHandler;
const ussdHealthCheck = async (req, res) => {
    try {
        res.set("Content-Type", "text/plain");
        res.send("USSD endpoint is working! Use POST method.");
    }
    catch (error) {
        res.status(503).send("USSD service temporarily unavailable");
    }
};
exports.ussdHealthCheck = ussdHealthCheck;
exports.submitProductController = (0, errorhandler_utlity_1.catchAsyncError)(async (req, res, next) => {
    const userId = req.user?.id;
    const { productName, category, quantity, wishedPrice, province, district, sector, cell, village, } = req.body;
    // Validate required fields
    if (!productName ||
        !quantity ||
        !wishedPrice ||
        !province ||
        !district ||
        !sector ||
        !cell ||
        !village) {
        return next(new errorhandler_utlity_1.default({
            message: "productName, quantity, wishedPrice, province, district, sector, cell, and village are required",
            statusCode: 400,
        }));
    }
    // Validate numeric fields
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
        return next(new errorhandler_utlity_1.default({
            message: "quantity must be a positive number",
            statusCode: 400,
        }));
    }
    if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
        return next(new errorhandler_utlity_1.default({
            message: "wishedPrice must be a positive number",
            statusCode: 400,
        }));
    }
    // Validate user authentication
    if (!userId) {
        return next(new errorhandler_utlity_1.default({
            message: "User authentication required",
            statusCode: 401,
        }));
    }
    const submissionData = {
        farmerId: userId,
        productName: productName.trim(),
        category: category || "OTHER",
        submittedQty: parseFloat(quantity),
        wishedPrice: parseFloat(wishedPrice),
        province,
        district,
        sector,
        cell,
        village,
    };
    const result = await (0, ussdServices_1.submitProductService)(submissionData);
    res.status(201).json({
        success: true,
        message: "Product submitted successfully",
        data: result,
    });
});
