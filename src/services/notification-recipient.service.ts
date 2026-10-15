import prisma from "../prisma";
import { NotificationCategory } from "@prisma/client";
import { sendMessage } from "../utils/sms.utility";
import { getEmailTransporter } from "../utils/emails";

/**
 * Add a notification recipient
 */
export const addNotificationRecipientService = async (data: {
  name: string;
  phoneNumber: string;
  email?: string;
  category: NotificationCategory;
  createdBy?: string;
}) => {
  const { name, phoneNumber, email, category, createdBy } = data;

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
      email: email || null,
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
    email?: string | null;
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

/**
 * Send a plain-text notification (SMS always, email when the recipient has
 * one on file) to every active recipient of a category. This is the
 * DB-driven replacement for ad hoc `process.env.PRIVATE_RECEIVER` SMS calls —
 * new recipients can be added/removed via the NotificationRecipient admin
 * endpoints without touching environment variables or redeploying.
 *
 * Each recipient's SMS/email is isolated in its own try/catch so one
 * recipient's delivery failure can never block another's, or the caller's
 * already-committed business operation.
 */
export const sendToRecipientsByCategoryService = async (
  category: NotificationCategory,
  message: { subject: string; body: string }
) => {
  const recipients = await getRecipientsByCategoryService(category);

  for (const recipient of recipients) {
    try {
      if (recipient.phoneNumber) {
        await sendMessage(message.body, recipient.phoneNumber);
      }
    } catch (smsError) {
      console.error(
        `Failed to send ${category} SMS to recipient ${recipient.id}:`,
        smsError
      );
    }

    try {
      if (recipient.email) {
        const transporter = getEmailTransporter();
        await transporter.sendMail({
          from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
          to: recipient.email,
          subject: message.subject,
          text: message.body,
        });
      }
    } catch (emailError) {
      console.error(
        `Failed to send ${category} email to recipient ${recipient.id}:`,
        emailError
      );
    }
  }

  return { recipientCount: recipients.length };
};
