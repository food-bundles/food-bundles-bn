"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ussdHealthCheck = exports.ussdHandler = void 0;
const ussdServices_1 = require("../services/ussdServices");
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
