import cron from "node-cron";
import prisma from "../prisma";
import { createNotificationService } from "../services/notification.services";

const DEEP_LINK_BASE = "/(app)/orders";

const STATUS_TITLES: Record<string, string> = {
  CONFIRMED: "Order confirmed",
  PREPARING: "Order is being prepared",
  READY: "Order is ready for pickup",
  IN_TRANSIT: "Order is on its way",
  DELIVERED: "Order delivered",
  CANCELLED: "Order cancelled",
};

/**
 * Fires an in-app notification whenever an order's status changes.
 * Tracks the last-seen status in a lightweight in-memory map so we
 * don't spam on every tick.  On restart the map is empty, so the first
 * tick may re-notify for already-seen statuses — acceptable trade-off
 * without a dedicated status-change event table.
 */
const lastSeenStatus = new Map<string, string>();

export const scheduleOrderStatusNotifications = () => {
  cron.schedule("*/2 * * * *", async () => {
    try {
      const activeOrders = await prisma.order.findMany({
        where: {
          status: { in: ["CONFIRMED", "PREPARING", "READY", "IN_TRANSIT", "DELIVERED", "CANCELLED"] },
          updatedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // updated in last 5 min
        },
        select: { id: true, orderNumber: true, status: true, restaurantId: true },
      });

      for (const order of activeOrders) {
        const prev = lastSeenStatus.get(order.id);
        if (prev === order.status) continue;
        lastSeenStatus.set(order.id, order.status);

        const title = STATUS_TITLES[order.status];
        if (!title) continue;

        await createNotificationService({
          title,
          message: `Order ${order.orderNumber} — ${title.toLowerCase()}.`,
          eventType: "ORDER_STATUS_CHANGED",
          targetType: "SPECIFIC_USER",
          targetId: order.restaurantId,
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: order.status,
            deepLink: `${DEEP_LINK_BASE}/${order.orderNumber}`,
          },
        }).catch((err) =>
          console.error(`[order-status-job] Failed to notify order ${order.id}:`, err),
        );
      }
    } catch (err) {
      console.error("[order-status-job] Error:", err);
    }
  });

  console.log("Order status notification job initialized — runs every 2 minutes");
};
