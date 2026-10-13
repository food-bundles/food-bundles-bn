import { getAdminEmailTransporter, getEmailTransporter } from "./shared";

export interface AdminNotificationData {
  userType: string;
  userName: string;
  userEmail: string;
  restaurantName?: string;
  subscriptionPlan?: string;
  amount?: number;
  voucherAmount?: number;
  appliedBy?: string;
  approvedBy?: string;
}

export interface PriceUpdateData {
  products: {
    id: string;
    name: string;
    oldPrice?: number;
    newPrice: number;
    updatedAt: Date;
  }[];
  recipientName?: string;
}

// Admin notification templates
const sendAdminUserCreatedTemplate = (data: AdminNotificationData): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New User Account Created</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .user-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>
        <p>A new ${data.userType.toLowerCase()} account has been created on the FoodBundles platform.</p>
        <div class="user-details">
          <h2>User Details</h2>
          <p><span class="highlight">User Type:</span> ${data.userType}</p>
          <p><span class="highlight">Name/Phone:</span> ${data.userName}</p>
          ${
            data.userEmail &&
            data.userEmail !== "" &&
            `<p>
                <span class="highlight">Email:</span> ${data.userEmail}
              </p>`
          }
          ${
            data.restaurantName
              ? `<p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>`
              : ""
          }
        </div>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

const sendAdminSubscriptionPaidTemplate = (
  data: AdminNotificationData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subscription Payment Successful</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .payment-details { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>
        <p>A subscription payment has been successfully processed.</p>
        <div class="payment-details">
          <h2>Payment Details</h2>
          <p><span class="highlight">Restaurant:</span> ${
            data.restaurantName
          }</p>
          <p><span class="highlight">Plan:</span> ${data.subscriptionPlan}</p>
          <p><span class="highlight">Amount:</span> <span class="amount">${data.amount?.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Customer:</span> ${data.userName} (${
            data.userEmail
          })</p>
        </div>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

const sendAdminVoucherAppliedTemplate = (
  data: AdminNotificationData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voucher Applied</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .voucher-details { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>
        <p>A voucher has been applied on the FoodBundles platform.</p>
        <div class="voucher-details">
          <h2>Voucher Details</h2>
          <p><span class="highlight">Restaurant:</span> ${
            data.restaurantName
          }</p>
          <p><span class="highlight">Voucher Amount:</span> <span class="amount">${data.voucherAmount?.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Applied By:</span> ${data.appliedBy}</p>
          <p><span class="highlight">Customer:</span> ${data.userName} (${
            data.userEmail
          })</p>
        </div>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

const sendAdminVoucherApprovedTemplate = (
  data: AdminNotificationData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voucher Approved</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .approval-details { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>
        <p>A voucher has been approved and issued on the FoodBundles platform.</p>
        <div class="approval-details">
          <h2>Approval Details</h2>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Voucher Amount:</span> <span class="amount">${data.voucherAmount?.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Approved By:</span> ${data.approvedBy}</p>
          <p><span class="highlight">Customer:</span> ${data.userName} (${data.userEmail})</p>
        </div>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

// Admin notification functions
export async function sendAdminUserCreatedEmail(data: AdminNotificationData) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New ${data.userType} Account Created - ${data.userName}`,
    html: sendAdminUserCreatedTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin user created notification sent successfully");
  } catch (error) {
    console.error("Failed to send admin user created notification:", error);
  }
}

export async function sendAdminSubscriptionPaidEmail(
  data: AdminNotificationData,
) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Subscription Payment Successful - ${data.restaurantName} (${data.subscriptionPlan})`,
    html: sendAdminSubscriptionPaidTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin subscription paid notification sent successfully");
  } catch (error) {
    console.error(
      "Failed to send admin subscription paid notification:",
      error,
    );
  }
}

export async function sendAdminVoucherAppliedEmail(
  data: AdminNotificationData,
) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Voucher Applied - ${
      data.restaurantName
    } (${data.voucherAmount?.toLocaleString()} RWF)`,
    html: sendAdminVoucherAppliedTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin voucher applied notification sent successfully");
  } catch (error) {
    console.error("Failed to send admin voucher applied notification:", error);
  }
}

export async function sendAdminVoucherApprovedEmail(
  data: AdminNotificationData,
) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Voucher Approved - ${data.restaurantName} (${data.voucherAmount?.toLocaleString()} RWF)`,
    html: sendAdminVoucherApprovedTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin voucher approved notification sent successfully");
  } catch (error) {
    console.error("Failed to send admin voucher approved notification:", error);
  }
}

/**
 * Generate price update email template
 */
const sendPriceUpdateTemplate = (data: PriceUpdateData): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Product Prices Updated - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .update-box { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d1d5db; }
      .products-list { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .price { font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.recipientName || "Valued Customer"},</p>

        <p>We want to inform you that some product prices have been updated on the FoodBundles platform.</p>

        <div class="update-box">
          <h2>Price Update Notice</h2>
          <p>The following products have had their prices updated recently. Please review the changes for your next orders.</p>
        </div>

        <div class="products-list">
          <h3>Recently Updated Products:</h3>
          ${data.products
            .map(
              (product) => `
            <div class="product-item">
              <strong>${product.name}</strong><br>
              <span class="highlight">New Price:</span> <span class="price">${product.newPrice.toLocaleString()} RWF</span><br>
              <small>Updated: ${new Date(product.updatedAt).toLocaleDateString()}</small>
            </div>
          `,
            )
            .join("")}
        </div>

        <p>These price updates reflect current market conditions and ensure we continue to provide you with quality products.</p>

        <p>Thank you for your continued partnership with FoodBundles!</p>
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

// Send price update email
export async function sendPriceUpdateEmail(
  email: string,
  data: PriceUpdateData,
) {
  const transporter = getEmailTransporter();

  const priceUpdateEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: email,
    subject: "Product Prices Updated - FoodBundles",
    html: sendPriceUpdateTemplate(data),
  };

  try {
    await transporter.sendMail(priceUpdateEmail);
    console.log("Price update email sent successfully");
  } catch (error) {
    console.error("Failed to send price update email:", error);
  }
}
