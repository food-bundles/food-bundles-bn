import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  role?: string;
  subscriptions: Set<string>;
}

interface OrderUpdate {
  orderId: string;
  status: string;
  paymentStatus?: string;
  timestamp: string;
  restaurantId: string;
  data?: {
    orderNumber?: string;
    totalAmount?: number;
    currency?: string;
    paymentMethod?: string;
    transactionId?: string;
    error?: string;
    items?: any[];
  };
}

interface ProductUpdate {
  productId: string;
  productName: string;
  action: "CREATED" | "UPDATED" | "DELETED";
  timestamp: string;
  data?: any;
}

interface SubscriptionUpdate {
  subscriptionId: string;
  status: string;
  paymentStatus?: string;
  timestamp: string;
  restaurantId: string;
  planId?: string;
  action?: string;
}

// Voucher-related interfaces
interface VoucherUpdate {
  voucherId: string;
  voucherCode: string;
  action: "CREATED" | "USED" | "SUSPENDED" | "SETTLED" | "EXPIRED";
  timestamp: string;
  restaurantId: string;
  data?: {
    remainingCredit?: number;
    totalCredit?: number;
    discountPercentage?: number;
    status?: string;
  };
}

interface LoanUpdate {
  loanId: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "DISBURSED" | "SETTLED";
  timestamp: string;
  restaurantId: string;
  data?: {
    requestedAmount?: number;
    approvedAmount?: number;
    status?: string;
    voucherId?: string;
  };
}

interface RepaymentUpdate {
  repaymentId: string;
  loanId: string;
  voucherId?: string;
  action: "PROCESSED" | "FAILED";
  timestamp: string;
  restaurantId: string;
  data?: {
    amount?: number;
    paymentMethod?: string;
    newOutstanding?: number;
  };
}

interface PenaltyUpdate {
  penaltyId: string;
  loanId: string;
  voucherId: string;
  action: "APPLIED" | "WAIVED" | "PAID";
  timestamp: string;
  restaurantId: string;
  data?: {
    penaltyAmount?: number;
    reason?: string;
    daysOverdue?: number;
  };
}

interface VoucherTransactionUpdate {
  transactionId: string;
  voucherId: string;
  orderId: string;
  action: "PAYMENT_PROCESSED";
  timestamp: string;
  restaurantId: string;
  data?: {
    originalAmount?: number;
    discountAmount?: number;
    amountCharged?: number;
    remainingCredit?: number;
    orderAmount?: number;
    voucherCode?: string;
  };
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: "/api/ws",
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    console.log("WebSocket server initialized on /api/ws");
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    const clientId = this.generateClientId();
    const client: WebSocketClient = {
      ws,
      subscriptions: new Set(),
    };

    this.clients.set(clientId, client);
    console.log(`New WebSocket client connected: ${clientId}`);

    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        this.sendError(ws, "Invalid message format");
      }
    });

    ws.on("close", () => {
      console.log(`Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    ws.on("error", (error: Error) => {
      console.error(`WebSocket error for client ${clientId}:`, error.message);
      this.clients.delete(clientId);
    });

    // Send connection confirmation
    this.sendMessage(ws, {
      type: "CONNECTION_ESTABLISHED",
      clientId,
      timestamp: new Date().toISOString(),
    });
  }

  private handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case "AUTHENTICATE":
        if (message.userId && message.role) {
          client.userId = message.userId;
          client.role = message.role;

          this.sendMessage(client.ws, {
            type: "AUTHENTICATED",
            userId: message.userId,
            role: message.role,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "SUBSCRIBE_ORDERS":
        if (message.restaurantId) {
          client.subscriptions.add(`orders:${message.restaurantId}`);

          this.sendMessage(client.ws, {
            type: "SUBSCRIPTION_CONFIRMED",
            subscription: `orders:${message.restaurantId}`,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "SUBSCRIBE_PRODUCTS":
        client.subscriptions.add("products");

        this.sendMessage(client.ws, {
          type: "SUBSCRIPTION_CONFIRMED",
          subscription: "products",
          timestamp: new Date().toISOString(),
        });
        break;

      // Subscribe to vouchers
      case "SUBSCRIBE_VOUCHERS":
        if (message.restaurantId) {
          client.subscriptions.add(`vouchers:${message.restaurantId}`);

          this.sendMessage(client.ws, {
            type: "SUBSCRIPTION_CONFIRMED",
            subscription: `vouchers:${message.restaurantId}`,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      // Subscribe to loans
      case "SUBSCRIBE_LOANS":
        if (message.restaurantId) {
          client.subscriptions.add(`loans:${message.restaurantId}`);

          this.sendMessage(client.ws, {
            type: "SUBSCRIPTION_CONFIRMED",
            subscription: `loans:${message.restaurantId}`,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      // Subscribe to all loans (Admin only)
      case "SUBSCRIBE_ALL_LOANS":
        if (client.role === "ADMIN") {
          client.subscriptions.add("loans:all");

          this.sendMessage(client.ws, {
            type: "SUBSCRIPTION_CONFIRMED",
            subscription: "loans:all",
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "SUBSCRIBE_SUBSCRIPTIONS":
        if (message.restaurantId) {
          client.subscriptions.add(`subscriptions:${message.restaurantId}`);

          this.sendMessage(client.ws, {
            type: "SUBSCRIPTION_CONFIRMED",
            subscription: `subscriptions:${message.restaurantId}`,
            timestamp: new Date().toISOString(),
          });
        }
        break;

      case "UNSUBSCRIBE":
        if (message.subscription) {
          client.subscriptions.delete(message.subscription);
        }
        break;

      case "PING":
        this.sendMessage(client.ws, {
          type: "PONG",
          timestamp: new Date().toISOString(),
        });
        break;
    }
  }

  /**
   * Broadcast order status updates to subscribed clients
   */
  broadcastOrderUpdate(orderUpdate: OrderUpdate) {
    if (!this.wss) return;

    const subscription = `orders:${orderUpdate.restaurantId}`;
    const message = {
      type: "ORDER_UPDATE",
      data: orderUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    console.log(`Order update broadcasted for order ${orderUpdate.orderId}`);
  }

  /**
   * Broadcast product updates to subscribed clients
   */
  broadcastProductUpdate(productUpdate: ProductUpdate) {
    if (!this.wss) return;

    const message = {
      type: "PRODUCT_UPDATE",
      data: productUpdate,
    };

    this.broadcastToSubscription("products", message);

    console.log(
      `Product update broadcasted: ${productUpdate.action} - ${productUpdate.productName}`
    );
  }

  /**
   * Broadcast subscription updates to subscribed clients
   */
  broadcastSubscriptionUpdate(subscriptionUpdate: SubscriptionUpdate) {
    if (!this.wss) return;

    const subscription = `subscriptions:${subscriptionUpdate.restaurantId}`;
    const message = {
      type: "SUBSCRIPTION_UPDATE",
      data: subscriptionUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    console.log(
      `Subscription update broadcasted for subscription ${subscriptionUpdate.subscriptionId}`
    );
  }

  /**
   * Broadcast voucher updates
   */
  broadcastVoucherUpdate(voucherUpdate: VoucherUpdate) {
    if (!this.wss) return;

    const subscription = `vouchers:${voucherUpdate.restaurantId}`;
    const message = {
      type: "VOUCHER_UPDATE",
      data: voucherUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    console.log(
      `Voucher update broadcasted: ${voucherUpdate.action} - ${voucherUpdate.voucherCode}`
    );
  }

  /**
   * Broadcast loan updates
   */
  broadcastLoanUpdate(loanUpdate: LoanUpdate) {
    if (!this.wss) return;

    // Broadcast to specific restaurant
    const restaurantSubscription = `loans:${loanUpdate.restaurantId}`;
    const message = {
      type: "LOAN_UPDATE",
      data: loanUpdate,
    };

    this.broadcastToSubscription(restaurantSubscription, message);

    // Also broadcast to all admins subscribed to all loans
    this.broadcastToSubscription("loans:all", message);

    console.log(
      `Loan update broadcasted: ${loanUpdate.action} - ${loanUpdate.loanId}`
    );
  }

  /**
   * Broadcast repayment updates
   */
  broadcastRepaymentUpdate(repaymentUpdate: RepaymentUpdate) {
    if (!this.wss) return;

    const subscription = `loans:${repaymentUpdate.restaurantId}`;
    const message = {
      type: "REPAYMENT_UPDATE",
      data: repaymentUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    // Also to voucher subscribers
    const voucherSubscription = `vouchers:${repaymentUpdate.restaurantId}`;
    this.broadcastToSubscription(voucherSubscription, message);

    console.log(
      `Repayment update broadcasted for loan ${repaymentUpdate.loanId}`
    );
  }

  /**
   * Broadcast penalty updates
   */
  broadcastPenaltyUpdate(penaltyUpdate: PenaltyUpdate) {
    if (!this.wss) return;

    const subscription = `loans:${penaltyUpdate.restaurantId}`;
    const message = {
      type: "PENALTY_UPDATE",
      data: penaltyUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    // Also to voucher subscribers
    const voucherSubscription = `vouchers:${penaltyUpdate.restaurantId}`;
    this.broadcastToSubscription(voucherSubscription, message);

    console.log(
      `Penalty update broadcasted: ${penaltyUpdate.action} - ${penaltyUpdate.penaltyId}`
    );
  }

  /**
   * Broadcast voucher transaction updates
   */
  broadcastVoucherTransactionUpdate(
    transactionUpdate: VoucherTransactionUpdate
  ) {
    if (!this.wss) return;

    const subscription = `vouchers:${transactionUpdate.restaurantId}`;
    const message = {
      type: "VOUCHER_TRANSACTION_UPDATE",
      data: transactionUpdate,
    };

    this.broadcastToSubscription(subscription, message);

    console.log(
      `Voucher transaction update broadcasted for voucher ${transactionUpdate.voucherId}`
    );
  }

  /**
   * Broadcast new product creation
   */
  broadcastNewProduct(product: any) {
    this.broadcastProductUpdate({
      productId: product.id,
      productName: product.productName,
      action: "CREATED",
      timestamp: new Date().toISOString(),
      data: product,
    });
  }

  /**
   * Broadcast to all clients subscribed to a specific subscription
   */
  private broadcastToSubscription(subscription: string, message: any) {
    let subscriberCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (
        client.subscriptions.has(subscription) &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        try {
          this.sendMessage(client.ws, message);
          subscriberCount++;
        } catch (error) {
          console.error(`Error sending message to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    }

    if (subscriberCount > 0) {
      console.log(
        `Message sent to ${subscriberCount} subscribers for ${subscription}`
      );
    }
  }

  /**
   * Broadcast to all connected clients
   */
  private broadcastToAll(message: any) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          this.sendMessage(client.ws, message);
        } catch (error) {
          console.error(`Error broadcasting to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    }
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: "ERROR",
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  getStats() {
    const subscriptionCounts: Record<string, number> = {};

    for (const client of this.clients.values()) {
      for (const subscription of client.subscriptions) {
        subscriptionCounts[subscription] =
          (subscriptionCounts[subscription] || 0) + 1;
      }
    }

    return {
      totalClients: this.clients.size,
      subscriptions: subscriptionCounts,
    };
  }

  cleanup() {
    for (const [clientId, client] of this.clients.entries()) {
      client.ws.close();
    }
    this.clients.clear();
    console.log("WebSocket manager cleaned up");
  }
}

export default WebSocketManager;
