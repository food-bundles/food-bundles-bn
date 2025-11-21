import prisma from "../prisma";

export interface NotificationData {
  title: string;
  message: string;
  eventType: string;
  targetType: string;
  targetId?: string;
  targetRole?: string;
  metadata?: any;
}

// Create Notification
export const createNotificationService = async (notificationData: NotificationData) => {
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
  { page = 1, limit = 10, isRead }: { page?: number; limit?: number; isRead?: boolean }
) => {
  const skip = (page - 1) * limit;

  const where: any = {
    OR: [
      { targetType: "ALL_USERS" },
      { targetType: "SPECIFIC_USER", targetId: userId },
      { targetType: "ROLE_BASED", targetRole: userRole as any },
    ],
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
  userRole: string
) => {
  const result = await prisma.notification.updateMany({
    where: {
      OR: [
        { targetType: "ALL_USERS" },
        { targetType: "SPECIFIC_USER", targetId: userId },
        { targetType: "ROLE_BASED", targetRole: userRole as any },
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
export const getUnreadCountService = async (userId: string, userRole: string) => {
  const count = await prisma.notification.count({
    where: {
      OR: [
        { targetType: "ALL_USERS" },
        { targetType: "SPECIFIC_USER", targetId: userId },
        { targetType: "ROLE_BASED", targetRole: userRole as any },
      ],
      isRead: false,
    },
  });

  return { unreadCount: count };
};