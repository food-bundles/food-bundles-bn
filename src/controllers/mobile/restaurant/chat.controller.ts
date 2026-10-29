import { Request, Response } from "express";
import prisma from "../../../prisma";
import wsManager from "../../../utils/ws_singleton";

const user = (req: Request) => (req as any).user;

// GET /mobile/restaurant/chat/conversations
export const listConversations = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const conversations = await prisma.chatConversation.findMany({
      where: {
        participants: { some: { restaurantId: me.id } },
      },
      include: {
        participants: { include: { restaurant: { select: { id: true, name: true } } } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const data = conversations.map((c) => {
      const lastMsg = c.messages[0] ?? null;
      const unread = 0; // computed separately if needed
      return {
        id: c.id,
        kind: c.kind,
        participantIds: c.participants.map((p) => p.restaurantId),
        participants: c.participants.map((p) => ({
          id: p.restaurantId,
          name: p.restaurant?.name ?? p.restaurantId,
        })),
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              senderId: lastMsg.senderId,
              kind: lastMsg.kind,
              body: lastMsg.body,
              attachment: lastMsg.attachment ?? undefined,
              durationMs: lastMsg.durationMs ?? undefined,
              sentAt: lastMsg.sentAt.toISOString(),
              deliveredAt: lastMsg.deliveredAt?.toISOString(),
              readAt: lastMsg.readAt?.toISOString(),
            }
          : null,
        unreadCount: unread,
      };
    });

    res.json({ message: "Conversations retrieved", data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get conversations" });
  }
};

// GET /mobile/restaurant/chat/conversations/:conversationId/messages
export const getMessages = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { conversationId } = req.params;

    const participant = await prisma.chatParticipant.findFirst({
      where: { conversationId, restaurantId: me.id },
    });
    if (!participant) return res.status(403).json({ message: "Not a participant" });

    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { sentAt: "asc" },
    });

    res.json({
      message: "Messages retrieved",
      data: messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        kind: m.kind,
        body: m.body,
        attachment: m.attachment ?? undefined,
        durationMs: m.durationMs ?? undefined,
        sentAt: m.sentAt.toISOString(),
        deliveredAt: m.deliveredAt?.toISOString(),
        readAt: m.readAt?.toISOString(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get messages" });
  }
};

// POST /mobile/restaurant/chat/conversations/:conversationId/messages
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { conversationId } = req.params;
    const { kind = "text", body = "", attachment, durationMs } = req.body;

    const participant = await prisma.chatParticipant.findFirst({
      where: { conversationId, restaurantId: me.id },
    });
    if (!participant) return res.status(403).json({ message: "Not a participant" });

    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: me.id,
        kind,
        body,
        attachment: attachment ?? null,
        durationMs: durationMs ?? null,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const msgPayload = {
      conversationId,
      messageId: message.id,
      senderId: message.senderId,
      kind: message.kind as "text" | "voice" | "file" | "image",
      body: message.body,
      attachment: message.attachment ?? undefined,
      durationMs: message.durationMs ?? undefined,
      sentAt: message.sentAt.toISOString(),
      deliveredAt: message.deliveredAt?.toISOString(),
    };

    wsManager.broadcastChatMessage(msgPayload);

    res.status(201).json({ message: "Message sent", data: msgPayload });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to send message" });
  }
};

// POST /mobile/restaurant/chat/conversations
export const startConversation = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { peerId, kind = "peer" } = req.body;
    if (!peerId) return res.status(400).json({ message: "peerId is required" });

    // Check if conversation already exists between these two
    const existing = await prisma.chatConversation.findFirst({
      where: {
        kind,
        participants: { every: { restaurantId: { in: [me.id, peerId] } } },
      },
      include: { participants: true },
    });

    if (existing && existing.participants.length === 2) {
      return res.json({ message: "Conversation exists", data: { id: existing.id } });
    }

    const conversation = await prisma.chatConversation.create({
      data: {
        kind,
        participants: {
          create: [{ restaurantId: me.id }, { restaurantId: peerId }],
        },
      },
    });

    res.status(201).json({ message: "Conversation started", data: { id: conversation.id } });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to start conversation" });
  }
};

// PATCH /mobile/restaurant/chat/conversations/:conversationId/read
export const markRead = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { conversationId } = req.params;

    const updated = await prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: me.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    if (updated.count > 0) {
      wsManager.broadcastChatRead(conversationId, '', me.id);
    }

    res.json({ message: "Marked as read" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to mark read" });
  }
};

// POST /mobile/restaurant/chat/conversations/:conversationId/typing
export const sendTyping = async (req: Request, res: Response) => {
  try {
    const me = user(req);
    const { conversationId } = req.params;
    const { isTyping = true } = req.body;
    wsManager.broadcastChatTyping(conversationId, me.id, isTyping);
    res.json({ message: "ok" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed" });
  }
};
