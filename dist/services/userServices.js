"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginService = exports.deleteAdminService = exports.updateAdminService = exports.getAdminByIdService = exports.getAllAdminsService = exports.createAdminService = exports.deleteRestaurantService = exports.updateRestaurantService = exports.getRestaurantByIdService = exports.getAllRestaurantsService = exports.createRestaurantService = exports.deleteFarmerService = exports.updateFarmerService = exports.getFarmerByIdService = exports.getAllFarmersService = exports.createFarmerService = void 0;
// src/services/userServices.ts
const prisma_1 = __importDefault(require("../prisma"));
const password_1 = require("../utils/password");
const paginationService_1 = require("./paginationService");
const location_service_1 = require("./location.service");
// Helper function to check for existing phone/email across all user types
const checkExistingUser = async (phone, email) => {
    if (!phone && !email)
        return null;
    const conditions = [];
    if (phone) {
        conditions.push(prisma_1.default.farmer.findFirst({ where: { phone } }), prisma_1.default.restaurant.findFirst({ where: { phone } }), prisma_1.default.admin.findFirst({ where: { phone } }));
    }
    if (email) {
        conditions.push(prisma_1.default.farmer.findFirst({ where: { email } }), prisma_1.default.restaurant.findFirst({ where: { email } }), prisma_1.default.admin.findFirst({ where: { email } }));
    }
    const results = await Promise.all(conditions);
    return results.find((result) => result !== null) || null;
};
// FARMER SERVICES
const createFarmerService = async (farmerData) => {
    const { phone, email, password, province, district, sector, cell, village } = farmerData;
    if (!phone && !email) {
        throw new Error("Either phone or email is required");
    }
    // Check if phone/email exists in any user table
    const existingUser = await checkExistingUser(phone || undefined, email || undefined);
    if (existingUser) {
        throw new Error("User with this phone/email already exists");
    }
    // Validate location data if provided
    const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
        province,
        district,
        sector,
        cell,
        village,
    });
    if (!locationValidation.isValid) {
        throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
    }
    // Remove the old farmer-specific check since we already checked globally
    try {
        let hashedPassword;
        if (password) {
            hashedPassword = await (0, password_1.hashPassword)(password);
        }
        const farmer = await prisma_1.default.farmer.create({
            data: {
                phone,
                email,
                password: hashedPassword,
                province,
                district,
                sector,
                cell,
                village,
            },
        });
        const { password: _, ...farmerWithoutPassword } = farmer;
        return farmerWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to create farmer: ${error.message}`);
    }
};
exports.createFarmerService = createFarmerService;
const getAllFarmersService = async (query) => {
    const normalizedQuery = paginationService_1.PaginationService.validatePaginationParams(query.page, query.limit);
    const options = {
        select: {
            id: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            role: true,
            phone: true,
            email: true,
            createdAt: true,
            submissions: {
                select: {
                    id: true,
                    productName: true,
                    submittedQty: true,
                    submittedAt: true,
                },
                orderBy: {
                    submittedAt: "desc",
                },
                take: 5,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    };
    const result = await paginationService_1.PaginationService.paginate(prisma_1.default.farmer, normalizedQuery, options);
    return {
        farmers: result.data,
        pagination: result.pagination,
    };
};
exports.getAllFarmersService = getAllFarmersService;
const getFarmerByIdService = async (id) => {
    const farmer = await prisma_1.default.farmer.findUnique({
        where: { id },
        select: {
            id: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            role: true,
            phone: true,
            email: true,
            createdAt: true,
            submissions: {
                select: {
                    id: true,
                    productName: true,
                    submittedQty: true,
                    submittedAt: true,
                },
                orderBy: {
                    submittedAt: "desc",
                },
            },
        },
    });
    return farmer;
};
exports.getFarmerByIdService = getFarmerByIdService;
const updateFarmerService = async (id, updateData) => {
    const { password, province, district, sector, cell, village, phone, email, ...otherData } = updateData;
    const existingFarmer = await prisma_1.default.farmer.findUnique({
        where: { id },
    });
    if (!existingFarmer) {
        throw new Error("Farmer not found");
    }
    // Check if new phone/email already exists in any user table (excluding current farmer)
    if (phone || email) {
        const existingUser = await checkExistingUser(phone || undefined, email || undefined);
        if (existingUser && existingUser.id !== id) {
            throw new Error("User with this phone/email already exists");
        }
    }
    // Validate location data if any location field is provided
    if (province || district || sector || cell || village) {
        const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
            province: province ? province : existingFarmer.province,
            district: district ? district : existingFarmer.district,
            sector: sector ? sector : existingFarmer.sector,
            cell: cell ? cell : existingFarmer.cell,
            village: village ? village : existingFarmer.village,
        });
        if (!locationValidation.isValid) {
            throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
        }
    }
    try {
        let hashedPassword;
        if (password) {
            hashedPassword = await (0, password_1.hashPassword)(password);
        }
        const updatedFarmer = await prisma_1.default.farmer.update({
            where: { id },
            data: {
                ...otherData,
                province,
                district,
                sector,
                cell,
                village,
                ...(hashedPassword && { password: hashedPassword }),
            },
        });
        const { password: _, ...farmerWithoutPassword } = updatedFarmer;
        return farmerWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to update farmer: ${error.message}`);
    }
};
exports.updateFarmerService = updateFarmerService;
const deleteFarmerService = async (id) => {
    const existingFarmer = await prisma_1.default.farmer.findUnique({
        where: { id },
    });
    if (!existingFarmer) {
        throw new Error("Farmer not found");
    }
    try {
        await prisma_1.default.farmer.delete({
            where: { id },
        });
        return { message: "Farmer deleted successfully" };
    }
    catch (error) {
        throw new Error(`Failed to delete farmer: ${error.message}`);
    }
};
exports.deleteFarmerService = deleteFarmerService;
// RESTAURANT SERVICES
const createRestaurantService = async (restaurantData) => {
    const { name, email, phone, password, province, district, sector, cell, village, } = restaurantData;
    if (!name ||
        !email ||
        !password ||
        !province ||
        !district ||
        !sector ||
        !cell ||
        !village) {
        throw new Error("Name, email, password, province, district, sector, cell, and village are required for restaurants");
    }
    // Check if phone/email exists in any user table
    const existingUser = await checkExistingUser(phone || undefined, email);
    if (existingUser) {
        throw new Error("User with this phone/email already exists");
    }
    // Validate location data if provided
    const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
        province,
        district,
        sector,
        cell,
        village,
    });
    if (!locationValidation.isValid) {
        throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
    }
    try {
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const restaurant = await prisma_1.default.restaurant.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword,
                province,
                district,
                sector,
                cell,
                village,
            },
        });
        const { password: _, ...restaurantWithoutPassword } = restaurant;
        return restaurantWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to create restaurant: ${error.message}`);
    }
};
exports.createRestaurantService = createRestaurantService;
const getAllRestaurantsService = async (query) => {
    const normalizedQuery = paginationService_1.PaginationService.validatePaginationParams(query.page, query.limit);
    const options = {
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            role: true,
            createdAt: true,
            orders: {
                select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 5,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    };
    const result = await paginationService_1.PaginationService.paginate(prisma_1.default.restaurant, normalizedQuery, options);
    return {
        restaurants: result.data,
        pagination: result.pagination,
    };
};
exports.getAllRestaurantsService = getAllRestaurantsService;
const getRestaurantByIdService = async (id) => {
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            role: true,
            createdAt: true,
            orders: {
                select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                    orderItems: {
                        select: {
                            id: true,
                            quantity: true,
                            unitPrice: true,
                            product: {
                                select: {
                                    productName: true,
                                    category: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
            posSales: {
                select: {
                    id: true,
                    totalAmount: true,
                    paymentMethod: true,
                    createdAt: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
    });
    return restaurant;
};
exports.getRestaurantByIdService = getRestaurantByIdService;
const updateRestaurantService = async (id, updateData) => {
    const { password, province, district, sector, cell, village, phone, email, ...otherData } = updateData;
    const existingRestaurant = await prisma_1.default.restaurant.findUnique({
        where: { id },
    });
    if (!existingRestaurant) {
        throw new Error("Restaurant not found");
    }
    // Check if new phone/email already exists in any user table (excluding current restaurant)
    if (phone || email) {
        const existingUser = await checkExistingUser(phone || undefined, email || undefined);
        if (existingUser && existingUser.id !== id) {
            throw new Error("User with this phone/email already exists");
        }
    }
    // Validate location data if any location field is provided
    if (province || district || sector || cell || village) {
        const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
            province: province ? province : existingRestaurant.province,
            district: district ? district : existingRestaurant.district,
            sector: sector ? sector : existingRestaurant.sector,
            cell: cell ? cell : existingRestaurant.cell,
            village: village ? village : existingRestaurant.village,
        });
        if (!locationValidation.isValid) {
            throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
        }
    }
    try {
        let hashedPassword;
        if (password) {
            hashedPassword = await (0, password_1.hashPassword)(password);
        }
        const updatedRestaurant = await prisma_1.default.restaurant.update({
            where: { id },
            data: {
                ...otherData,
                province,
                district,
                sector,
                cell,
                village,
                ...(hashedPassword && { password: hashedPassword }),
            },
        });
        const { password: _, ...restaurantWithoutPassword } = updatedRestaurant;
        return restaurantWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to update restaurant: ${error.message}`);
    }
};
exports.updateRestaurantService = updateRestaurantService;
const deleteRestaurantService = async (id) => {
    const existingRestaurant = await prisma_1.default.restaurant.findUnique({
        where: { id },
    });
    if (!existingRestaurant) {
        throw new Error("Restaurant not found");
    }
    try {
        await prisma_1.default.restaurant.delete({
            where: { id },
        });
        return { message: "Restaurant deleted successfully" };
    }
    catch (error) {
        throw new Error(`Failed to delete restaurant: ${error.message}`);
    }
};
exports.deleteRestaurantService = deleteRestaurantService;
// ADMIN SERVICES
const createAdminService = async (adminData) => {
    const { username, email, phone, password, role, province, district, sector, cell, village, } = adminData;
    if (!username ||
        !email ||
        !password ||
        !role ||
        !province ||
        !district ||
        !sector ||
        !cell ||
        !village) {
        throw new Error("Username, email, password, role, province, district, sector, cell, and village are required for admins");
    }
    // Check if phone/email exists in any user table
    const existingUser = await checkExistingUser(phone || undefined, email);
    if (existingUser) {
        throw new Error("User with this phone/email already exists");
    }
    // Validate location data if provided
    if (province || district || sector || cell || village) {
        const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
            province,
            district,
            sector,
            cell,
            village,
        });
        if (!locationValidation.isValid) {
            throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
        }
    }
    try {
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const admin = await prisma_1.default.admin.create({
            data: {
                username,
                email,
                phone: phone || null,
                password: hashedPassword,
                role,
                province,
                district,
                sector,
                cell,
                village,
            },
        });
        const { password: _, ...adminWithoutPassword } = admin;
        return adminWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to create admin: ${error.message}`);
    }
};
exports.createAdminService = createAdminService;
const getAllAdminsService = async (query) => {
    const normalizedQuery = paginationService_1.PaginationService.validatePaginationParams(query.page, query.limit);
    const options = {
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            phone: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    };
    const result = await paginationService_1.PaginationService.paginate(prisma_1.default.admin, normalizedQuery, options);
    return {
        admins: result.data,
        pagination: result.pagination,
    };
};
exports.getAllAdminsService = getAllAdminsService;
const getAdminByIdService = async (id) => {
    const admin = await prisma_1.default.admin.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            phone: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
            createdAt: true,
        },
    });
    return admin;
};
exports.getAdminByIdService = getAdminByIdService;
const updateAdminService = async (id, updateData) => {
    const { password, province, district, sector, cell, village, email, ...otherData } = updateData;
    const existingAdmin = await prisma_1.default.admin.findUnique({
        where: { id },
    });
    if (!existingAdmin) {
        throw new Error("Admin not found");
    }
    // Check if new phone/email already exists in any user table (excluding current admin)
    if (email) {
        const existingUser = await checkExistingUser(email || undefined);
        if (existingUser && existingUser.id !== id) {
            throw new Error("User with this phone/email already exists");
        }
    }
    // Validate location data if any location field is provided
    if (province || district || sector || cell || village) {
        const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
            province: province ? province : existingAdmin.province,
            district: district ? district : existingAdmin.district,
            sector: sector ? sector : existingAdmin.sector,
            cell: cell ? cell : existingAdmin.cell,
            village: village ? village : existingAdmin.village,
        });
        if (!locationValidation.isValid) {
            throw new Error(`Location validation failed: ${locationValidation.errors.join(", ")}`);
        }
    }
    try {
        let hashedPassword;
        if (password) {
            hashedPassword = await (0, password_1.hashPassword)(password);
        }
        const updatedAdmin = await prisma_1.default.admin.update({
            where: { id },
            data: {
                ...otherData,
                province,
                district,
                sector,
                cell,
                village,
                ...(hashedPassword && { password: hashedPassword }),
            },
        });
        const { password: _, ...adminWithoutPassword } = updatedAdmin;
        return adminWithoutPassword;
    }
    catch (error) {
        throw new Error(`Failed to update admin: ${error.message}`);
    }
};
exports.updateAdminService = updateAdminService;
const deleteAdminService = async (id) => {
    const existingAdmin = await prisma_1.default.admin.findUnique({
        where: { id },
    });
    if (!existingAdmin) {
        throw new Error("Admin not found");
    }
    try {
        await prisma_1.default.admin.delete({
            where: { id },
        });
        return { message: "Admin deleted successfully" };
    }
    catch (error) {
        throw new Error(`Failed to delete admin: ${error.message}`);
    }
};
exports.deleteAdminService = deleteAdminService;
// LOGIN SERVICE
const loginService = async (loginData) => {
    const { phone, email, password } = loginData;
    let user = null;
    let foundUserType = "";
    user = await prisma_1.default.farmer.findFirst({
        where: {
            OR: [{ phone: phone || undefined }, { email: email || undefined }],
        },
    });
    if (user)
        foundUserType = "farmer";
    if (!user) {
        user = await prisma_1.default.restaurant.findFirst({
            where: {
                OR: [{ phone: phone || undefined }, { email: email || undefined }],
            },
        });
        if (user)
            foundUserType = "restaurant";
    }
    if (!user) {
        user = await prisma_1.default.admin.findFirst({
            where: { email: email || undefined },
        });
        if (user)
            foundUserType = "admin";
    }
    if (!user) {
        throw new Error("User not found");
    }
    if (!user.password) {
        throw new Error("Password not set for this user");
    }
    const isPasswordValid = await (0, password_1.comparePassword)(password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid password");
    }
    const { password: _, ...userWithoutPassword } = user;
    return {
        user: userWithoutPassword,
        userType: foundUserType,
        message: "Login successful",
    };
};
exports.loginService = loginService;
