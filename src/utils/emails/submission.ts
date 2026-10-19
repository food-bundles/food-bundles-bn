import { getAdminEmailTransporter } from "./shared";

export interface AdminSubmissionCreatedData {
  farmerName: string;
  farmerPhone?: string;
  productName: string;
  submittedQty: number;
  wishedPrice: number;
}

/**
 * Generate admin submission-created email template
 */
const sendAdminSubmissionCreatedTemplate = (
  data: AdminSubmissionCreatedData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Farmer Submission - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .submission-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>

        <p>A farmer has submitted produce for review.</p>

        <div class="submission-info">
          <p><span class="highlight">Farmer:</span> ${data.farmerName}${data.farmerPhone ? ` (${data.farmerPhone})` : ""}</p>
          <p><span class="highlight">Product:</span> ${data.productName}</p>
          <p><span class="highlight">Quantity:</span> ${data.submittedQty}</p>
          <p><span class="highlight">Wished Price:</span> ${data.wishedPrice.toLocaleString()} RWF</p>
        </div>

        <p><strong>Action Required:</strong> Please review and verify this submission.</p>
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

// Send admin submission-created email
export async function sendAdminSubmissionCreatedEmail(
  data: AdminSubmissionCreatedData,
) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Farmer Submission - ${data.productName} from ${data.farmerName}`,
    html: sendAdminSubmissionCreatedTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin submission created email sent successfully");
  } catch (error) {
    console.error("Failed to send admin submission created email:", error);
  }
}

export interface AdminPayoutFailedData {
  farmerName: string;
  farmerPhone?: string;
  productName: string;
  amount: number;
  reason?: string;
}

/**
 * Generate admin payout-failed email template
 */
const sendAdminPayoutFailedTemplate = (
  data: AdminPayoutFailedData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Farmer Payout Failed - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .alert-box { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>

        <p>A farmer payout attempt has failed.</p>

        <div class="alert-box">
          <p><span class="highlight">Farmer:</span> ${data.farmerName}${data.farmerPhone ? ` (${data.farmerPhone})` : ""}</p>
          <p><span class="highlight">Product:</span> ${data.productName}</p>
          <p><span class="highlight">Amount:</span> <span class="amount">${data.amount.toLocaleString()} RWF</span></p>
          ${data.reason ? `<p><span class="highlight">Reason:</span> ${data.reason}</p>` : ""}
        </div>

        <p><strong>Action Required:</strong> Please review and retry this payout. The farmer has not been paid.</p>
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

// Send admin payout-failed email
export async function sendAdminPayoutFailedEmail(data: AdminPayoutFailedData) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Payout Failed - ${data.productName} for ${data.farmerName}`,
    html: sendAdminPayoutFailedTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin payout failed email sent successfully");
  } catch (error) {
    console.error("Failed to send admin payout failed email:", error);
  }
}
