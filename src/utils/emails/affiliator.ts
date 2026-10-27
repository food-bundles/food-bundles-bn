import { getEmailTransporter } from "./shared";

/**
 * Generate affiliator welcome email template
 */
const sendAffiliatorWelcomeTemplate = (
  name: string,
  restaurantName: string,
  email: string,
  password: string,
  loginUrl: string,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to FoodBundles - Your Affiliator Account</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .credentials-box { background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #374151; }
      .button { display: inline-block; background: #374151; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .warning { background-color: #f3f4f6;color: #374151;padding: 15px;border-radius: 8px;margin: 15px 0;font-weight: bold; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .credentials { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px; margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Hello <strong>${name}</strong>,</p>

        <p>Congratulations! You've been successfully added as an <strong>Affiliator</strong> for <span class="highlight">${restaurantName}</span> on the FoodBundles platform.</p>

        <div class="credentials-box">
          <h2>Your Account Credentials</h2>
          <p><strong>Email:</strong> <span class="credentials">${email}</span></p>
          <p><strong>Password:</strong> <span class="credentials">${password}</span></p>
          <p><strong>Restaurant:</strong> ${restaurantName}</p>
        </div>

        <div style="text-align: center;">
          <a href="${loginUrl}" class="button">Login to Your Account</a>
        </div>

         <div class="warning">
          <p><strong>If the button above doesn't work, you can copy and paste the following link into your browser:</strong></p>
          <p style="word-break: break-all; font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px;">${loginUrl}</p>
        </div>

        <p><strong>Important:</strong> Please keep your login credentials secure and change your password after your first login for enhanced security.</p>

        <p>If you have any questions or need assistance, our support team is here to help you succeed!</p>

        <p>Welcome aboard and let's grow together!</p>
      </div>
      <div class="footer">
        <p><strong>FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">Email: sales@food.rw | Phone: +250 796 897 823</p>
        <p style="font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send affiliator welcome email
export async function sendAffiliatorWelcomeEmail(
  email: string,
  name: string,
  restaurantName: string,
  password: string,
) {
  const transporter = getEmailTransporter();
  const loginUrl = `${process.env.CLIENT_PRODUCTION_URL}/login`;

  const affiliatorEmail = {
    from: `"FoodBundles Platform" <${process.env.GOOGLE_EMAIL}>`,
    to: email,
    subject: `Welcome to FoodBundles - Your ${restaurantName} Affiliator Account`,
    html: sendAffiliatorWelcomeTemplate(
      name,
      restaurantName,
      email,
      password,
      loginUrl,
    ),
  };

  try {
    await transporter.sendMail(affiliatorEmail);
    console.log("Affiliator welcome email sent successfully");
  } catch (error) {
    console.error("Failed to send affiliator welcome email:", error);
  }
}
