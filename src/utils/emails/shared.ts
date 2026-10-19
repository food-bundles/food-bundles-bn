import nodemailer from "nodemailer";

export interface CheckoutItemData {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unit: string;
  images: string[];
  category?: string;
}

export interface PasswordResetData {
  email: string;
  name: string;
  resetLink: string;
  userType: string;
}

// Clean and format phone number for Rwanda
export const cleanPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Replace +2507 with 07 (remove +25)
  if (cleaned.startsWith("2507")) {
    cleaned = "07" + cleaned.slice(4);
  } else if (cleaned.startsWith("+2507")) {
    cleaned = "07" + cleaned.slice(5);
  }

  return cleaned;
};
// Validate Rwanda phone number
export const isValidRwandaPhone = (phone: string): boolean => {
  const cleanPhone = cleanPhoneNumber(phone);
  const validPrefixes = ["078", "079", "072", "073"];
  return validPrefixes.some((prefix) => cleanPhone.startsWith(prefix));
};

/**
 * Shared nodemailer transporter factory used by every sender function
 * across the email modules. Throws if the Gmail env vars are missing,
 * matching the guard every sender previously duplicated inline.
 */
export const getEmailTransporter = () => {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    throw new Error("Email not sent: EVs are not configured.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Same as getEmailTransporter, but also requires ADMIN_EMAIL to be set —
 * used by sender functions that notify the internal admin inbox.
 */
export const getAdminEmailTransporter = () => {
  if (
    !process.env.GOOGLE_EMAIL ||
    !process.env.GOOGLE_PASSWORD ||
    !process.env.ADMIN_EMAIL
  ) {
    throw new Error(
      "GOOGLE_EMAIL, GOOGLE_PASSWORD, and ADMIN_EMAIL environment variables are not configured",
    );
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};
