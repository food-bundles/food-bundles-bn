import prisma from "../prisma";
import { NotificationCategory } from "@prisma/client";

/**
 * Add a notification recipient
 */
export const addNotificationRecipientService = async (data: {
  name: string;
  phoneNumber: string;
  category: NotificationCategory;
  createdBy?: string;
}) => {
  const { name, phoneNumber, category, createdBy } = data;

  // Check if phone number already exists for this category
  const existing = await prisma.notificationRecipient.findFirst({
    where: {
      phoneNumber,
      category,
      isActive: true,
    },
  });

  if (existing) {
    throw new Error(
      `Phone number ${phoneNumber} is already registered for ${category} notifications`
    );
  }

  const recipient = await prisma.notificationRecipient.create({
    data: {
      name,
      phoneNumber,
      category,
      createdBy,
    },
  });

  return recipient;
};

/**
 * Get all notification recipients
 */
export const getAllNotificationRecipientsService = async (filters?: {
  category?: NotificationCategory;
  isActive?: boolean;
}) => {
  const where: any = {};

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.isActive !== undefined) {
    where.isActive = filters.isActive;
  }

  const recipients = await prisma.notificationRecipient.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return recipients;
};

/**
 * Update notification recipient
 */
export const updateNotificationRecipientService = async (
  id: string,
  data: {
    name?: string;
    phoneNumber?: string;
    category?: NotificationCategory;
    isActive?: boolean;
  }
) => {
  const recipient = await prisma.notificationRecipient.update({
    where: { id },
    data,
  });

  return recipient;
};

/**
 * Delete notification recipient
 */
export const deleteNotificationRecipientService = async (id: string) => {
  await prisma.notificationRecipient.delete({
    where: { id },
  });

  return { message: "Notification recipient deleted successfully" };
};

/**
 * Get recipients by category
 */
export const getRecipientsByCategoryService = async (
  category: NotificationCategory
) => {
  const recipients = await prisma.notificationRecipient.findMany({
    where: {
      category,
      isActive: true,
    },
  });

  return recipients;
};
