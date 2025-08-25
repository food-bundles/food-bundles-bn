"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginService = exports.deleteAdminService = exports.updateAdminService = exports.getAdminByIdService = exports.getAllAdminsService = exports.createAdminService = exports.deleteRestaurantService = exports.updateRestaurantService = exports.getRestaurantByIdService = exports.getAllRestaurantsService = exports.createRestaurantService = exports.deleteFarmerService = exports.updateFarmerService = exports.getFarmerByIdService = exports.getAllFarmersService = exports.createFarmerService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const password_1 = require("../utils/password");
const paginationService_1 = require("./paginationService");
const createFarmerService = async (farmerData) => {
    const { location, phone, email, password } = farmerData;
    if (!location) {
        throw new Error("Location is required for farmers");
    }
    if (!phone && !email) {
        throw new Error("Either phone or email is required");
    }
    const existingFarmer = await prisma_1.default.farmer.findFirst({
        where: {
            OR: [{ phone: phone || undefined }, { email: email || undefined }],
        },
    });
    if (existingFarmer) {
        throw new Error("Farmer with this phone/email already exists");
    }
    try {
        let hashedPassword;
        if (password) {
            hashedPassword = await (0, password_1.hashPassword)(password);
        }
        const farmer = await prisma_1.default.farmer.create({
            data: {
                location,
                phone,
                email,
                password: hashedPassword,
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
            location: true,
            role: true,
            phone: true,
            email: true,
            createdAt: true,
            submissions: {
                select: {
                    id: true,
                    productName: true,
                    quantity: true,
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
            location: true,
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
    const { password, ...otherData } = updateData;
    const existingFarmer = await prisma_1.default.farmer.findUnique({
        where: { id },
    });
    if (!existingFarmer) {
        throw new Error("Farmer not found");
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
const createRestaurantService = async (restaurantData) => {
    const { name, email, phone, location, password } = restaurantData;
    if (!name || !email || !location || !password) {
        throw new Error("Name, email, location, and password are required for restaurants");
    }
    const existingRestaurant = await prisma_1.default.restaurant.findFirst({
        where: {
            OR: [{ email }, { phone: phone || undefined }],
        },
    });
    if (existingRestaurant) {
        throw new Error("Restaurant with this email/phone already exists");
    }
    try {
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const restaurant = await prisma_1.default.restaurant.create({
            data: {
                name,
                email,
                phone,
                location,
                password: hashedPassword,
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
            location: true,
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
            location: true,
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
    const { password, ...otherData } = updateData;
    const existingRestaurant = await prisma_1.default.restaurant.findUnique({
        where: { id },
    });
    if (!existingRestaurant) {
        throw new Error("Restaurant not found");
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
const createAdminService = async (adminData) => {
    const { username, email, password, role } = adminData;
    if (!username || !email || !password || !role) {
        throw new Error("Username, email, password, and role are required for admins");
    }
    const existingAdmin = await prisma_1.default.admin.findFirst({
        where: { email },
    });
    if (existingAdmin) {
        throw new Error("Admin with this email already exists");
    }
    try {
        const hashedPassword = await (0, password_1.hashPassword)(password);
        const admin = await prisma_1.default.admin.create({
            data: {
                username,
                email,
                password: hashedPassword,
                role,
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
            createdAt: true,
        },
    });
    return admin;
};
exports.getAdminByIdService = getAdminByIdService;
const updateAdminService = async (id, updateData) => {
    const { password, ...otherData } = updateData;
    const existingAdmin = await prisma_1.default.admin.findUnique({
        where: { id },
    });
    if (!existingAdmin) {
        throw new Error("Admin not found");
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
