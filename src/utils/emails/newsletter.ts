import { getEmailTransporter } from "./shared";

/**
 * Generate newsletter welcome email template
 */
const sendNewsletterWelcomeTemplate = (data: { name: string }): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to FoodBundles Newsletter</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .benefits-box { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      ul { margin: 10px 0; padding-left: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to FoodBundles Newsletter!</h1>
      </div>
      <div class="content">
        <p>Dear ${data.name},</p>

        <p>Thank you for subscribing to the <strong>FoodBundles Newsletter</strong>! We're excited to keep you informed about the latest updates from our platform.</p>

        <div class="benefits-box">
          <h2>What You'll Receive:</h2>
          <ul>
            <li><strong>Weekly Price Updates:</strong> Stay informed with stable, competitive prices updated every week</li>
            <li><strong>New Product Announcements:</strong> Be the first to know about fresh arrivals and new products</li>
            <li><strong>Market Trends:</strong> Get insights on agricultural market trends and pricing</li>
            <li><strong>Special Offers:</strong> Exclusive deals and promotions for our subscribers</li>
            <li><strong>Platform Updates:</strong> Learn about new features and improvements</li>
          </ul>
        </div>

        <p>Our newsletter is designed to help you make informed decisions and get the best value from FoodBundles.</p>


        <p>Welcome aboard!</p>
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

/**
 * Generate newsletter campaign email template
 */
const sendNewsletterCampaignTemplate = (data: {
  name: string;
  subject: string;
  content: string;
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${data.subject}</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>FoodBundles Newsletter</h1>
      </div>
      <div class="content">
        <p>Dear ${data.name},</p>

        ${data.content}

        <p>Thank you for being a valued subscriber!</p>
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

// Send newsletter welcome email
export async function sendNewsletterWelcomeEmail(data: {
  email: string;
  name: string;
}) {
  const transporter = getEmailTransporter();

  const welcomeEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: "Welcome to FoodBundles Newsletter!",
    html: sendNewsletterWelcomeTemplate(data),
  };

  try {
    await transporter.sendMail(welcomeEmail);
    console.log("Newsletter welcome email sent successfully");
  } catch (error) {
    console.error("Failed to send newsletter welcome email:", error);
  }
}

// Send newsletter campaign email
export async function sendNewsletterCampaignEmail(data: {
  email: string;
  name: string;
  subject: string;
  content: string;
}) {
  const transporter = getEmailTransporter();

  const campaignEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: data.subject,
    html: sendNewsletterCampaignTemplate(data),
  };

  try {
    await transporter.sendMail(campaignEmail);
    console.log(`Newsletter campaign email sent to ${data.email}`);
  } catch (error) {
    console.error(
      `Failed to send newsletter campaign email to ${data.email}:`,
      error,
    );
  }
}
