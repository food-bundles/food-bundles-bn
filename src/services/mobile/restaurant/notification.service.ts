import {
  getUserNotificationsService,
  getUnreadCountService,
  markNotificationAsReadService,
  markAllUserNotificationsAsReadService,
} from "../../notification.services";

export const mobileGetNotifications = (userId: string, userRole: string, query: any) =>
  getUserNotificationsService(userId, userRole, query);

export const mobileGetUnreadCount = (userId: string, userRole: string) =>
  getUnreadCountService(userId, userRole);

export const mobileMarkRead = (notificationId: string) =>
  markNotificationAsReadService(notificationId);

export const mobileMarkAllRead = (userId: string, userRole: string) =>
  markAllUserNotificationsAsReadService(userId, userRole);
