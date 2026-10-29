import {
  getAllSubscriptionPlansService,
  getRestaurantCurrentSubscriptionService,
  createRestaurantSubscriptionService,
  cancelSubscriptionService,
  changeSubscriptionPlanService,
  renewSubscriptionService,
  getRestaurantSubscriptionHistoryService,
} from "../../subscription.service";
import prisma from "../../../prisma";

export const mobileGetPlans = () =>
  getAllSubscriptionPlansService({ isActive: true, limit: 50 });

export const mobileGetCurrentSubscription = (restaurantId: string) =>
  getRestaurantCurrentSubscriptionService(restaurantId);

export const mobileSubscribe = (data: {
  restaurantId: string;
  planId: string;
  paymentMethod?: string;
  phoneNumber?: string;
}) => createRestaurantSubscriptionService(data);

export const mobileCancelSubscription = (restaurantId: string, reason?: string) =>
  cancelSubscriptionService(restaurantId, reason);

export const mobileChangePlan = (
  restaurantId: string,
  newPlanId: string,
  paymentData?: { phoneNumber?: string },
) => changeSubscriptionPlanService(restaurantId, newPlanId, paymentData);

export const mobileRenewSubscription = (
  restaurantId: string,
  paymentData?: { phoneNumber?: string },
) => renewSubscriptionService(restaurantId, paymentData);

export const mobileGetSubscriptionHistory = (restaurantId: string) =>
  getRestaurantSubscriptionHistoryService(restaurantId);

export const mobileVerifySubscriptionPayment = async (txRef: string) => {
  const subscription = await prisma.restaurantSubscription.findFirst({
    where: { txRef },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      txRef: true,
      plan: { select: { name: true } },
    },
  });

  if (!subscription) {
    return { verified: false, status: "not_found", message: "Subscription not found" };
  }

  const verified = subscription.paymentStatus === "COMPLETED" && subscription.status === "ACTIVE";
  return {
    verified,
    status: verified ? "successful" : subscription.paymentStatus?.toLowerCase() ?? "pending",
    subscriptionStatus: subscription.status,
    planName: subscription.plan?.name,
  };
};
