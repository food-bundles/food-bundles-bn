import { Request, Response } from "express";
import axios from "axios";

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const user = (req: Request) => (req as any).user;

async function proxyAi(
  endpoint: string,
  body: object,
  res: Response,
  fallback: string
) {
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
  await proxyAi(
    "/mobile/restaurant/chat",
    { question, history, user_id: u.id, role: u.role },
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
    "Market intelligence is temporarily unavailable."
  );
};

// POST /mobile/restaurant/ai/support
export const mobileAiSupport = async (req: Request, res: Response) => {
  const { question, history = [] } = req.body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ message: "question is required" });
  }
  const u = user(req);
  await proxyAi(
    "/mobile/restaurant/support",
    { question, history, user_id: u.id, role: u.role },
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
  await proxyAi(
    "/mobile/restaurant/assistance",
    { question, history, context, user_id: u.id, role: u.role },
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
  await proxyAiStream(
    "/mobile/restaurant/chat/stream",
    { question, history, user_id: u.id, role: u.role },
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
  await proxyAiStream(
    "/mobile/restaurant/support/stream",
    { question, history, user_id: u.id, role: u.role },
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
  await proxyAiStream(
    "/mobile/restaurant/assistance/stream",
    { question, history, context, user_id: u.id, role: u.role },
    res,
    "AI assistance is temporarily unavailable."
  );
};
