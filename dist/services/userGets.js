"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserByPhone = exports.getUserByEmail = exports.getUserById = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const getUserById = async (id) => {
    const farmer = await prisma_1.default.farmer.findUnique({ where: { id } });
    if (farmer)
        return { ...farmer, userType: "FARMER" };
    const restaurant = await prisma_1.default.restaurant.findUnique({ where: { id } });
    if (restaurant)
        return { ...restaurant, userType: "RESTAURANT" };
    const admin = await prisma_1.default.admin.findUnique({ where: { id } });
    if (admin)
        return { ...admin, userType: "ADMIN" };
    return null;
};
exports.getUserById = getUserById;
const getUserByEmail = async (email) => {
    const farmer = await prisma_1.default.farmer.findUnique({ where: { email } });
    if (farmer)
        return { ...farmer, userType: "FARMER" };
    const restaurant = await prisma_1.default.restaurant.findUnique({ where: { email } });
    if (restaurant)
        return { ...restaurant, userType: "RESTAURANT" };
    const admin = await prisma_1.default.admin.findUnique({ where: { email } });
    if (admin)
        return { ...admin, userType: "ADMIN" };
    return null;
};
exports.getUserByEmail = getUserByEmail;
const getUserByPhone = async (phone) => {
    const farmer = await prisma_1.default.farmer.findUnique({ where: { phone } });
    if (farmer)
        return { ...farmer, userType: "FARMER" };
    const restaurant = await prisma_1.default.restaurant.findUnique({ where: { phone } });
    if (restaurant)
        return { ...restaurant, userType: "RESTAURANT" };
    return null; // Admin doesn't have phone field
};
exports.getUserByPhone = getUserByPhone;
