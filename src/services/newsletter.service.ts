import cron from "node-cron";
import prisma from "../prisma";
import {
  sendNewsletterWelcomeEmail,
  sendNewsletterCampaignEmail,
} from "../utils/emailTemplates";

// Subscribe to newsletter
export const subscribeToNewsletterService = async (data: {
  email: string;
  name?: string;
  phone?: string;
  restaurantId?: string;
}) => {
  const { email, name, phone, restaurantId } = data;

  const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });

  if (existingSubscriber) {
    if (!existingSubscriber.isActive) {
      const updated = await prisma.newsletterSubscriber.update({
        where: { email },
        data: { isActive: true, name, phone, restaurantId },
      });
      await sendNewsletterWelcomeEmail({ email, name: name || "Subscriber" });
      return updated;
    }
    throw new Error("Email already subscribed to newsletter");
  }

  const subscriber = await prisma.newsletterSubscriber.create({
    data: { email, name, phone, restaurantId },
  });

  await sendNewsletterWelcomeEmail({ email, name: name || "Subscriber" });

  return subscriber;
};

// Unsubscribe from newsletter
export const unsubscribeFromNewsletterService = async (email: string) => {
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });

  if (!subscriber) {
    throw new Error("Email not found in newsletter subscribers");
  }

  return await prisma.newsletterSubscriber.update({
    where: { email },
    data: { isActive: false },
  });
};

// Check newsletter subscription status
export const getNewsletterStatusService = async (email: string) => {
  const subscriber = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });

  return {
    isSubscribed: !!subscriber && subscriber.isActive,
  };
};

// Get all subscribers (admin)
export const getAllSubscribersService = async (filters?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
}) => {
  const { page = 1, limit = 50, isActive } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (isActive !== undefined) where.isActive = isActive;

  const [subscribers, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.newsletterSubscriber.count({ where }),
  ]);

  return {
    subscribers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Create newsletter campaign (admin)
export const createNewsletterCampaignService = async (data: {
  subject: string;
  content: string;
  createdBy: string;
}) => {
  return await prisma.newsletterCampaign.create({
    data: {
      subject: data.subject,
      content: data.content,
      sentBy: data.createdBy,
      status: "DRAFT",
    },
  });
};

// Send newsletter campaign (admin)
export const sendNewsletterCampaignService = async (campaignId: string) => {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status === "SENT") {
    throw new Error("Campaign already sent");
  }

  const activeSubscribers = await prisma.newsletterSubscriber.findMany({
    where: { isActive: true },
  });

  if (activeSubscribers.length === 0) {
    throw new Error("No active subscribers found");
  }

  await prisma.newsletterCampaign.update({
    where: { id: campaignId },
    data: { status: "SENDING" },
  });

  let sentCount = 0;
  const emailPromises = activeSubscribers.map(async (subscriber) => {
    try {
      await sendNewsletterCampaignEmail({
        email: subscriber.email,
        name: subscriber.name || "Subscriber",
        subject: campaign.subject,
        content: campaign.content,
      });
      sentCount++;
    } catch (error) {
      console.error(`Failed to send to ${subscriber.email}:`, error);
    }
  });

  await Promise.all(emailPromises);

  return await prisma.newsletterCampaign.update({
    where: { id: campaignId },
    data: {
      status: sentCount > 0 ? "SENT" : "FAILED",
      sentAt: new Date(),
      recipientCount: sentCount,
    },
  });
};

// Get all campaigns (admin)
export const getAllCampaignsService = async (filters?: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  const { page = 1, limit = 10, status } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;

  const [campaigns, total] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      where,
      skip,
      take: limit,
      include: {
        admin: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.newsletterCampaign.count({ where }),
  ]);

  return {
    campaigns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Update campaign (admin)
export const updateCampaignService = async (
  campaignId: string,
  data: { subject?: string; content?: string },
) => {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status === "SENT") {
    throw new Error("Cannot update sent campaign");
  }

  return await prisma.newsletterCampaign.update({
    where: { id: campaignId },
    data,
  });
};

// Delete campaign (admin)
export const deleteCampaignService = async (campaignId: string) => {
  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.status === "SENT") {
    throw new Error("Cannot delete sent campaign");
  }

  return await prisma.newsletterCampaign.delete({
    where: { id: campaignId },
  });
};

// Send automatic weekly price update newsletter
export const sendWeeklyPriceUpdateService = async () => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const updatedProducts = await prisma.product.findMany({
    where: {
      updatedAt: { gte: oneWeekAgo },
      status: "ACTIVE",
    },
    select: {
      id: true,
      productName: true,
      unitPrice: true,
      updatedAt: true,
    },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  if (updatedProducts.length === 0) {
    return { message: "No price updates this week", sent: 0 };
  }

  const activeSubscribers = await prisma.newsletterSubscriber.findMany({
    where: { isActive: true },
  });

  if (activeSubscribers.length === 0) {
    return { message: "No active subscribers", sent: 0 };
  }

  let sentCount = 0;
  const emailPromises = activeSubscribers.map(async (subscriber) => {
    try {
      await sendNewsletterCampaignEmail({
        email: subscriber.email,
        name: subscriber.name || "Subscriber",
        subject: "Weekly Price Updates - FoodBundles",
        content: `
          <h2>This Week's Price Updates</h2>
          <p>Here are the latest product price updates from FoodBundles:</p>
          <ul>
            ${updatedProducts
              .map(
                (p) =>
                  `<li><strong>${p.productName}</strong>: ${p.unitPrice.toLocaleString()} RWF (Updated: ${new Date(p.updatedAt).toLocaleDateString()})</li>`,
              )
              .join("")}
          </ul>
          <p>Stay informed with stable, competitive prices updated weekly!</p>
        `,
      });
      sentCount++;
    } catch (error) {
      console.error(`Failed to send to ${subscriber.email}:`, error);
    }
  });

  await Promise.all(emailPromises);

  return { message: "Weekly price update sent", sent: sentCount };
};

/**
 * Schedule weekly price update reminders
 * Runs every Monday at 7:00 AM (00 09 * * 1)
 */
export const scheduleWeeklyPriceUpdate = () => {
  // Run every Monday at 7 AM
  cron.schedule("0 7 * * 1", async () => {
    console.log("Running weekly price update newsletter...");
    try {
      await sendWeeklyPriceUpdateService();
    } catch (error) {
      console.error("Failed to send weekly price update:", error);
    }
  });

  console.log(
    "Weekly price update scheduler initialized - runs every Monday at 7:00 AM",
  );
};
