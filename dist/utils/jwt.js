"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, config_1.ENV.JWT_SECRET, {
        expiresIn: "24h",
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    const decoded = jsonwebtoken_1.default.verify(token, config_1.ENV.JWT_SECRET);
    if (typeof decoded === "string") {
        throw new Error("Invalid token payload");
    }
    return decoded;
};
exports.verifyToken = verifyToken;
