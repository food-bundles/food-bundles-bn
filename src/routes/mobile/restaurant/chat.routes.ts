import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  listConversations,
  getMessages,
  sendMessage,
  startConversation,
  markRead,
  sendTyping,
} from "../../../controllers/mobile/restaurant/chat.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.get("/conversations", ...guard, listConversations);
router.post("/conversations", ...guard, startConversation);
router.get("/conversations/:conversationId/messages", ...guard, getMessages);
router.post("/conversations/:conversationId/messages", ...guard, sendMessage);
router.patch("/conversations/:conversationId/read", ...guard, markRead);
router.post("/conversations/:conversationId/typing", ...guard, sendTyping);

export default router;
