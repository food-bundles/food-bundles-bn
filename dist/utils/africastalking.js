"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const africastalking_1 = __importDefault(require("africastalking"));
const AT = (0, africastalking_1.default)({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
});
exports.default = AT;
