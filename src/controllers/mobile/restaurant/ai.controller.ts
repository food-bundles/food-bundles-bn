import { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import prisma from "../../../prisma";
import { cacheGet, cacheSet } from "../../../utils/redis";

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET || "";
const user = (req: Request) => (req as any).user;

/**
 * Fetch a lightweight snapshot of the user's live data from the DB.
 * Injected as `db_context` so the AI can answer questions about the user's
 * actual orders, wallet, subscription, and vouchers — real RBAC-aware data.
 */
function resolveRestaurantId(u: any): string {
  return u.role === "RESTAURANT" || u.role === "HOTEL" ? u.id : (u.restaurantId ?? u.id);
}

async function fetchUserContext(restaurantId: string): Promise<Record<string, unknown>> {
  try {
    const [orders, wallet, subscription, voucherCard] = await Promise.all([
      // 5 most recent orders with status
      prisma.order.findMany({
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          createdAt: true,
          estimatedDelivery: true,
          orderItems: {
            take: 5,
            select: { productName: true, quantity: true, unitPrice: true },
          },
        },
      }),
      // Wallet balance
      prisma.wallet.findUnique({
        where: { restaurantId },
        select: { balance: true, currency: true },
      }),
      // Active subscription
      prisma.restaurantSubscription.findFirst({
        where: { restaurantId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          startDate: true,
          endDate: true,
          plan: { select: { name: true, price: true } },
        },
      }),
      // Voucher card (one per restaurant)
      prisma.voucherCard.findUnique({
        where: { restaurantId },
        select: { id: true, loanLimit: true, status: true },
      }),
    ]);

    return {
      recent_orders: orders.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        status: o.status,
        payment_status: o.paymentStatus,
        total_rwf: o.totalAmount,
        placed_at: o.createdAt,
        estimated_delivery: o.estimatedDelivery,
        items: o.orderItems.map((i: any) => `${i.quantity}× ${i.productName} @ ${i.unitPrice} RWF`),
      })),
      wallet: wallet
        ? { balance_rwf: wallet.balance, currency: wallet.currency }
        : null,
      subscription: subscription
        ? {
            plan: subscription.plan.name,
            status: subscription.status,
            valid_until: subscription.endDate,
          }
        : null,
      voucher_card: voucherCard
        ? { id: voucherCard.id, loan_limit_rwf: voucherCard.loanLimit, status: voucherCard.status }
        : null,
    };
  } catch {
    return {};
  }
}

function aiCacheKey(endpoint: string, question: string, history: any[]): string {
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
  const raw = endpoint + "||" + question + "||" + JSON.stringify(recentHistory);
  return "ai:" + crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

async function proxyAi(
  endpoint: string,
  body: Record<string, any>,
  res: Response,
  fallback: string,
  cacheable = false,
) {
  const { question, history = [] } = body;

  if (cacheable && question) {
    const key = aiCacheKey(endpoint, question, history);
    const cached = await cacheGet(key);
    if (cached) {
      try {
        return res.json({ message: "AI response", data: JSON.parse(cached) });
      } catch {
        // cache corrupt — fall through
      }
    }

    try {
      const response = await axios.post(`${AI_BASE_URL}${endpoint}`, body, { timeout: 30000 });
      await cacheSet(key, JSON.stringify(response.data), 300); // 5 min TTL
      return res.json({ message: "AI response", data: response.data });
    } catch (error: any) {
      if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        return res.json({ message: "AI response", data: { answer: fallback, platform_url: "https://food.rw" } });
      }
      return res.status(500).json({ message: error.message || "AI service error" });
    }
  }

  try {
    const response = await axios.post(`${AI_BASE_URL}${endpoint}`, body, {
      timeout: 30000,
    });
    res.json({ message: "AI response", data: response.data });
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return res.json({
        message: "AI response",
        data: { answer: fallback, platform_url: "https://food.rw" },
      });
    }
    res.status(500).json({ message: error.message || "AI service error" });
  }
}

async function proxyAiStream(
  endpoint: string,
  body: object,
  res: Response,
  fallback: string
) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  try {
    const response = await axios.post(`${AI_BASE_URL}${endpoint}`, body, {
      timeout: 60000,
      responseType: "stream",
    });
    response.data.pipe(res);
    response.data.on("end", () => res.end());
    response.data.on("error", () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });
  } catch (error: any) {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      res.write(`data: ${JSON.stringify({ token: fallback })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }
    res.write(`data: ${JSON.stringify({ error: error.message || "AI service error" })}\n\n`);
    res.end();
  }
}

// POST /mobile/restaurant/ai/chat
export const mobileAiChat = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAi(
    "/mobile/restaurant/chat",
    { question, history, user_id: u.id, role: u.role, db_context },
    res,
    "I'm currently unavailable. Please visit https://food.rw for assistance."
  );
};

// POST /mobile/restaurant/ai/market-intelligence
export const mobileAiMarketIntelligence = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  await proxyAi(
    "/mobile/restaurant/market-intelligence",
    { question, history, user_id: u.id, role: u.role },
    res,
    "Market intelligence is temporarily unavailable.",
    true, // cacheable — market data doesn't change per user
  );
};

// POST /mobile/restaurant/ai/support
export const mobileAiSupport = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAi(
    "/mobile/restaurant/support",
    { question, history, user_id: u.id, role: u.role, db_context },
    res,
    "Support is temporarily unavailable. Please visit https://food.rw for help."
  );
};

// POST /mobile/restaurant/ai/assistance
export const mobileAiAssistance = async (req: Request, res: Response) => {
  const { question, history = [], context } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAi(
    "/mobile/restaurant/assistance",
    { question, history, context, user_id: u.id, role: u.role, db_context },
    res,
    "AI assistance is temporarily unavailable."
  );
};

// POST /mobile/restaurant/ai/chat/stream  (SSE)
export const mobileAiChatStream = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAiStream(
    "/mobile/restaurant/chat/stream",
    { question, history, user_id: u.id, role: u.role, db_context },
    res,
    "I'm currently unavailable. Please visit https://food.rw for assistance."
  );
};

// POST /mobile/restaurant/ai/market-intelligence/stream  (SSE)
export const mobileAiMarketIntelligenceStream = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  await proxyAiStream(
    "/mobile/restaurant/market-intelligence/stream",
    { question, history, user_id: u.id, role: u.role },
    res,
    "Market intelligence is temporarily unavailable."
  );
};

// POST /mobile/restaurant/ai/support/stream  (SSE)
export const mobileAiSupportStream = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAiStream(
    "/mobile/restaurant/support/stream",
    { question, history, user_id: u.id, role: u.role, db_context },
    res,
    "Support is temporarily unavailable. Please visit https://food.rw for help."
  );
};

// POST /mobile/restaurant/ai/assistance/stream  (SSE)
export const mobileAiAssistanceStream = async (req: Request, res: Response) => {
  const { question, history = [], context } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  const db_context = await fetchUserContext(resolveRestaurantId(u));
  await proxyAiStream(
    "/mobile/restaurant/assistance/stream",
    { question, history, context, user_id: u.id, role: u.role, db_context },
    res,
    "AI assistance is temporarily unavailable."
  );
};

// POST /mobile/restaurant/ai/tool-call  (internal — service-secret auth only)
export const mobileAiToolCall = async (req: Request, res: Response) => {
  const secret = req.headers["x-ai-service-secret"];
  if (!AI_SERVICE_SECRET || secret !== AI_SERVICE_SECRET) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const { tool, args = {}, restaurant_id } = req.body;
  if (!tool || typeof tool !== "string") {
    return res.status(400).json({ message: "tool is required" });
  }
  if (!restaurant_id || typeof restaurant_id !== "string") {
    return res.status(400).json({ message: "restaurant_id is required" });
  }
  try {
    let result: unknown;
    switch (tool) {
      case "get_recent_orders": {
        const limit = typeof args.limit === "number" ? Math.min(args.limit, 20) : 5;
        const orders = await prisma.order.findMany({
          where: { restaurantId: restaurant_id },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
            estimatedDelivery: true,
            orderItems: {
              take: 10,
              select: { productName: true, quantity: true, unitPrice: true },
            },
          },
        });
        result = orders.map((o) => ({
          id: o.id,
          order_number: o.orderNumber,
          status: o.status,
          payment_status: o.paymentStatus,
          total_rwf: o.totalAmount,
          placed_at: o.createdAt,
          estimated_delivery: o.estimatedDelivery,
          items: o.orderItems.map((i: any) => `${i.quantity}× ${i.productName} @ ${i.unitPrice} RWF`),
        }));
        break;
      }
      case "get_wallet": {
        const wallet = await prisma.wallet.findUnique({
          where: { restaurantId: restaurant_id },
          select: { balance: true, currency: true },
        });
        result = wallet ? { balance_rwf: wallet.balance, currency: wallet.currency } : null;
        break;
      }
      case "get_subscription": {
        const sub = await prisma.restaurantSubscription.findFirst({
          where: { restaurantId: restaurant_id, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          select: {
            status: true,
            startDate: true,
            endDate: true,
            plan: { select: { name: true, price: true } },
          },
        });
        result = sub
          ? { plan: sub.plan.name, price_rwf: sub.plan.price, status: sub.status, start_date: sub.startDate, valid_until: sub.endDate }
          : null;
        break;
      }
      case "get_voucher_card": {
        const card = await prisma.voucherCard.findUnique({
          where: { restaurantId: restaurant_id },
          select: { id: true, loanLimit: true, status: true },
        });
        result = card ? { id: card.id, loan_limit_rwf: card.loanLimit, status: card.status } : null;
        break;
      }
      case "get_order_detail": {
        if (!args.order_id && !args.order_number) {
          return res.status(400).json({ message: "order_id or order_number required" });
        }
        const where: any = { restaurantId: restaurant_id };
        if (args.order_id) where.id = args.order_id;
        else where.orderNumber = args.order_number;
        const order = await prisma.order.findFirst({
          where,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            createdAt: true,
            estimatedDelivery: true,
            billingAddress: true,
            orderItems: {
              select: { productName: true, quantity: true, unitPrice: true },
            },
          },
        });
        result = order
          ? {
              id: order.id,
              order_number: order.orderNumber,
              status: order.status,
              payment_status: order.paymentStatus,
              total_rwf: order.totalAmount,
              placed_at: order.createdAt,
              estimated_delivery: order.estimatedDelivery,
              delivery_address: order.billingAddress,
              items: order.orderItems.map((i: any) => `${i.quantity}× ${i.productName} @ ${i.unitPrice} RWF`),
            }
          : null;
        break;
      }
      default:
        return res.status(400).json({ message: `Unknown tool: ${tool}` });
    }
    res.json({ tool, result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Tool call failed" });
  }
};
