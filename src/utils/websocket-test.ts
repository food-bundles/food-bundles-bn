// Simple WebSocket test utility for order updates
import { wsManager } from "../index";

export const testOrderWebSocket = (orderId: string, restaurantId: string) => {
  // Simulate an order status update
  wsManager.broadcastOrderUpdate({
    orderId,
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    timestamp: new Date().toISOString(),
    restaurantId,
    data: {
      orderNumber: `ORD${Date.now()}`,
      totalAmount: 25000,
      currency: "RWF",
      paymentMethod: "MOMO",
    },
  });

  console.log(`Test WebSocket broadcast sent for order ${orderId}`);
};

export const testPaymentStatusUpdate = (orderId: string, restaurantId: string) => {
  // Simulate a payment status update
  wsManager.broadcastOrderUpdate({
    orderId,
    status: "PENDING",
    paymentStatus: "PROCESSING",
    timestamp: new Date().toISOString(),
    restaurantId,
    data: {
      orderNumber: `ORD${Date.now()}`,
      totalAmount: 15000,
      currency: "RWF",
      paymentMethod: "CARD",
    },
  });

  console.log(`Test payment status WebSocket broadcast sent for order ${orderId}`);
};