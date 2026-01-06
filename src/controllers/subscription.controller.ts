import { Request, Response } from "express";
import {
  createSubscriptionPlanService,
  getAllSubscriptionPlansService,
  getSubscriptionPlanByIdService,
  updateSubscriptionPlanService,
  deleteSubscriptionPlanService,
  createRestaurantSubscriptionService,
  getRestaurantSubscriptionsService,
  getSubscriptionByIdService,
  updateRestaurantSubscriptionService,
  cancelSubscriptionService,
  renewSubscriptionService,
  getAllSubscriptionsService,
  checkExpiredSubscriptionsService,
  processSubscriptionPaymentService,
} from "../services/subscription.service";
import { SubscriptionStatus } from "@prisma/client";
import prisma from "../prisma";

// ==================== SUBSCRIPTION PLAN CONTROLLERS ====================

/**
 * Controller to create subscription plan
 * POST /subscriptions/plans
 */
export const createSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      price,
      duration,
      features,
      voucherAccess,
      voucherPaymentDays,
      freeDelivery,
      stablePricing,
      receiveEBM,
      advertisingAccess,
      otherServices,
    } = req.body;

    if (!name || !price || !duration) {
      return res.status(400).json({
        message: "Name, price, and duration are required",
      });
    }

    const plan = await createSubscriptionPlanService({
      name,
      description,
      price: parseFloat(price),
      duration: parseInt(duration),
      features,
      voucherAccess,
      voucherPaymentDays: voucherPaymentDays
        ? parseInt(voucherPaymentDays)
        : undefined,
      freeDelivery,
      stablePricing,
      receiveEBM,
      advertisingAccess,
      otherServices,
    });

    res.status(201).json({
      message: "Subscription plan created successfully",
      data: plan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create subscription plan",
    });
  }
};

/**
 * Controller to get all subscription plans
 * GET /subscriptions/plans
 */
export const getAllSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;

    const result = await getAllSubscriptionPlansService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscription plans",
    });
  }
};

/**
 * Controller to get subscription plan by ID
 * GET /subscriptions/plans/:planId
 */
export const getSubscriptionPlanById = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const plan = await getSubscriptionPlanByIdService(planId);

    res.status(200).json({
      message: "Subscription plan retrieved successfully",
      data: plan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscription plan",
    });
  }
};

/**
 * Controller to update subscription plan
 * PATCH /subscriptions/plans/:planId
 */
export const updateSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const {
      name,
      description,
      price,
      duration,
      features,
      isActive,
      voucherAccess,
      voucherPaymentDays,
      freeDelivery,
      stablePricing,
      receiveEBM,
      advertisingAccess,
      otherServices,
    } = req.body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (features !== undefined) updateData.features = features;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (voucherAccess !== undefined) updateData.voucherAccess = voucherAccess;
    if (voucherPaymentDays !== undefined)
      updateData.voucherPaymentDays = parseInt(voucherPaymentDays);
    if (freeDelivery !== undefined) updateData.freeDelivery = freeDelivery;
    if (stablePricing !== undefined) updateData.stablePricing = stablePricing;
    if (receiveEBM !== undefined) updateData.receiveEBM = receiveEBM;
    if (advertisingAccess !== undefined)
      updateData.advertisingAccess = advertisingAccess;
    if (otherServices !== undefined) updateData.otherServices = otherServices;

    const plan = await updateSubscriptionPlanService(planId, updateData);

    res.status(200).json({
      message: "Subscription plan updated successfully",
      data: plan,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update subscription plan",
    });
  }
};

/**
 * Controller to delete subscription plan
 * DELETE /subscriptions/plans/:planId
 */
export const deleteSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;

    const result = await deleteSubscriptionPlanService(planId);

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to delete subscription plan",
    });
  }
};

// ==================== RESTAURANT SUBSCRIPTION CONTROLLERS ====================

/**
 * Controller to create restaurant subscription with payment
 * POST /subscriptions/restaurant
 */
export const createRestaurantSubscription = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      planId,
      autoRenew,
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
    } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : req.body.restaurantId;

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

    // Validate payment method specific requirements
    if (paymentMethod === "MOBILE_MONEY" && !phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required for mobile money payment",
      });
    }

    if (paymentMethod === "CARD" && !cardDetails) {
      return res.status(400).json({
        message:
          "Card details are required for card payment (or will use hosted checkout)",
      });
    }

    const result = await createRestaurantSubscriptionService({
      restaurantId,
      planId,
      autoRenew,
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
    });

    res.status(201).json({
      message: result.payment
        ? "Subscription created and payment initiated"
        : "Subscription created successfully",
      data: result.subscription,
      payment: result.payment,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create subscription",
    });
  }
};

/**
 * Controller to process subscription payment
 * POST /subscriptions/:subscriptionId/pay
 */
export const processSubscriptionPayment = async (
  req: Request,
  res: Response
) => {
  try {
    const { subscriptionId } = req.params;
    const { paymentMethod, phoneNumber, cardDetails, bankDetails } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    if (!paymentMethod) {
      return res.status(400).json({
        message: "Payment method is required",
      });
    }

    // Validate payment method specific requirements
    if (paymentMethod === "MOBILE_MONEY" && !phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required for mobile money payment",
      });
    }

    // Verify subscription belongs to restaurant (if not admin)
    if (restaurantId) {
      const subscription = await getSubscriptionByIdService(
        subscriptionId,
        restaurantId
      );
      if (!subscription) {
        return res.status(403).json({
          message: "Unauthorized to process payment for this subscription",
        });
      }
    }

    const result = await processSubscriptionPaymentService(subscriptionId, {
      paymentMethod,
      phoneNumber,
      cardDetails,
      bankDetails,
    });

    if (result.success) {
      res.status(200).json({
        message: result.message || "Payment processed successfully",
        data: result.subscription,
        transactionId: result.transactionId,
        redirectUrl: result.redirectUrl,
        transferDetails: result.transferDetails,
        status: result.status,
      });
    } else {
      res.status(400).json({
        message: result.error || "Payment processing failed",
        error: result.error,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to process payment",
    });
  }
};

/**
 * Controller to get restaurant's subscriptions
 * GET /subscriptions/my-subscriptions
 */
export const getMySubscriptions = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { page = 1, limit = 10, status } = req.query;

    if (
      status &&
      !Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)
    ) {
      return res.status(400).json({
        message: "Invalid subscription status",
      });
    }

    const result = await getRestaurantSubscriptionsService(restaurantId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as SubscriptionStatus,
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscriptions",
    });
  }
};

/**
 * Controller to get subscription by ID
 * GET /subscriptions/:subscriptionId
 */
export const getSubscriptionById = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const subscription = await getSubscriptionByIdService(
      subscriptionId,
      restaurantId
    );

    console.log("Subscription By ID", subscription);

    res.status(200).json({
      message: "Subscription retrieved successfully",
      data: subscription,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscription",
    });
  }
};

/**
 * Controller to update restaurant subscription
 * PATCH /subscriptions/:subscriptionId
 */
export const updateRestaurantSubscription = async (
  req: Request,
  res: Response
) => {
  try {
    const { subscriptionId } = req.params;
    const { status, autoRenew, endDate } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    if (status && !Object.values(SubscriptionStatus).includes(status)) {
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

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (endDate !== undefined) updateData.endDate = new Date(endDate);

    const subscription = await updateRestaurantSubscriptionService(
      subscriptionId,
      updateData,
      restaurantId
    );

    res.status(200).json({
      message: "Subscription updated successfully",
      data: subscription,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update subscription",
    });
  }
};

/**
 * Controller to cancel subscription
 * POST /subscriptions/:subscriptionId/cancel
 */
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { reason } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const subscription = await cancelSubscriptionService(
      subscriptionId,
      reason,
      restaurantId
    );

    res.status(200).json({
      message: "Subscription cancelled successfully",
      data: subscription,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to cancel subscription",
    });
  }
};

/**
 * Controller to renew subscription
 * POST /subscriptions/:subscriptionId/renew
 */
export const renewSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    const subscription = await renewSubscriptionService(
      subscriptionId,
      restaurantId
    );

    res.status(200).json({
      message: "Subscription renewed successfully. Please complete payment.",
      data: subscription,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to renew subscription",
    });
  }
};

/**
 * Controller to get all subscriptions (Admin)
 * GET /subscriptions
 */
export const getAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, restaurantId } = req.query;

    if (
      status &&
      !Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)
    ) {
      return res.status(400).json({
        message: "Invalid subscription status",
      });
    }

    const result = await getAllSubscriptionsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as SubscriptionStatus,
      restaurantId: restaurantId as string,
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscriptions",
    });
  }
};

/**
 * Controller to check and expire subscriptions (Cron job endpoint)
 * POST /subscriptions/check-expired
 */
export const checkExpiredSubscriptions = async (
  req: Request,
  res: Response
) => {
  try {
    const result = await checkExpiredSubscriptionsService();

    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to check expired subscriptions",
    });
  }
};

/**
 * Controller to upgrade subscription
 * POST /subscriptions/:subscriptionId/upgrade
 */
export const upgradeSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanId } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    if (!newPlanId) {
      return res.status(400).json({
        message: "New plan ID is required",
      });
    }

    // Get current subscription
    const currentSubscription = await getSubscriptionByIdService(
      subscriptionId,
      restaurantId
    );

    // Validate new plan exists
    const newPlan = await getSubscriptionPlanByIdService(newPlanId);

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
    const updatedSubscription = await prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantSubscription.update({
        where: { id: subscriptionId },
        data: {
          planId: newPlanId,
          status: "PENDING",
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to upgrade subscription",
    });
  }
};

/**
 * Controller to downgrade subscription
 * POST /subscriptions/:subscriptionId/downgrade
 */
export const downgradeSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanId } = req.body;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    if (!newPlanId) {
      return res.status(400).json({
        message: "New plan ID is required",
      });
    }

    // Get current subscription
    const currentSubscription = await getSubscriptionByIdService(
      subscriptionId,
      restaurantId
    );

    // Validate new plan exists
    const newPlan = await getSubscriptionPlanByIdService(newPlanId);

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
    const updatedSubscription = await prisma.$transaction(async (tx) => {
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
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to downgrade subscription",
    });
  }
};

/**
 * Controller to get subscription history
 * GET /subscriptions/:subscriptionId/history
 */
export const getSubscriptionHistory = async (req: Request, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const userRole = (req as any).user.role;
    const restaurantId =
      userRole === "RESTAURANT" ? (req as any).user.id : undefined;

    // Verify subscription access
    await getSubscriptionByIdService(subscriptionId, restaurantId);

    const history = await prisma.subscriptionHistory.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Subscription history retrieved successfully",
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get subscription history",
    });
  }
};
