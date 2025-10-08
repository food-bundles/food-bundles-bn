"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionHistory = exports.downgradeSubscription = exports.upgradeSubscription = exports.checkExpiredSubscriptions = exports.getAllSubscriptions = exports.renewSubscription = exports.cancelSubscription = exports.updateRestaurantSubscription = exports.getSubscriptionById = exports.getMySubscriptions = exports.createRestaurantSubscription = exports.deleteSubscriptionPlan = exports.updateSubscriptionPlan = exports.getSubscriptionPlanById = exports.getAllSubscriptionPlans = exports.createSubscriptionPlan = void 0;
const subscription_service_1 = require("../services/subscription.service");
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../prisma"));
// ==================== SUBSCRIPTION PLAN CONTROLLERS ====================
/**
 * Controller to create subscription plan
 * POST /subscriptions/plans
 */
const createSubscriptionPlan = async (req, res) => {
    try {
        const { name, description, price, duration, features } = req.body;
        if (!name || !price || !duration) {
            return res.status(400).json({
                message: "Name, price, and duration are required",
            });
        }
        const plan = await (0, subscription_service_1.createSubscriptionPlanService)({
            name,
            description,
            price: parseFloat(price),
            duration: parseInt(duration),
            features,
        });
        res.status(201).json({
            message: "Subscription plan created successfully",
            data: plan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create subscription plan",
        });
    }
};
exports.createSubscriptionPlan = createSubscriptionPlan;
/**
 * Controller to get all subscription plans
 * GET /subscriptions/plans
 */
const getAllSubscriptionPlans = async (req, res) => {
    try {
        const { page = 1, limit = 10, isActive } = req.query;
        const result = await (0, subscription_service_1.getAllSubscriptionPlansService)({
            page: parseInt(page),
            limit: parseInt(limit),
            isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
        });
        res.status(200).json({
            message: "Subscription plans retrieved successfully",
            data: result.plans,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscription plans",
        });
    }
};
exports.getAllSubscriptionPlans = getAllSubscriptionPlans;
/**
 * Controller to get subscription plan by ID
 * GET /subscriptions/plans/:planId
 */
const getSubscriptionPlanById = async (req, res) => {
    try {
        const { planId } = req.params;
        const plan = await (0, subscription_service_1.getSubscriptionPlanByIdService)(planId);
        res.status(200).json({
            message: "Subscription plan retrieved successfully",
            data: plan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscription plan",
        });
    }
};
exports.getSubscriptionPlanById = getSubscriptionPlanById;
/**
 * Controller to update subscription plan
 * PATCH /subscriptions/plans/:planId
 */
const updateSubscriptionPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const { name, description, price, duration, features, isActive } = req.body;
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (price !== undefined)
            updateData.price = parseFloat(price);
        if (duration !== undefined)
            updateData.duration = parseInt(duration);
        if (features !== undefined)
            updateData.features = features;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const plan = await (0, subscription_service_1.updateSubscriptionPlanService)(planId, updateData);
        res.status(200).json({
            message: "Subscription plan updated successfully",
            data: plan,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update subscription plan",
        });
    }
};
exports.updateSubscriptionPlan = updateSubscriptionPlan;
/**
 * Controller to delete subscription plan
 * DELETE /subscriptions/plans/:planId
 */
const deleteSubscriptionPlan = async (req, res) => {
    try {
        const { planId } = req.params;
        const result = await (0, subscription_service_1.deleteSubscriptionPlanService)(planId);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to delete subscription plan",
        });
    }
};
exports.deleteSubscriptionPlan = deleteSubscriptionPlan;
// ==================== RESTAURANT SUBSCRIPTION CONTROLLERS ====================
/**
 * Controller to create restaurant subscription
 * POST /subscriptions/restaurant
 */
const createRestaurantSubscription = async (req, res) => {
    try {
        const { planId, autoRenew, paymentMethod } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : req.body.restaurantId;
        if (!planId) {
            return res.status(400).json({
                message: "Plan ID is required",
            });
        }
        if (userRole !== "RESTAURANT" && !restaurantId) {
            return res.status(400).json({
                message: "Restaurant ID is required",
            });
        }
        if (paymentMethod &&
            !Object.values(client_1.PaymentMethod).includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }
        const subscription = await (0, subscription_service_1.createRestaurantSubscriptionService)({
            restaurantId,
            planId,
            autoRenew,
            paymentMethod,
        });
        res.status(201).json({
            message: "Subscription created successfully",
            data: subscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create subscription",
        });
    }
};
exports.createRestaurantSubscription = createRestaurantSubscription;
/**
 * Controller to get restaurant subscriptions
 * GET /subscriptions/my-subscriptions
 */
const getMySubscriptions = async (req, res) => {
    try {
        const restaurantId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        if (status &&
            !Object.values(client_1.SubscriptionStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid subscription status",
            });
        }
        const result = await (0, subscription_service_1.getRestaurantSubscriptionsService)(restaurantId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
        });
        res.status(200).json({
            message: "Subscriptions retrieved successfully",
            data: result.subscriptions,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscriptions",
        });
    }
};
exports.getMySubscriptions = getMySubscriptions;
/**
 * Controller to get subscription by ID
 * GET /subscriptions/:subscriptionId
 */
const getSubscriptionById = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const subscription = await (0, subscription_service_1.getSubscriptionByIdService)(subscriptionId, restaurantId);
        res.status(200).json({
            message: "Subscription retrieved successfully",
            data: subscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscription",
        });
    }
};
exports.getSubscriptionById = getSubscriptionById;
/**
 * Controller to update restaurant subscription
 * PATCH /subscriptions/:subscriptionId
 */
const updateRestaurantSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { status, autoRenew, endDate } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        if (status && !Object.values(client_1.SubscriptionStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid subscription status",
            });
        }
        // Only admins can change status directly
        if (status && userRole !== "ADMIN") {
            return res.status(403).json({
                message: "Only admins can change subscription status",
            });
        }
        const updateData = {};
        if (status !== undefined)
            updateData.status = status;
        if (autoRenew !== undefined)
            updateData.autoRenew = autoRenew;
        if (endDate !== undefined)
            updateData.endDate = new Date(endDate);
        const subscription = await (0, subscription_service_1.updateRestaurantSubscriptionService)(subscriptionId, updateData, restaurantId);
        res.status(200).json({
            message: "Subscription updated successfully",
            data: subscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to update subscription",
        });
    }
};
exports.updateRestaurantSubscription = updateRestaurantSubscription;
/**
 * Controller to cancel subscription
 * POST /subscriptions/:subscriptionId/cancel
 */
const cancelSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { reason } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const subscription = await (0, subscription_service_1.cancelSubscriptionService)(subscriptionId, reason, restaurantId);
        res.status(200).json({
            message: "Subscription cancelled successfully",
            data: subscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to cancel subscription",
        });
    }
};
exports.cancelSubscription = cancelSubscription;
/**
 * Controller to renew subscription
 * POST /subscriptions/:subscriptionId/renew
 */
const renewSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        const subscription = await (0, subscription_service_1.renewSubscriptionService)(subscriptionId, restaurantId);
        res.status(200).json({
            message: "Subscription renewed successfully",
            data: subscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to renew subscription",
        });
    }
};
exports.renewSubscription = renewSubscription;
/**
 * Controller to get all subscriptions (Admin)
 * GET /subscriptions
 */
const getAllSubscriptions = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, restaurantId } = req.query;
        if (status &&
            !Object.values(client_1.SubscriptionStatus).includes(status)) {
            return res.status(400).json({
                message: "Invalid subscription status",
            });
        }
        const result = await (0, subscription_service_1.getAllSubscriptionsService)({
            page: parseInt(page),
            limit: parseInt(limit),
            status: status,
            restaurantId: restaurantId,
        });
        res.status(200).json({
            message: "Subscriptions retrieved successfully",
            data: result.subscriptions,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscriptions",
        });
    }
};
exports.getAllSubscriptions = getAllSubscriptions;
/**
 * Controller to check and expire subscriptions (Cron job endpoint)
 * POST /subscriptions/check-expired
 */
const checkExpiredSubscriptions = async (req, res) => {
    try {
        const result = await (0, subscription_service_1.checkExpiredSubscriptionsService)();
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to check expired subscriptions",
        });
    }
};
exports.checkExpiredSubscriptions = checkExpiredSubscriptions;
/**
 * Controller to upgrade subscription
 * POST /subscriptions/:subscriptionId/upgrade
 */
const upgradeSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { newPlanId } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        if (!newPlanId) {
            return res.status(400).json({
                message: "New plan ID is required",
            });
        }
        // Get current subscription
        const currentSubscription = await (0, subscription_service_1.getSubscriptionByIdService)(subscriptionId, restaurantId);
        // Validate new plan exists
        const newPlan = await (0, subscription_service_1.getSubscriptionPlanByIdService)(newPlanId);
        if (!newPlan.isActive) {
            return res.status(400).json({
                message: "New plan is not active",
            });
        }
        // Check if it's actually an upgrade (price-wise)
        if (newPlan.price <= currentSubscription.plan.price) {
            return res.status(400).json({
                message: "New plan must have a higher price than current plan",
            });
        }
        // Update subscription with new plan
        const updatedSubscription = await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.restaurantSubscription.update({
                where: { id: subscriptionId },
                data: {
                    planId: newPlanId,
                    status: "PENDING", // Requires payment for upgrade
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
                    action: "UPGRADED",
                    oldPlanId: currentSubscription.planId,
                    newPlanId: newPlanId,
                    oldStatus: currentSubscription.status,
                    newStatus: "PENDING",
                },
            });
            return updated;
        });
        res.status(200).json({
            message: "Subscription upgraded successfully. Please complete payment.",
            data: updatedSubscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to upgrade subscription",
        });
    }
};
exports.upgradeSubscription = upgradeSubscription;
/**
 * Controller to downgrade subscription
 * POST /subscriptions/:subscriptionId/downgrade
 */
const downgradeSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const { newPlanId } = req.body;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        if (!newPlanId) {
            return res.status(400).json({
                message: "New plan ID is required",
            });
        }
        // Get current subscription
        const currentSubscription = await (0, subscription_service_1.getSubscriptionByIdService)(subscriptionId, restaurantId);
        // Validate new plan exists
        const newPlan = await (0, subscription_service_1.getSubscriptionPlanByIdService)(newPlanId);
        if (!newPlan.isActive) {
            return res.status(400).json({
                message: "New plan is not active",
            });
        }
        // Check if it's actually a downgrade (price-wise)
        if (newPlan.price >= currentSubscription.plan.price) {
            return res.status(400).json({
                message: "New plan must have a lower price than current plan",
            });
        }
        // Update subscription with new plan (effective at next billing cycle)
        const updatedSubscription = await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.restaurantSubscription.update({
                where: { id: subscriptionId },
                data: {
                    planId: newPlanId,
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
                    action: "DOWNGRADED",
                    oldPlanId: currentSubscription.planId,
                    newPlanId: newPlanId,
                },
            });
            return updated;
        });
        res.status(200).json({
            message: "Subscription will be downgraded at next billing cycle",
            data: updatedSubscription,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to downgrade subscription",
        });
    }
};
exports.downgradeSubscription = downgradeSubscription;
/**
 * Controller to get subscription history
 * GET /subscriptions/:subscriptionId/history
 */
const getSubscriptionHistory = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userRole = req.user.role;
        const restaurantId = userRole === "RESTAURANT" ? req.user.id : undefined;
        // Verify subscription access
        await (0, subscription_service_1.getSubscriptionByIdService)(subscriptionId, restaurantId);
        const history = await prisma_1.default.subscriptionHistory.findMany({
            where: { subscriptionId },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({
            message: "Subscription history retrieved successfully",
            data: history,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get subscription history",
        });
    }
};
exports.getSubscriptionHistory = getSubscriptionHistory;
