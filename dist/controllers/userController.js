"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const userServices_1 = require("../services/userServices");
const paginationService_1 = require("../services/paginationService");
const client_1 = require("@prisma/client");
const jwt_1 = require("../utils/jwt");
const prisma_1 = __importDefault(require("../prisma"));
class UserController {
}
exports.UserController = UserController;
_a = UserController;
UserController.createFarmer = async (req, res) => {
    try {
        const farmerData = req.body;
        const result = await (0, userServices_1.createFarmerService)(farmerData);
        res.status(201).json({
            success: true,
            message: "Farmer created successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.createRestaurant = async (req, res) => {
    try {
        const restaurantData = req.body;
        const result = await (0, userServices_1.createRestaurantService)(restaurantData);
        res.status(201).json({
            success: true,
            message: "Restaurant created successfully",
            data: result,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.createAdmin = async (req, res) => {
    try {
        const adminData = req.body;
        const result = await (0, userServices_1.createAdminService)(adminData);
        const isAdmin = result.role === client_1.Role.ADMIN;
        let sms;
        if (isAdmin) {
            sms = "Admin created successfully";
        }
        else {
            sms = "AGGREGATOR created successfully";
        }
        res.status(201).json({
            success: true,
            message: sms,
            data: result,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getAllFarmers = async (req, res) => {
    try {
        const { page, limit } = req.query;
        const paginationQuery = paginationService_1.PaginationService.validatePaginationParams(page, limit);
        const farmers = await (0, userServices_1.getAllFarmersService)(paginationQuery);
        res.status(200).json({
            success: true,
            data: farmers,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getAllRestaurants = async (req, res) => {
    try {
        const { page, limit } = req.query;
        const paginationQuery = paginationService_1.PaginationService.validatePaginationParams(page, limit);
        const restaurants = await (0, userServices_1.getAllRestaurantsService)(paginationQuery);
        res.status(200).json({
            success: true,
            data: restaurants,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getAllAdmins = async (req, res) => {
    try {
        const { page, limit } = req.query;
        const paginationQuery = paginationService_1.PaginationService.validatePaginationParams(page, limit);
        const admins = await (0, userServices_1.getAllAdminsService)(paginationQuery);
        res.status(200).json({
            success: true,
            data: admins,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getFarmerById = async (req, res) => {
    try {
        const { id } = req.params;
        const farmer = await (0, userServices_1.getFarmerByIdService)(id);
        if (!farmer) {
            return res.status(404).json({
                success: false,
                message: "Farmer not found",
            });
        }
        res.status(200).json({
            success: true,
            data: farmer,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getRestaurantById = async (req, res) => {
    try {
        const { id } = req.params;
        const restaurant = await (0, userServices_1.getRestaurantByIdService)(id);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found",
            });
        }
        res.status(200).json({
            success: true,
            data: restaurant,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.getAdminById = async (req, res) => {
    try {
        const { id } = req.params;
        const admin = await (0, userServices_1.getAdminByIdService)(id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found",
            });
        }
        res.status(200).json({
            success: true,
            data: admin,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.updateFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const updatedFarmer = await (0, userServices_1.updateFarmerService)(id, updateData);
        res.status(200).json({
            success: true,
            message: "Farmer updated successfully",
            data: updatedFarmer,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.updateRestaurant = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const updatedRestaurant = await (0, userServices_1.updateRestaurantService)(id, updateData);
        res.status(200).json({
            success: true,
            message: "Restaurant updated successfully",
            data: updatedRestaurant,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.updateAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const updatedAdmin = await (0, userServices_1.updateAdminService)(id, updateData);
        res.status(200).json({
            success: true,
            message: "Admin updated successfully",
            data: updatedAdmin,
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.deleteFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        await (0, userServices_1.deleteFarmerService)(id);
        res.status(200).json({
            success: true,
            message: "Farmer deleted successfully",
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.deleteRestaurant = async (req, res) => {
    try {
        const { id } = req.params;
        await (0, userServices_1.deleteRestaurantService)(id);
        res.status(200).json({
            success: true,
            message: "Restaurant deleted successfully",
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        await (0, userServices_1.deleteAdminService)(id);
        res.status(200).json({
            success: true,
            message: "Admin deleted successfully",
        });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.login = async (req, res) => {
    try {
        const { phone, email, password } = req.body;
        if (!password || (!phone && !email)) {
            return res.status(400).json({
                success: false,
                message: "Phone/Email and password are required",
            });
        }
        const result = await (0, userServices_1.loginService)({ phone, email, password });
        const user = result.user;
        const payload = {
            id: user.id,
        };
        const token = (0, jwt_1.generateToken)(payload);
        // Remove all cookie-related code
        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            data: result,
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            message: error.message,
        });
    }
};
UserController.me = async (req, res) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "No token provided" });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const payload = (0, jwt_1.verifyToken)(token);
        if (!payload) {
            return res.status(401).json({ message: "Invalid token" });
        }
        let user = null;
        let userRole = "";
        user = await prisma_1.default.farmer.findUnique({ where: { id: payload.id } });
        if (user)
            userRole = "farmer";
        if (!user) {
            user = await prisma_1.default.restaurant.findUnique({
                where: { id: payload.id },
            });
            if (user)
                userRole = "restaurant";
        }
        if (!user) {
            user = await prisma_1.default.admin.findUnique({ where: { id: payload.id } });
            if (user)
                userRole = "admin";
        }
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const { password, ...userWithoutPassword } = user;
        return res.json({
            success: true,
            user: userWithoutPassword,
            userRole,
        });
    }
    catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
