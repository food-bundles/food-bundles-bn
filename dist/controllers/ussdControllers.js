"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitProductController = exports.ussdHandler = void 0;
const ussdServices_1 = require("../services/ussdServices");
const ussdHandler = async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;
    const response = await (0, ussdServices_1.handleUssdLogic)({
        sessionId,
        serviceCode,
        phoneNumber,
        text,
    });
    res.set("Content-Type", "text/plain");
    res.send(response);
};
exports.ussdHandler = ussdHandler;
const submitProductController = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { productName, quantity, wishedPrice } = req.body;
        if (!productName || !quantity || !wishedPrice) {
            return res.status(400).json({
                success: false,
                message: "productName, quantity, and wishedPrice are required",
            });
        }
        if (quantity <= 0 || wishedPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: "quantity and wishedPrice must be positive numbers",
            });
        }
        const submissionData = {
            farmerId: userId,
            productName,
            submittedQty: quantity,
            wishedPrice,
        };
        const result = await (0, ussdServices_1.submitProductService)(submissionData);
        res.status(201).json({
            success: true,
            message: "Product submitted successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || "Failed to submit product",
        });
    }
};
exports.submitProductController = submitProductController;
