import { Request, Response } from "express";
import {
  addNotificationRecipientService,
  getAllNotificationRecipientsService,
  updateNotificationRecipientService,
  deleteNotificationRecipientService,
} from "../services/notification-recipient.service";
import { NotificationCategory } from "@prisma/client";

/**
 * Add notification recipient (Admin only)
 * POST /notification-recipients
 */
export const addNotificationRecipient = async (
  req: Request,
  res: Response
) => {
  try {
    const adminId = (req as any).user.id;
    const { name, phoneNumber, category } = req.body;

    if (!name || !phoneNumber || !category) {
      return res.status(400).json({
        message: "Name, phone number, and category are required",
      });
    }

    // Validate category
    if (!Object.values(NotificationCategory).includes(category)) {
      return res.status(400).json({
        message: "Invalid notification category",
      });
    }

    const recipient = await addNotificationRecipientService({
      name,
      phoneNumber,
      category,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Notification recipient added successfully",
      data: recipient,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to add notification recipient",
    });
  }
};

/**
 * Get all notification recipients (Admin only)
 * GET /notification-recipients
 */
export const getAllNotificationRecipients = async (
  req: Request,
  res: Response
) => {
  try {
    const { category, isActive } = req.query;

    const filters: any = {};
    if (category) filters.category = category as NotificationCategory;
    if (isActive !== undefined)
      filters.isActive = isActive === "true";

    const recipients = await getAllNotificationRecipientsService(filters);

    res.status(200).json({
      message: "Notification recipients retrieved successfully",
      data: recipients,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get notification recipients",
    });
  }
};

/**
 * Update notification recipient (Admin only)
 * PATCH /notification-recipients/:id
 */
export const updateNotificationRecipient = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, category, isActive } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const recipient = await updateNotificationRecipientService(id, updateData);

    res.status(200).json({
      message: "Notification recipient updated successfully",
      data: recipient,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update notification recipient",
    });
  }
};

/**
 * Delete notification recipient (Admin only)
 * DELETE /notification-recipients/:id
 */
export const deleteNotificationRecipient = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    await deleteNotificationRecipientService(id);

    res.status(200).json({
      message: "Notification recipient deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to delete notification recipient",
    });
  }
};
