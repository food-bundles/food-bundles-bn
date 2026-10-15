import { Request, Response } from "express";
import {
  subscribeToNewsletterService,
  unsubscribeFromNewsletterService,
  getNewsletterStatusService,
  getAllSubscribersService,
  createNewsletterCampaignService,
  sendNewsletterCampaignService,
  getAllCampaignsService,
  updateCampaignService,
  deleteCampaignService,
  sendWeeklyPriceUpdateService,
} from "../services/newsletter.service";

// Subscribe to newsletter
export const subscribeToNewsletter = async (req: Request, res: Response) => {
  try {
    const { email, name, phone, restaurantId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const subscriber = await subscribeToNewsletterService({
      email,
      name,
      phone,
      restaurantId,
    });

    res.status(201).json({
      success: true,
      message: "Successfully subscribed to newsletter",
      data: subscriber,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Unsubscribe from newsletter
export const unsubscribeFromNewsletter = async (
  req: Request,
  res: Response,
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    await unsubscribeFromNewsletterService(email);

    res.status(200).json({
      success: true,
      message: "Successfully unsubscribed from newsletter",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Check newsletter subscription status
export const getNewsletterStatus = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const status = await getNewsletterStatusService(email as string);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all subscribers (admin)
export const getAllSubscribers = async (req: Request, res: Response) => {
  try {
    const { page, limit, isActive } = req.query;

    const result = await getAllSubscribersService({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    res.status(200).json({
      success: true,
      data: result.subscribers,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Create newsletter campaign (admin)
export const createNewsletterCampaign = async (
  req: Request,
  res: Response,
) => {
  try {
    const adminId = (req as any).user.id;
    const { subject, content } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: "Subject and content are required",
      });
    }

    const campaign = await createNewsletterCampaignService({
      subject,
      content,
      createdBy: adminId,
    });

    res.status(201).json({
      success: true,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Send newsletter campaign (admin)
export const sendNewsletterCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    const campaign = await sendNewsletterCampaignService(campaignId);

    res.status(200).json({
      success: true,
      message: "Campaign sent successfully",
      data: campaign,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all campaigns (admin)
export const getAllCampaigns = async (req: Request, res: Response) => {
  try {
    const { page, limit, status } = req.query;

    const result = await getAllCampaignsService({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string,
    });

    res.status(200).json({
      success: true,
      data: result.campaigns,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Update campaign (admin)
export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { subject, content } = req.body;

    const campaign = await updateCampaignService(campaignId, {
      subject,
      content,
    });

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete campaign (admin)
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;

    await deleteCampaignService(campaignId);

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Send weekly price update (admin/cron)
export const sendWeeklyPriceUpdate = async (req: Request, res: Response) => {
  try {
    const result = await sendWeeklyPriceUpdateService();

    res.status(200).json({
      success: true,
      message: result.message,
      data: { sentCount: result.sent },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
