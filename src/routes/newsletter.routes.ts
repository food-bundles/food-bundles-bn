import { Router } from "express";
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getNewsletterStatus,
  getAllSubscribers,
  createNewsletterCampaign,
  sendNewsletterCampaign,
  getAllCampaigns,
  updateCampaign,
  deleteCampaign,
  sendWeeklyPriceUpdate,
} from "../controllers/newsletter.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const newsletterRoutes = Router();

// Public routes - anyone can subscribe/unsubscribe
newsletterRoutes.post("/subscribe", subscribeToNewsletter);
newsletterRoutes.post("/unsubscribe", unsubscribeFromNewsletter);
newsletterRoutes.get("/status", getNewsletterStatus);

// Admin routes - subscriber management
newsletterRoutes.get(
  "/subscribers",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllSubscribers,
);

// Admin routes - campaign management
newsletterRoutes.post(
  "/campaigns",
  isAuthenticated,
  checkPermission("ADMIN"),
  createNewsletterCampaign,
);

newsletterRoutes.get(
  "/campaigns",
  isAuthenticated,
  checkPermission("ADMIN"),
  getAllCampaigns,
);

newsletterRoutes.put(
  "/campaigns/:campaignId",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateCampaign,
);

newsletterRoutes.delete(
  "/campaigns/:campaignId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteCampaign,
);

newsletterRoutes.post(
  "/campaigns/:campaignId/send",
  isAuthenticated,
  checkPermission("ADMIN"),
  sendNewsletterCampaign,
);

// Admin route - send weekly price update
newsletterRoutes.post(
  "/weekly-update",
  isAuthenticated,
  checkPermission("ADMIN"),
  sendWeeklyPriceUpdate,
);

export default newsletterRoutes;
