import prisma from "../prisma";
import { SubscriptionStatus, PaymentMethod } from "@prisma/client";

interface CreateSubscriptionPlanData {
  name: string;
  description?: string;
  price: number;
  duration: number;
  features?: string[];
}

interface UpdateSubscriptionPlanData {
  name?: string;
  description?: string;
  price?: number;
  duration?: number;
  features?: any;
  isActive?: boolean;
}

interface CreateRestaurantSubscriptionData {
  restaurantId: string;
  planId: string;
  autoRenew?: boolean;
  paymentMethod?: PaymentMethod;
}

interface UpdateRestaurantSubscriptionData {
  status?: SubscriptionStatus;
  autoRenew?: boolean;
  endDate?: Date;
}

/**
 * Service to create a new subscription plan
 */
export const createSubscriptionPlanService = async (
  data: CreateSubscriptionPlanData
) => {
  const { name, description, price, duration, features } = data;

  // Check if plan with same name exists
  const existingPlan = await prisma.subscriptionPlan.findUnique({
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

  const plan = await prisma.subscriptionPlan.create({
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

/**
 * Service to get all subscription plans
 */
export const getAllSubscriptionPlansService = async ({
  page = 1,
  limit = 10,
  isActive,
}: {
  page?: number;
  limit?: number;
  isActive?: boolean;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [plans, total] = await Promise.all([
    prisma.subscriptionPlan.findMany({
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
    prisma.subscriptionPlan.count({ where }),
  ]);

  return {
    plans,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to get subscription plan by ID
 */
export const getSubscriptionPlanByIdService = async (planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
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

/**
 * Service to update subscription plan
 */
export const updateSubscriptionPlanService = async (
  planId: string,
  data: UpdateSubscriptionPlanData
) => {
  const existingPlan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!existingPlan) {
    throw new Error("Subscription plan not found");
  }

  // Check if name is being changed and if it conflicts
  if (data.name && data.name !== existingPlan.name) {
    const nameConflict = await prisma.subscriptionPlan.findUnique({
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

  const updatedPlan = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data,
  });

  return updatedPlan;
};

/**
 * Service to delete subscription plan
 */
export const deleteSubscriptionPlanService = async (planId: string) => {
  const plan = await prisma.subscriptionPlan.findUnique({
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

  await prisma.subscriptionPlan.delete({
    where: { id: planId },
  });

  return { message: "Subscription plan deleted successfully" };
};

/**
 * Service to create restaurant subscription
 */
export const createRestaurantSubscriptionService = async (
  data: CreateRestaurantSubscriptionData
) => {
  const { restaurantId, planId, autoRenew = true, paymentMethod } = data;

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Validate plan exists and is active
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  if (!plan.isActive) {
    throw new Error("Subscription plan is not active");
  }

  // Check for existing active subscription
  const existingSubscription = await prisma.restaurantSubscription.findFirst({
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
  const subscription = await prisma.$transaction(async (tx) => {
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

/**
 * Service to get restaurant subscriptions
 */
export const getRestaurantSubscriptionsService = async (
  restaurantId: string,
  filters?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
  }
) => {
  const { page = 1, limit = 10, status } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };
  if (status) {
    where.status = status;
  }

  const [subscriptions, total] = await Promise.all([
    prisma.restaurantSubscription.findMany({
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
    prisma.restaurantSubscription.count({ where }),
  ]);

  return {
    subscriptions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to get subscription by ID
 */
export const getSubscriptionByIdService = async (
  subscriptionId: string,
  restaurantId?: string
) => {
  const subscription = await prisma.restaurantSubscription.findUnique({
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
    throw new Error(
      "Unauthorized: Subscription does not belong to this restaurant"
    );
  }

  return subscription;
};

/**
 * Service to update restaurant subscription
 */
export const updateRestaurantSubscriptionService = async (
  subscriptionId: string,
  data: UpdateRestaurantSubscriptionData,
  restaurantId?: string
) => {
  const existingSubscription = await getSubscriptionByIdService(
    subscriptionId,
    restaurantId
  );

  const oldStatus = existingSubscription.status;

  const updatedSubscription = await prisma.$transaction(async (tx) => {
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
      let action: any = "CREATED";
      if (data.status === "ACTIVE" && oldStatus === "SUSPENDED") {
        action = "REACTIVATED";
      } else if (data.status === "CANCELLED") {
        action = "CANCELLED";
      } else if (data.status === "SUSPENDED") {
        action = "SUSPENDED";
      } else if (data.status === "EXPIRED") {
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

/**
 * Service to cancel subscription
 */
export const cancelSubscriptionService = async (
  subscriptionId: string,
  reason?: string,
  restaurantId?: string
) => {
  const subscription = await getSubscriptionByIdService(
    subscriptionId,
    restaurantId
  );

  if (subscription.status === "CANCELLED") {
    throw new Error("Subscription is already cancelled");
  }

  const updatedSubscription = await prisma.$transaction(async (tx) => {
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

/**
 * Service to renew subscription
 */
export const renewSubscriptionService = async (
  subscriptionId: string,
  restaurantId?: string
) => {
  const subscription = await getSubscriptionByIdService(
    subscriptionId,
    restaurantId
  );

  if (subscription.status === "ACTIVE") {
    throw new Error("Subscription is already active");
  }

  const plan = subscription.plan;

  // Calculate new end date
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + plan.duration);

  const renewedSubscription = await prisma.$transaction(async (tx) => {
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

/**
 * Service to get all subscriptions (Admin)
 */
export const getAllSubscriptionsService = async ({
  page = 1,
  limit = 10,
  status,
  restaurantId,
}: {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus;
  restaurantId?: string;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (restaurantId) where.restaurantId = restaurantId;

  const [subscriptions, total] = await Promise.all([
    prisma.restaurantSubscription.findMany({
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
    prisma.restaurantSubscription.count({ where }),
  ]);

  return {
    subscriptions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to check and expire subscriptions
 */
export const checkExpiredSubscriptionsService = async () => {
  const now = new Date();

  const expiredSubscriptions = await prisma.restaurantSubscription.findMany({
    where: {
      status: "ACTIVE",
      endDate: {
        lte: now,
      },
    },
  });

  for (const subscription of expiredSubscriptions) {
    await prisma.$transaction(async (tx) => {
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
