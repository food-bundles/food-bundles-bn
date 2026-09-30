import { Router } from "express";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getAllSubscribers,
  createNewsletterCampaign,
  sendNewsletterCampaign,
  getAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendWeeklyPriceUpdate,
} from "../controllers/newsletter.controller";
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const newsletterRoutes = Router();

// Public routes - anyone can subscribe/unsubscribe
newsletterRoutes.post("/subscribe", subscribeToNewsletter);
newsletterRoutes.post("/unsubscribe", unsubscribeFromNewsletter);

// Admin routes - subscriber management
newsletterRoutes.get(
  "/subscribers",
  isAuthenticated,
  allow("newsletter"),
  getAllSubscribers,
);

// Admin routes - campaign management
newsletterRoutes.post(
  "/campaigns",
  isAuthenticated,
  allow("newsletter"),
  createNewsletterCampaign,
);

newsletterRoutes.get(
  "/campaigns",
  isAuthenticated,
  allow("newsletter"),
  getAllCampaigns,
);

newsletterRoutes.put(
  "/campaigns/:campaignId",
  isAuthenticated,
  allow("newsletter"),
  updateCampaign,
);

newsletterRoutes.delete(
  "/campaigns/:campaignId",
  isAuthenticated,
  allow("newsletter"),
  deleteCampaign,
);

newsletterRoutes.post(
  "/campaigns/:campaignId/send",
  isAuthenticated,
  allow("newsletter"),
  sendNewsletterCampaign,
);

// Admin route - send weekly price update
newsletterRoutes.post(
  "/weekly-update",
  isAuthenticated,
  allow("newsletter"),
  sendWeeklyPriceUpdate,
);

export default newsletterRoutes;
