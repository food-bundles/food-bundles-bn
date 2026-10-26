import {
  getAllSubscriptionPlansService,
  getRestaurantCurrentSubscriptionService,
  createRestaurantSubscriptionService,
  cancelSubscriptionService,
} from "../../subscription.service";

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
