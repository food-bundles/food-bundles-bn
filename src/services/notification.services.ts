import prisma from "../prisma";
import { sendMessage } from "../utils/sms.utility";
import { sendPriceUpdateEmail, PriceUpdateData } from "../utils/emailTemplates";
import { NotificationEvent } from "@prisma/client";

export interface NotificationData {
  title: string;
  message: string;
  eventType: string;
  targetType: string;
  targetId?: string | null | undefined;
  targetRole?: string;
  metadata?: any;
}

// Create Notification
export const createNotificationService = async (
  notificationData: NotificationData,
) => {
  const notification = await prisma.notification.create({
    data: {
      title: notificationData.title.trim(),
      message: notificationData.message.trim(),
      eventType: notificationData.eventType as any,
      targetType: notificationData.targetType as any,
      targetId: notificationData.targetId,
      targetRole: notificationData.targetRole as any,
      metadata: notificationData.metadata,
    },
  });

  return notification;
};

// Get all Notifications with filtering and pagination
export const getAllNotificationsService = async ({
  eventType,
  targetType,
  isRead,
  page = 1,
  limit = 10,
}: {
  eventType?: string;
  targetType?: string;
  isRead?: boolean;
  page?: number;
  limit?: number;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (eventType) {
    where.eventType = eventType;
  }

  if (targetType) {
    where.targetType = targetType;
  }

  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get Notifications for specific user
export const getUserNotificationsService = async (
  userId: string,
  userRole: string,
  {
    page = 1,
    limit = 10,
    isRead,
    restaurantId,
  }: { page?: number; limit?: number; isRead?: boolean; restaurantId?: string },
) => {
  const skip = (page - 1) * limit;

  const orConditions: any[] = [
    { targetType: "ALL_USERS" },
    { targetType: "SPECIFIC_USER", targetId: userId },
    { targetType: "ROLE_BASED", targetRole: userRole as any },
  ];

  if (restaurantId) {
    orConditions.push({ targetType: "SPECIFIC_USER", targetId: restaurantId });
    orConditions.push({ targetType: "ROLE_BASED", targetRole: "RESTAURANT" });
  }

  const where: any = {
    OR: orConditions,
  };

  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get Notification by ID
export const getNotificationByIdService = async (notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  return notification;
};

// Mark notification as read
export const markNotificationAsReadService = async (notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  const updatedNotification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updatedNotification;
};

// Mark all user notifications as read
export const markAllUserNotificationsAsReadService = async (
  userId: string,
  userRole: string,
  restaurantId?: string,
) => {
  const result = await prisma.notification.updateMany({
    where: {
      OR: [
        { targetType: "ALL_USERS" },
        { targetType: "SPECIFIC_USER", targetId: userId },
        { targetType: "ROLE_BASED", targetRole: userRole as any },
        ...(restaurantId
          ? [
              { targetType: "SPECIFIC_USER" as any, targetId: restaurantId },
              {
                targetType: "ROLE_BASED" as any,
                targetRole: "RESTAURANT" as any,
              },
            ]
          : []),
      ],
      isRead: false,
    },
    data: { isRead: true },
  });

  return {
    message: `${result.count} notifications marked as read`,
    updatedCount: result.count,
  };
};

// Delete Notification
export const deleteNotificationService = async (notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });

  return { message: "Notification deleted successfully" };
};

// Get unread count for user
export const getUnreadCountService = async (
  userId: string,
  userRole: string,
  restaurantId?: string,
) => {
  const count = await prisma.notification.count({
    where: {
      OR: [
        { targetType: "ALL_USERS" },
        { targetType: "SPECIFIC_USER", targetId: userId },
        { targetType: "ROLE_BASED", targetRole: userRole as any },
        ...(restaurantId
          ? [
              { targetType: "SPECIFIC_USER" as any, targetId: restaurantId },
              {
                targetType: "ROLE_BASED" as any,
                targetRole: "RESTAURANT" as any,
              },
            ]
          : []),
      ],
      isRead: false,
    },
  });

  return { unreadCount: count };
};

// Send price update notifications
export const sendPriceUpdateNotificationsService = async () => {
  try {
    // Get recently updated products (where updatedAt > createdAt, max 5)
    const recentlyUpdatedProducts = await prisma.product.findMany({
      where: {
        updatedAt: {
          gt: prisma.product.fields.createdAt,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        productName: true,
        unitPrice: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (recentlyUpdatedProducts.length === 0) {
      return { message: "No recently updated products found" };
    }

    // Prepare price update data
    const priceUpdateData: PriceUpdateData = {
      products: recentlyUpdatedProducts.map((product) => ({
        id: product.id,
        name: product.productName,
        newPrice: product.unitPrice,
        updatedAt: product.updatedAt,
      })),
    };

    // Get all restaurants
    const restaurants = await prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    });

    // Get all admins and logistics
    const adminUsers = await prisma.admin.findMany({
      where: {
        role: {
          in: ["ADMIN", "LOGISTICS"],
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    // Send SMS notifications
    const smsPromises: Promise<any>[] = [];

    // SMS to restaurants
    restaurants.forEach((restaurant) => {
      if (restaurant.phone) {
        smsPromises.push(
          sendMessage(
            `Dear ${
              restaurant.name || "valued customer"
            }, product prices have been updated on FoodBundles. Check the latest prices for your next order. Thank you!`,
            restaurant.phone,
          ).catch((error) =>
            console.error(
              `SMS failed for restaurant ${restaurant.name}:`,
              error,
            ),
          ),
        );
      }
    });

    // SMS to private numbers
    const privateNumbers = [
      process.env.PRIVATE_RECEIVER,
      process.env.LOGISTICS_NUMBER_ONE,
      process.env.LOGISTICS_NUMBER_TWO,
      process.env.LOGISTICS_NUMBER_THREE,
    ].filter(Boolean);

    privateNumbers.forEach((phone) => {
      smsPromises.push(
        sendMessage(
          "Product prices have been updated on FoodBundles platform. Please check the latest updates.",
          phone!,
        ).catch((error) =>
          console.error(`SMS failed for private number ${phone}:`, error),
        ),
      );
    });

    // Send email notifications
    const emailPromises: Promise<any>[] = [];

    // Emails to restaurants
    restaurants.forEach((restaurant) => {
      if (restaurant.email) {
        emailPromises.push(
          sendPriceUpdateEmail(restaurant.email, {
            ...priceUpdateData,
            recipientName: restaurant.name,
          }).catch((error) =>
            console.error(
              `Email failed for restaurant ${restaurant.name}:`,
              error,
            ),
          ),
        );
      }
    });

    // Emails to admins and logistics
    adminUsers.forEach((admin) => {
      if (admin.email) {
        emailPromises.push(
          sendPriceUpdateEmail(admin.email, {
            ...priceUpdateData,
            recipientName: admin.username,
          }).catch((error) =>
            console.error(`Email failed for admin ${admin.username}:`, error),
          ),
        );
      }
    });

    // Emails to private addresses
    const privateEmails = [
      process.env.ADMIN_EMAIL,
      process.env.TECH_EMAIL,
    ].filter(Boolean);

    privateEmails.forEach((email) => {
      emailPromises.push(
        sendPriceUpdateEmail(email!, priceUpdateData).catch((error) =>
          console.error(`Email failed for private email ${email}:`, error),
        ),
      );
    });

    // Create in-app notifications
    const productNames = recentlyUpdatedProducts
      .map((p) => p.productName)
      .join(", ");

    await createNotificationService({
      title: "Product Prices Updated",
      message: `Product prices updated including: ${productNames}. Check the latest prices for your orders.`,
      eventType: NotificationEvent.PRODUCT_PRICE_UPDATED,
      targetType: "ROLE_BASED",
      targetRole: "RESTAURANT",
      metadata: {
        updatedProducts: recentlyUpdatedProducts.map((p) => ({
          id: p.id,
          name: p.productName,
          newPrice: p.unitPrice,
        })),
      },
    });

    await createNotificationService({
      title: "Product Prices Updated",
      message: `Product prices updated including: ${productNames}.`,
      eventType: NotificationEvent.PRODUCT_PRICE_UPDATED,
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        updatedProducts: recentlyUpdatedProducts.map((p) => ({
          id: p.id,
          name: p.productName,
          newPrice: p.unitPrice,
        })),
      },
    });

    await createNotificationService({
      title: "Product Prices Updated",
      message: `Product prices updated including: ${productNames}.`,
      eventType: NotificationEvent.PRODUCT_PRICE_UPDATED,
      targetType: "ROLE_BASED",
      targetRole: "LOGISTICS",
      metadata: {
        updatedProducts: recentlyUpdatedProducts.map((p) => ({
          id: p.id,
          name: p.productName,
          newPrice: p.unitPrice,
        })),
      },
    });

    // Execute all notifications
    await Promise.allSettled([...smsPromises, ...emailPromises]);

    return {
      message: "Price update notifications sent successfully",
      productsCount: recentlyUpdatedProducts.length,
      restaurantsNotified: restaurants.length,
      adminsNotified: adminUsers.length,
    };
  } catch (error) {
    console.error("Failed to send price update notifications:", error);
    throw new Error("Failed to send price update notifications");
  }
};
