"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_2 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const subscription_webhook_1 = require("../controllers/subscription.webhook");
const subscriptionRoutes = (0, express_2.Router)();
// ========================================
// SUBSCRIPTION PLAN ROUTES (Admin Only)
// ========================================
/**
 * Create a new subscription plan
 * POST /subscriptions/plans
 * Access: Admin only
 */
subscriptionRoutes.post("/plans", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), subscription_controller_1.createSubscriptionPlan);
/**
 * Get all subscription plans
 * GET /subscriptions/plans
 * Access: Public (or authenticated users)
 */
subscriptionRoutes.get("/plans", subscription_controller_1.getAllSubscriptionPlans);
/**
 * Get subscription plan by ID
 * GET /subscriptions/plans/:planId
 * Access: Public (or authenticated users)
 */
subscriptionRoutes.get("/plans/:planId", subscription_controller_1.getSubscriptionPlanById);
/**
 * Update subscription plan
 * PATCH /subscriptions/plans/:planId
 * Access: Admin only
 */
subscriptionRoutes.patch("/plans/:planId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), subscription_controller_1.updateSubscriptionPlan);
/**
 * Delete subscription plan
 * DELETE /subscriptions/plans/:planId
 * Access: Admin only
 */
subscriptionRoutes.delete("/plans/:planId", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), subscription_controller_1.deleteSubscriptionPlan);
// ========================================
// RESTAURANT SUBSCRIPTION ROUTES
// ========================================
/**
 * Create restaurant subscription
 * POST /subscriptions/restaurant
 * Access: Restaurant (own subscription) or Admin (any restaurant)
 */
subscriptionRoutes.post("/restaurant", authMiddleware_1.isAuthenticated, subscription_controller_1.createRestaurantSubscription);
/**
 * Get restaurant's subscriptions
 * GET /subscriptions/my-subscriptions
 * Access: Restaurant only
 */
subscriptionRoutes.get("/my-subscriptions", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("RESTAURANT"), subscription_controller_1.getMySubscriptions);
/**
 * Get subscription by ID
 * GET /subscriptions/:subscriptionId
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.get("/:subscriptionId", authMiddleware_1.isAuthenticated, subscription_controller_1.getSubscriptionById);
/**
 * Update restaurant subscription
 * PATCH /subscriptions/:subscriptionId
 * Access: Restaurant (limited fields) or Admin (all fields)
 */
subscriptionRoutes.patch("/:subscriptionId", authMiddleware_1.isAuthenticated, subscription_controller_1.updateRestaurantSubscription);
/**
 * Cancel subscription
 * POST /subscriptions/:subscriptionId/cancel
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post("/:subscriptionId/cancel", authMiddleware_1.isAuthenticated, subscription_controller_1.cancelSubscription);
/**
 * Renew subscription
 * POST /subscriptions/:subscriptionId/renew
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post("/:subscriptionId/renew", authMiddleware_1.isAuthenticated, subscription_controller_1.renewSubscription);
/**
 * Upgrade subscription
 * POST /subscriptions/:subscriptionId/upgrade
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post("/:subscriptionId/upgrade", authMiddleware_1.isAuthenticated, subscription_controller_1.upgradeSubscription);
/**
 * Downgrade subscription
 * POST /subscriptions/:subscriptionId/downgrade
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post("/:subscriptionId/downgrade", authMiddleware_1.isAuthenticated, subscription_controller_1.downgradeSubscription);
/**
 * Get subscription history
 * GET /subscriptions/:subscriptionId/history
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.get("/:subscriptionId/history", authMiddleware_1.isAuthenticated, subscription_controller_1.getSubscriptionHistory);
// ========================================
// ADMIN SUBSCRIPTION ROUTES
// ========================================
/**
 * Check and expire subscriptions (Cron job)
 * POST /subscriptions/check-expired
 * Access: Admin only (or internal cron job)
 */
subscriptionRoutes.post("/check-expired", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), subscription_controller_1.checkExpiredSubscriptions);
/**
 * Get all subscriptions with filtering
 * GET /subscriptions
 * Access: Admin only
 */
subscriptionRoutes.get("/", authMiddleware_1.isAuthenticated, (0, authMiddleware_1.checkPermission)("ADMIN"), subscription_controller_1.getAllSubscriptions);
/**
 * Subscription payment webhook
 * POST /subscriptions/webhook
 * Access: Public (from payment gateway)
 */
subscriptionRoutes.post("/webhook", express_1.default.raw({ type: "application/json" }), subscription_webhook_1.handleSubscriptionWebhook);
exports.default = subscriptionRoutes;
