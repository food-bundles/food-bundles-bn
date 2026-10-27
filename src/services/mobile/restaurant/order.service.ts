import {
  getRestaurantOrdersService,
  getOrderByIdService,
  cancelOrderService,
  reOrderFromExistingOrderService,
  getOrderStatisticsService,
} from "../../order.services";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export const mobileGetMyOrders = (
  restaurantId: string,
  query: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  },
) => getRestaurantOrdersService(restaurantId, query);

export const mobileGetOrderById = (orderId: string, restaurantId: string) =>
  getOrderByIdService(orderId, restaurantId);

export const mobileCancelOrder = (orderId: string, restaurantId: string, reason?: string) =>
  cancelOrderService(orderId, restaurantId, reason);

export const mobileReorder = (orderId: string, restaurantId: string, paymentMethodId?: string) =>
  reOrderFromExistingOrderService(orderId, restaurantId, paymentMethodId);

export const mobileGetOrderStats = (restaurantId: string, dateFrom?: Date, dateTo?: Date) =>
  getOrderStatisticsService({ restaurantId, dateFrom, dateTo });
