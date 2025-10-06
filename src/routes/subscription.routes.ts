import express from "express";
import { Router } from "express";
import {
  createSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  createRestaurantSubscription,
  getMySubscriptions,
  getSubscriptionById,
  updateRestaurantSubscription,
  cancelSubscription,
  renewSubscription,
  getAllSubscriptions,
  checkExpiredSubscriptions,
  upgradeSubscription,
  downgradeSubscription,
  getSubscriptionHistory,
} from "../controllers/subscription.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import { handleSubscriptionWebhook } from "../controllers/subscription.webhook";

const subscriptionRoutes = Router();

// ========================================
// SUBSCRIPTION PLAN ROUTES (Admin Only)
// ========================================

/**
 * Create a new subscription plan
 * POST /subscriptions/plans
 * Access: Admin only
 */
subscriptionRoutes.post(
  "/plans",
  isAuthenticated,
  checkPermission("ADMIN"),
  createSubscriptionPlan
);

/**
 * Get all subscription plans
 * GET /subscriptions/plans
 * Access: Public (or authenticated users)
 */
subscriptionRoutes.get("/plans", getAllSubscriptionPlans);

/**
 * Get subscription plan by ID
 * GET /subscriptions/plans/:planId
 * Access: Public (or authenticated users)
 */
subscriptionRoutes.get("/plans/:planId", getSubscriptionPlanById);

/**
 * Update subscription plan
 * PATCH /subscriptions/plans/:planId
 * Access: Admin only
 */
subscriptionRoutes.patch(
  "/plans/:planId",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateSubscriptionPlan
);

/**
 * Delete subscription plan
 * DELETE /subscriptions/plans/:planId
 * Access: Admin only
 */
subscriptionRoutes.delete(
  "/plans/:planId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteSubscriptionPlan
);

// ========================================
// RESTAURANT SUBSCRIPTION ROUTES
// ========================================

/**
 * Create restaurant subscription
 * POST /subscriptions/restaurant
 * Access: Restaurant (own subscription) or Admin (any restaurant)
 */
subscriptionRoutes.post(
  "/restaurant",
  isAuthenticated,
  createRestaurantSubscription
);

/**
 * Get restaurant's subscriptions
 * GET /subscriptions/my-subscriptions
 * Access: Restaurant only
 */
subscriptionRoutes.get(
  "/my-subscriptions",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMySubscriptions
);

/**
 * Get subscription by ID
 * GET /subscriptions/:subscriptionId
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.get(
  "/:subscriptionId",
  isAuthenticated,
  getSubscriptionById
);

/**
 * Update restaurant subscription
 * PATCH /subscriptions/:subscriptionId
 * Access: Restaurant (limited fields) or Admin (all fields)
 */
subscriptionRoutes.patch(
  "/:subscriptionId",
  isAuthenticated,
  updateRestaurantSubscription
);

/**
 * Cancel subscription
 * POST /subscriptions/:subscriptionId/cancel
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post(
  "/:subscriptionId/cancel",
  isAuthenticated,
  cancelSubscription
);

/**
 * Renew subscription
 * POST /subscriptions/:subscriptionId/renew
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post(
  "/:subscriptionId/renew",
  isAuthenticated,
  renewSubscription
);

/**
 * Upgrade subscription
 * POST /subscriptions/:subscriptionId/upgrade
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post(
  "/:subscriptionId/upgrade",
  isAuthenticated,
  upgradeSubscription
);

/**
 * Downgrade subscription
 * POST /subscriptions/:subscriptionId/downgrade
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.post(
  "/:subscriptionId/downgrade",
  isAuthenticated,
  downgradeSubscription
);

/**
 * Get subscription history
 * GET /subscriptions/:subscriptionId/history
 * Access: Restaurant (own subscription) or Admin (any subscription)
 */
subscriptionRoutes.get(
  "/:subscriptionId/history",
  isAuthenticated,
  getSubscriptionHistory
);

// ========================================
// ADMIN SUBSCRIPTION ROUTES
// ========================================

/**
 * Check and expire subscriptions (Cron job)
 * POST /subscriptions/check-expired
 * Access: Admin only (or internal cron job)
 */
subscriptionRoutes.post(
  "/check-expired",
  isAuthenticated,
  checkPermission("ADMIN"),
  checkExpiredSubscriptions
);

/**
 * Get all subscriptions with filtering
 * GET /subscriptions
 * Access: Admin only
 */
subscriptionRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllSubscriptions
);

/**
 * Subscription payment webhook
 * POST /subscriptions/webhook
 * Access: Public (from payment gateway)
 */
subscriptionRoutes.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleSubscriptionWebhook
);

export default subscriptionRoutes;
