import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileAiChat,
  mobileAiMarketIntelligence,
  mobileAiSupport,
  mobileAiAssistance,
  mobileAiChatStream,
  mobileAiMarketIntelligenceStream,
  mobileAiSupportStream,
  mobileAiAssistanceStream,
} from "../../../controllers/mobile/restaurant/ai.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.post("/chat", ...guard, mobileAiChat);
router.post("/market-intelligence", ...guard, mobileAiMarketIntelligence);
router.post("/support", ...guard, mobileAiSupport);
router.post("/assistance", ...guard, mobileAiAssistance);

// SSE streaming variants
router.post("/chat/stream", ...guard, mobileAiChatStream);
router.post("/market-intelligence/stream", ...guard, mobileAiMarketIntelligenceStream);
router.post("/support/stream", ...guard, mobileAiSupportStream);
router.post("/assistance/stream", ...guard, mobileAiAssistanceStream);

export default router;
