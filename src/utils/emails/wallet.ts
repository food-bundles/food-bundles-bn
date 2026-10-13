import { getEmailTransporter, getAdminEmailTransporter } from "./shared";

export interface WalletNotificationData {
  email: string;
  restaurantName: string;
  type: "TOP_UP" | "PAYMENT" | "REFUND" | "ADJUSTMENT" | "WITHDRAWAL";
  amount: number;
  newBalance: number;
  transactionId: string;
  paymentMethod?: string;
  description?: string;
}

/**
 * Generate wallet notification email template
 */
export const sendWalletNotificationTemplate = (
  data: WalletNotificationData,
): string => {
  const transactionTypeMap = {
    TOP_UP: { text: "Top-up" },
    PAYMENT: { text: "Payment" },
    REFUND: { text: "Refund" },
    ADJUSTMENT: { text: "Adjustment" },
    WITHDRAWAL: { text: "Withdrawal" },
  };

  const typeInfo = transactionTypeMap[data.type] || transactionTypeMap.TOP_UP;

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wallet Notification - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .transaction-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        <p>Your wallet has been ${data.type
          .toLowerCase()
          .replace("_", " ")}ed successfully.</p>

        <div class="transaction-details">
          <h2>Transaction Details</h2>
          <p><span class="highlight">Type:</span> ${typeInfo.text}</p>
          <p><span class="highlight">Amount:</span> <span class="amount">${data.amount.toLocaleString()} RWF</span></p>
          <p><span class="highlight">New Balance:</span> <strong>${data.newBalance.toLocaleString()} RWF</strong></p>
          ${
            data.paymentMethod
              ? `<p><span class="highlight">Payment Method:</span> ${data.paymentMethod}</p>`
              : ""
          }
          ${
            data.description
              ? `<p><span class="highlight">Description:</span> ${data.description}</p>`
              : ""
          }
        </div>

        <p>If you did not initiate this transaction, please contact our support team immediately.</p>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send wallet notification email
export async function sendWalletNotificationEmail(
  data: WalletNotificationData,
) {
  const transporter = getEmailTransporter();

  const walletEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,

    to: data.email,
    subject: `Wallet ${data.type} - FoodBundles`,
    html: sendWalletNotificationTemplate(data),
  };

  try {
    await transporter.sendMail(walletEmail);
    console.log("Wallet notification email sent successfully");
  } catch (error) {
    console.error("Failed to send wallet notification email:", error);
  }
}

/**
 * Generate admin wallet OTP email template
 */
const sendAdminWalletOTPTemplate = (data: {
  adminId: string;
  operationType: "DEPOSIT" | "ADJUSTMENT";
  amount: number;
  restaurantName?: string;
  otp: string;
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Wallet Operation OTP</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .otp-box { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; text-align: center; }
      .otp-code { font-size: 26px; font-weight: bold; color: #374151; letter-spacing: 4px; margin: 10px 0; }
      .operation-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
      .warning { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d1d5db; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Admin Wallet Operation</h1>
        <p>OTP Verification Required</p>
      </div>
      <div class="content">
        <p>Dear Admin,</p>

        <p>An admin wallet ${data.operationType.toLowerCase()} operation requires OTP verification.</p>

        <div class="operation-details">
          <h2>Operation Details</h2>
          <p><span class="highlight">Operation Type:</span> ${data.operationType}</p>
          <p><span class="highlight">Amount:</span> <span class="amount">${data.amount.toLocaleString()} RWF</span></p>
          ${data.restaurantName ? `<p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>` : ""}
          <p><span class="highlight">Timestamp:</span> ${new Date().toLocaleString()}</p>
        </div>

        <div class="otp-box">
          <h3>Your OTP Code</h3>
          <div class="otp-code">${data.otp}</div>
          <p><strong>Valid for 10 minutes</strong></p>
        </div>

        <div class="warning">
          <p><strong>Security Notice:</strong></p>
          <p>This OTP is required to authorize the wallet operation. Do not share this code with anyone. If you did not initiate this operation, please contact the system administrator immediately.</p>
        </div>

        <p><strong>Action Required:</strong> Enter this OTP in the admin panel to complete the wallet operation.</p>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated security message. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send admin wallet OTP email
export async function sendAdminWalletOTPEmail(data: {
  adminId: string;
  operationType: "DEPOSIT" | "ADJUSTMENT";
  amount: number;
  restaurantName?: string;
  otp: string;
}) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"Food Bundles Security" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Admin Wallet ${data.operationType} OTP - ${data.amount.toLocaleString()} RWF`,
    html: sendAdminWalletOTPTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin wallet OTP email sent successfully");
  } catch (error) {
    console.error("Failed to send admin wallet OTP email:", error);
  }
}
