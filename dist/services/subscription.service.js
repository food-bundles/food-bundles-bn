"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpiredSubscriptionsService = exports.getAllSubscriptionsService = exports.renewSubscriptionService = exports.cancelSubscriptionService = exports.updateRestaurantSubscriptionService = exports.getSubscriptionByIdService = exports.getRestaurantSubscriptionsService = exports.createRestaurantSubscriptionService = exports.deleteSubscriptionPlanService = exports.updateSubscriptionPlanService = exports.getSubscriptionPlanByIdService = exports.getAllSubscriptionPlansService = exports.createSubscriptionPlanService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Service to create a new subscription plan
 */
const createSubscriptionPlanService = async (data) => {
    const { name, description, price, duration, features } = data;
    // Check if plan with same name exists
    const existingPlan = await prisma_1.default.subscriptionPlan.findUnique({
        where: { name },
    });
    if (existingPlan) {
        throw new Error("Subscription plan with this name already exists");
    }
    // Validate price and duration
    if (price <= 0) {
        throw new Error("Price must be greater than 0");
    }
    if (duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }
    const plan = await prisma_1.default.subscriptionPlan.create({
        data: {
            name,
            description,
            price,
            duration,
            features,
        },
    });
    return plan;
};
exports.createSubscriptionPlanService = createSubscriptionPlanService;
/**
 * Service to get all subscription plans
 */
const getAllSubscriptionPlansService = async ({ page = 1, limit = 10, isActive, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (isActive !== undefined) {
        where.isActive = isActive;
    }
    const [plans, total] = await Promise.all([
        prisma_1.default.subscriptionPlan.findMany({
            where,
            skip,
            take: limit,
            include: {
                _count: {
                    select: {
                        subscriptions: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.subscriptionPlan.count({ where }),
    ]);
    return {
        plans,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllSubscriptionPlansService = getAllSubscriptionPlansService;
/**
 * Service to get subscription plan by ID
 */
const getSubscriptionPlanByIdService = async (planId) => {
    const plan = await prisma_1.default.subscriptionPlan.findUnique({
        where: { id: planId },
        include: {
            _count: {
                select: {
                    subscriptions: true,
                },
            },
        },
    });
    if (!plan) {
        throw new Error("Subscription plan not found");
    }
    return plan;
};
exports.getSubscriptionPlanByIdService = getSubscriptionPlanByIdService;
/**
 * Service to update subscription plan
 */
const updateSubscriptionPlanService = async (planId, data) => {
    const existingPlan = await prisma_1.default.subscriptionPlan.findUnique({
        where: { id: planId },
    });
    if (!existingPlan) {
        throw new Error("Subscription plan not found");
    }
    // Check if name is being changed and if it conflicts
    if (data.name && data.name !== existingPlan.name) {
        const nameConflict = await prisma_1.default.subscriptionPlan.findUnique({
            where: { name: data.name },
        });
        if (nameConflict) {
            throw new Error("Subscription plan with this name already exists");
        }
    }
    // Validate price and duration if provided
    if (data.price !== undefined && data.price <= 0) {
        throw new Error("Price must be greater than 0");
    }
    if (data.duration !== undefined && data.duration <= 0) {
        throw new Error("Duration must be greater than 0");
    }
    const updatedPlan = await prisma_1.default.subscriptionPlan.update({
        where: { id: planId },
        data,
    });
    return updatedPlan;
};
exports.updateSubscriptionPlanService = updateSubscriptionPlanService;
/**
 * Service to delete subscription plan
 */
const deleteSubscriptionPlanService = async (planId) => {
    const plan = await prisma_1.default.subscriptionPlan.findUnique({
        where: { id: planId },
        include: {
            subscriptions: {
                where: {
                    status: "ACTIVE",
                },
            },
        },
    });
    if (!plan) {
        throw new Error("Subscription plan not found");
    }
    // Check if plan has active subscriptions
    if (plan.subscriptions.length > 0) {
        throw new Error("Cannot delete plan with active subscriptions");
    }
    await prisma_1.default.subscriptionPlan.delete({
        where: { id: planId },
    });
    return { message: "Subscription plan deleted successfully" };
};
exports.deleteSubscriptionPlanService = deleteSubscriptionPlanService;
/**
 * Service to create restaurant subscription
 */
const createRestaurantSubscriptionService = async (data) => {
    const { restaurantId, planId, autoRenew = true, paymentMethod } = data;
    // Validate restaurant exists
    const restaurant = await prisma_1.default.restaurant.findUnique({
        where: { id: restaurantId },
    });
    if (!restaurant) {
        throw new Error("Restaurant not found");
    }
    // Validate plan exists and is active
    const plan = await prisma_1.default.subscriptionPlan.findUnique({
        where: { id: planId },
    });
    if (!plan) {
        throw new Error("Subscription plan not found");
    }
    if (!plan.isActive) {
        throw new Error("Subscription plan is not active");
    }
    // Check for existing active subscription
    const existingSubscription = await prisma_1.default.restaurantSubscription.findFirst({
        where: {
            restaurantId,
            status: "ACTIVE",
        },
    });
    if (existingSubscription) {
        throw new Error("Restaurant already has an active subscription");
    }
    // Calculate end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);
    // Generate transaction reference
    const txRef = `SUB_${restaurantId}_${planId}_${Date.now()}`;
    // Create subscription
    const subscription = await prisma_1.default.$transaction(async (tx) => {
        const newSubscription = await tx.restaurantSubscription.create({
            data: {
                restaurantId,
                planId,
                status: "PENDING",
                startDate,
                endDate,
                autoRenew,
                paymentMethod: paymentMethod || "CASH",
                paymentStatus: "PENDING",
                txRef,
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                plan: true,
            },
        });
        // Create subscription history
        await tx.subscriptionHistory.create({
            data: {
                subscriptionId: newSubscription.id,
                action: "CREATED",
                newStatus: "PENDING",
                newPlanId: planId,
            },
        });
        return newSubscription;
    });
    return subscription;
};
exports.createRestaurantSubscriptionService = createRestaurantSubscriptionService;
/**
 * Service to get restaurant subscriptions
 */
const getRestaurantSubscriptionsService = async (restaurantId, filters) => {
    const { page = 1, limit = 10, status } = filters || {};
    const skip = (page - 1) * limit;
    const where = { restaurantId };
    if (status) {
        where.status = status;
    }
    const [subscriptions, total] = await Promise.all([
        prisma_1.default.restaurantSubscription.findMany({
            where,
            skip,
            take: limit,
            include: {
                plan: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.restaurantSubscription.count({ where }),
    ]);
    return {
        subscriptions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getRestaurantSubscriptionsService = getRestaurantSubscriptionsService;
/**
 * Service to get subscription by ID
 */
const getSubscriptionByIdService = async (subscriptionId, restaurantId) => {
    const subscription = await prisma_1.default.restaurantSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
            plan: true,
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            payments: {
                orderBy: {
                    createdAt: "desc",
                },
            },
            history: {
                orderBy: {
                    createdAt: "desc",
                },
            },
        },
    });
    if (!subscription) {
        throw new Error("Subscription not found");
    }
    // Check restaurant ownership if restaurantId provided
    if (restaurantId && subscription.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Subscription does not belong to this restaurant");
    }
    return subscription;
};
exports.getSubscriptionByIdService = getSubscriptionByIdService;
/**
 * Service to update restaurant subscription
 */
const updateRestaurantSubscriptionService = async (subscriptionId, data, restaurantId) => {
    const existingSubscription = await (0, exports.getSubscriptionByIdService)(subscriptionId, restaurantId);
    const oldStatus = existingSubscription.status;
    const updatedSubscription = await prisma_1.default.$transaction(async (tx) => {
        const updated = await tx.restaurantSubscription.update({
            where: { id: subscriptionId },
            data,
            include: {
                plan: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        // Create history entry if status changed
        if (data.status && data.status !== oldStatus) {
            let action = "CREATED";
            if (data.status === "ACTIVE" && oldStatus === "SUSPENDED") {
                action = "REACTIVATED";
            }
            else if (data.status === "CANCELLED") {
                action = "CANCELLED";
            }
            else if (data.status === "SUSPENDED") {
                action = "SUSPENDED";
            }
            else if (data.status === "EXPIRED") {
                action = "EXPIRED";
            }
            await tx.subscriptionHistory.create({
                data: {
                    subscriptionId,
                    action,
                    oldStatus,
                    newStatus: data.status,
                },
            });
        }
        return updated;
    });
    return updatedSubscription;
};
exports.updateRestaurantSubscriptionService = updateRestaurantSubscriptionService;
/**
 * Service to cancel subscription
 */
const cancelSubscriptionService = async (subscriptionId, reason, restaurantId) => {
    const subscription = await (0, exports.getSubscriptionByIdService)(subscriptionId, restaurantId);
    if (subscription.status === "CANCELLED") {
        throw new Error("Subscription is already cancelled");
    }
    const updatedSubscription = await prisma_1.default.$transaction(async (tx) => {
        const updated = await tx.restaurantSubscription.update({
            where: { id: subscriptionId },
            data: {
                status: "CANCELLED",
                autoRenew: false,
            },
        });
        await tx.subscriptionHistory.create({
            data: {
                subscriptionId,
                action: "CANCELLED",
                oldStatus: subscription.status,
                newStatus: "CANCELLED",
                reason,
            },
        });
        return updated;
    });
    return updatedSubscription;
};
exports.cancelSubscriptionService = cancelSubscriptionService;
/**
 * Service to renew subscription
 */
const renewSubscriptionService = async (subscriptionId, restaurantId) => {
    const subscription = await (0, exports.getSubscriptionByIdService)(subscriptionId, restaurantId);
    if (subscription.status === "ACTIVE") {
        throw new Error("Subscription is already active");
    }
    const plan = subscription.plan;
    // Calculate new end date
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);
    const renewedSubscription = await prisma_1.default.$transaction(async (tx) => {
        const renewed = await tx.restaurantSubscription.update({
            where: { id: subscriptionId },
            data: {
                status: "PENDING",
                startDate,
                endDate,
                paymentStatus: "PENDING",
            },
            include: {
                plan: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        await tx.subscriptionHistory.create({
            data: {
                subscriptionId,
                action: "RENEWED",
                oldStatus: subscription.status,
                newStatus: "PENDING",
            },
        });
        return renewed;
    });
    return renewedSubscription;
};
exports.renewSubscriptionService = renewSubscriptionService;
/**
 * Service to get all subscriptions (Admin)
 */
const getAllSubscriptionsService = async ({ page = 1, limit = 10, status, restaurantId, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status)
        where.status = status;
    if (restaurantId)
        where.restaurantId = restaurantId;
    const [subscriptions, total] = await Promise.all([
        prisma_1.default.restaurantSubscription.findMany({
            where,
            skip,
            take: limit,
            include: {
                plan: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.restaurantSubscription.count({ where }),
    ]);
    return {
        subscriptions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllSubscriptionsService = getAllSubscriptionsService;
/**
 * Service to check and expire subscriptions
 */
const checkExpiredSubscriptionsService = async () => {
    const now = new Date();
    const expiredSubscriptions = await prisma_1.default.restaurantSubscription.findMany({
        where: {
            status: "ACTIVE",
            endDate: {
                lte: now,
            },
        },
    });
    for (const subscription of expiredSubscriptions) {
        await prisma_1.default.$transaction(async (tx) => {
            await tx.restaurantSubscription.update({
                where: { id: subscription.id },
                data: {
                    status: "EXPIRED",
                },
            });
            await tx.subscriptionHistory.create({
                data: {
                    subscriptionId: subscription.id,
                    action: "EXPIRED",
                    oldStatus: "ACTIVE",
                    newStatus: "EXPIRED",
                    reason: "Subscription period ended",
                },
            });
        });
    }
    return {
        message: `${expiredSubscriptions.length} subscriptions expired`,
        count: expiredSubscriptions.length,
    };
};
exports.checkExpiredSubscriptionsService = checkExpiredSubscriptionsService;
