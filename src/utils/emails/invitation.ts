import { getEmailTransporter } from "./shared";

/**
 * Generate invitation email template
 */
const sendInvitationEmailTemplate = (
  firstName: string,
  inviteUrl: string,
  userType?: string,
): string => {
  const getRoleInfo = (role?: string) => {
    switch (role) {
      case "TRADER":
        return {
          greeting: "Dear Trader",
          description:
            "As a Trader, you will be able to work with vouchers, approve loans, receive commissions upon voucher usage, and manage loan applications. You'll play a key role in facilitating financial services for our restaurant partners.",
        };
      case "AGGREGATOR":
        return {
          greeting: "Dear Aggregator",
          description:
            "As an Aggregator, you will work on farmer submissions, review and approve products, and help connect farmers with our restaurant network. You'll be essential in maintaining our supply chain quality.",
        };
      case "LOGISTICS":
        return {
          greeting: "Dear Logistics Partner",
          description:
            "As part of our Logistics team, you will manage orders, coordinate deliveries, and ensure timely distribution of products to our restaurant partners. You'll be crucial in our delivery operations.",
        };
      case "RESTAURANT":
        return {
          greeting: "Dear Restaurant Partner",
          description:
            "As a Restaurant partner, you will be able to place orders, manage your wallet, access loans and vouchers, and streamline your procurement process through our platform.",
        };

      case "ADMIN":
        return {
          greeting: "Dear Admin",
          description:
            "As an Admin, you will have access to our admin dashboard where you can manage users, products, and other key aspects of our platform.",
        };

      default:
        return {
          greeting: `Dear ${firstName}`,
          description:
            "You will have access to our comprehensive platform where you can collaborate with your team, manage projects, and utilize various features tailored to your role.",
        };
    }
  };

  const roleInfo = getRoleInfo(userType);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You've Been Invited!</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .invitation-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .button { display: inline-block; background: #374151; color: #ffffff !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .warning { background-color: #f3f4f6; color: #374151; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>${roleInfo.greeting},</p>

        <p>You've been invited to join <strong>FoodBundles Platform</strong>. We're excited to have you on board!</p>

        <p>This invitation will expire in <span class="highlight">24 hours</span>.</p>

        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </div>

        <div class="warning">
          <p><strong>If the button above doesn't work, you can copy and paste the following link into your browser:</strong></p>
          <p style="word-break: break-all; font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px;">${inviteUrl}</p>
        </div>

        <p>If you didn't expect this invitation or have any questions, please contact our support team.</p>

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

// Send invitation email
export async function sendInvitationEmail(
  email: string,
  firstName: string,
  inviteUrl: string,
  userType: string,
): Promise<{ success: boolean; error?: string }> {
  const transporter = getEmailTransporter();

  const invitationEmail = {
    from: `"FoodBundles Platform" <${process.env.GOOGLE_EMAIL}>`,
    to: email,
    subject: "You've Been Invited to Join FoodBundles Platform!",
    html: sendInvitationEmailTemplate(firstName, inviteUrl, userType),
  };

  try {
    await transporter.sendMail(invitationEmail);
    console.log("Invitation email sent successfully");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error);
    return { success: false, error: error.message || "Failed to send invitation email" };
  }
}
