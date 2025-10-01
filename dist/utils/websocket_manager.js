"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Map();
    }
    initialize(server) {
        this.wss = new ws_1.WebSocketServer({
            server,
            path: "/api/ws",
        });
        this.wss.on("connection", this.handleConnection.bind(this));
        console.log("WebSocket server initialized on /api/ws");
    }
    handleConnection(ws, req) {
        const clientId = this.generateClientId();
        const client = {
            ws,
            subscriptions: new Set(),
        };
        this.clients.set(clientId, client);
        console.log(`New WebSocket client connected: ${clientId}`);
        ws.on("message", (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(clientId, message);
            }
            catch (error) {
                this.sendError(ws, "Invalid message format");
            }
        });
        ws.on("close", () => {
            console.log(`Client disconnected: ${clientId}`);
            this.clients.delete(clientId);
        });
        ws.on("error", (error) => {
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
    handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        switch (message.type) {
            case "AUTHENTICATE":
                // Authenticate user and store their info
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
                // Subscribe to order updates for a specific restaurant
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
                // Subscribe to product updates (for admins/aggregators)
                client.subscriptions.add("products");
                this.sendMessage(client.ws, {
                    type: "SUBSCRIPTION_CONFIRMED",
                    subscription: "products",
                    timestamp: new Date().toISOString(),
                });
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
    broadcastOrderUpdate(orderUpdate) {
        if (!this.wss)
            return;
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
    broadcastProductUpdate(productUpdate) {
        if (!this.wss)
            return;
        const message = {
            type: "PRODUCT_UPDATE",
            data: productUpdate,
        };
        this.broadcastToSubscription("products", message);
        console.log(`Product update broadcasted: ${productUpdate.action} - ${productUpdate.productName}`);
    }
    /**
     * Broadcast new product creation
     */
    broadcastNewProduct(product) {
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
    broadcastToSubscription(subscription, message) {
        let subscriberCount = 0;
        for (const [clientId, client] of this.clients.entries()) {
            if (client.subscriptions.has(subscription) &&
                client.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    this.sendMessage(client.ws, message);
                    subscriberCount++;
                }
                catch (error) {
                    console.error(`Error sending message to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
        }
        if (subscriberCount > 0) {
            console.log(`Message sent to ${subscriberCount} subscribers for ${subscription}`);
        }
    }
    /**
     * Broadcast to all connected clients
     */
    broadcastToAll(message) {
        for (const [clientId, client] of this.clients.entries()) {
            if (client.ws.readyState === ws_1.WebSocket.OPEN) {
                try {
                    this.sendMessage(client.ws, message);
                }
                catch (error) {
                    console.error(`Error broadcasting to client ${clientId}:`, error);
                    this.clients.delete(clientId);
                }
            }
        }
    }
    sendMessage(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    sendError(ws, error) {
        this.sendMessage(ws, {
            type: "ERROR",
            error,
            timestamp: new Date().toISOString(),
        });
    }
    generateClientId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    getStats() {
        const subscriptionCounts = {};
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
exports.default = WebSocketManager;
