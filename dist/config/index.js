"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    DATABASE_URL: process.env.DATABASE_URL,
    PORT: parseInt(process.env.PORT || "4000", 10),
    AT_USERNAME: process.env.AT_USERNAME,
    AT_API_KEY: process.env.AT_API_KEY,
    JWT_SECRET: process.env.JWT_SECRET || "qwertyuiopasdfghjklzxcvbnm1234567890",
    JWT_EXPIRATION: process.env.JWT_EXPIRATION || "24h",
};
