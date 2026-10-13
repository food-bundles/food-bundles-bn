import { getEmailTransporter } from "./shared";

export interface SubscriptionExpiryData {
  email: string;
  restaurantName: string;
  planName: string;
  endDate: Date;
  isWarning?: boolean;
}

export interface SubscriptionActivatedData {
  email: string;
  restaurantName: string;
  planName: string;
  amountPaid: number;
  endDate?: Date;
}

/**
 * Generate subscription expiry email template
 */
const sendSubscriptionExpiryTemplate = (
  data: SubscriptionExpiryData,
): string => {
  const isWarning = data.isWarning || false;
  const daysRemaining = isWarning
    ? Math.ceil(
        (new Date(data.endDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${
      isWarning ? "Subscription Expiring Soon" : "Subscription Expired"
    } - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .alert-box { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d1d5db; }
      .subscription-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .button { display: inline-block; background: #374151; color: #ffffff !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        ${
          isWarning
            ? `<p>Your <strong>${
                data.planName
              }</strong> subscription will expire in <strong>${daysRemaining} day${
                daysRemaining !== 1 ? "s" : ""
              }</strong>.</p>`
            : `<p>Your <strong>${
                data.planName
              }</strong> subscription has expired on <strong>${new Date(
                data.endDate,
              ).toLocaleDateString()}</strong>.</p>`
        }

        <div class="alert-box">
          <h2>${isWarning ? "Action Required" : "Access Restricted"}</h2>
          ${
            isWarning
              ? `<p>To avoid service interruption, please renew your subscription before <strong>${new Date(
                  data.endDate,
                ).toLocaleDateString()}</strong>.</p>`
              : `<p>Your access to premium features has been suspended. Renew your subscription to restore full access.</p>`
          }
        </div>

        <div style="text-align: center;">
          <a href="${
            process.env.CLIENT_PRODUCTION_URL
          }/restaurant/subscribe" class="button">
            ${isWarning ? "Renew Subscription" : "Reactivate Subscription"}
          </a>
        </div>

        <p>Need help choosing the right plan? Our team is here to assist you!</p>
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

// Send subscription expiry email
export async function sendSubscriptionExpiryEmail(
  data: SubscriptionExpiryData,
) {
  const transporter = getEmailTransporter();
  const isWarning = data.isWarning || false;

  const expiryEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `${
      isWarning ? "Subscription Expiring Soon" : "Subscription Expired"
    } - ${data.planName}`,
    html: sendSubscriptionExpiryTemplate(data),
  };

  try {
    await transporter.sendMail(expiryEmail);
    console.log(
      `Subscription ${isWarning ? "warning" : "expiry"} email sent successfully`,
    );
  } catch (error) {
    console.error(
      `Failed to send subscription ${isWarning ? "warning" : "expiry"} email:`,
      error,
    );
  }
}

/**
 * Generate subscription activated email template
 */
const sendSubscriptionActivatedTemplate = (
  data: SubscriptionActivatedData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subscription Activated - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .success-badge { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: bold; font-size: 18px; border: 2px solid #374151; }
      .subscription-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        <div class="success-badge">
          Your ${data.planName} subscription is now active!
        </div>

        <div class="subscription-details">
          <h2>Subscription Details</h2>
          <p><span class="highlight">Plan:</span> ${data.planName}</p>
          <p><span class="highlight">Amount Paid:</span> <span class="amount">${data.amountPaid.toLocaleString()} RWF</span></p>
          ${
            data.endDate
              ? `<p><span class="highlight">Valid Until:</span> ${new Date(
                  data.endDate,
                ).toLocaleDateString()}</p>`
              : ""
          }
        </div>

        <p>You now have full access to the features included in your plan. Thank you for choosing FoodBundles!</p>
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

// Send subscription activated email
export async function sendSubscriptionActivatedEmail(
  data: SubscriptionActivatedData,
) {
  const transporter = getEmailTransporter();

  const activatedEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `Subscription Activated - ${data.planName}`,
    html: sendSubscriptionActivatedTemplate(data),
  };

  try {
    await transporter.sendMail(activatedEmail);
    console.log("Subscription activated email sent successfully");
  } catch (error) {
    console.error("Failed to send subscription activated email:", error);
  }
}
