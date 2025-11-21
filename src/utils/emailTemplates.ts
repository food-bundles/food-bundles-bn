import nodemailer from "nodemailer";
import prisma from "../prisma";

export interface PaymentNotificationData {
  amount: number;
  phoneNumber: string;
  restaurantName: string;
  products: {
    name: string;
    quantity: number;
    price: number;
    unitPrice: number;
  }[];
  customer: {
    name: string;
    email: string;
  };
  paymentMethod: string;
  orderId: string;
  walletDetails?: {
    previousBalance: number;
    newBalance: number;
    transactionId: string;
  };
}

export interface PaymentConfirmationData {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  deliveryDate?: Date;
}

export interface OrderStatusData {
  orderNumber: string;
  status: string;
  restaurantName: string;
  customer: {
    name: string;
    email: string;
  };
  estimatedDelivery?: Date;
  trackingInfo?: string;
}

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
 * Generate payment notification email template
 */
export const sendPaymentNotificationTemplate = (
  data: PaymentNotificationData
): string => {
  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 8);

  const walletDetailsHtml = data.walletDetails
    ? `
    <p>Wallet Details:</p>
    <ul>
      <li>Previous Balance: ${data.walletDetails.previousBalance}</li>
      <li>New Balance: ${data.walletDetails.newBalance}</li>
      <li>Transaction ID: ${data.walletDetails.transactionId}</li>
    </ul>
  `
    : "";

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FoodBundles Payment Request</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f8f9fa;
      }
      .container {
        margin: 0 auto;
        max-width: 600px;
        background-color: #ffffff;
        padding: 0;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .content {
        padding: 30px;
      }
      .payment-details {
        background-color: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #22c55e;
      }
      .products-list {
        background-color: #f0fdf4;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
      }
      .warning {
        background-color: #fee2e2;
        color: #991b1b;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        font-weight: bold;
      }
      .footer {
        text-align: center;
        padding: 20px;
        color: #64748b;
        background-color: #f8fafc;
      }
      h1 {
        margin: 0;
        font-size: 28px;
      }
      h2 {
        color: #334155;
        margin-top: 0;
        font-size: 20px;
      }
      p {
        margin: 8px 0;
        color: #475569;
      }
      .highlight {
        color: #22c55e;
        font-weight: bold;
      }
      .amount {
        font-size: 24px;
        font-weight: bold;
        color: #22c55e;
      }
      .product-item {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
        padding: 8px 0;
        border-bottom: 1px solid #e2e8f0;
        gap: 10px;
      }
      .button {
        display: inline-block;
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: white;
        padding: 12px 24px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: bold;
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.customer.name},</p>
        
        <p>We have received your order from <strong>Food Bundles Ltd</strong> and are processing your payment request.</p>
        
        <div class="products-list">
          <h2>🛒 Your Order</h2>
          ${data.products
            .map(
              (product) => `
            <div class="product-item">
              <div>
                <strong>${product.name}</strong><br>
                <small>Quantity: ${product.quantity}</small>
              </div>
              <div>Price: <strong>${product.unitPrice.toLocaleString()} RWF</strong></div>
            </div>`
            )
            .join("")}
          <div class="product-item" style="border-top: 2px solid #22c55e; margin-top: 10px; padding-top: 10px;">
            <div><strong>Total Amount</strong></div>
            <div class="amount">${data.amount.toLocaleString()} RWF</div>
          </div>
        </div>

        <div class="payment-details">
          <h2>💳 Payment Information</h2>
          <p><span class="highlight">Order ID:</span> ${data.orderId}</p>
          <p><span class="highlight">Phone Number:</span> ${
            data.phoneNumber
          }</p>
          <p><span class="highlight">Payment Method:</span> ${
            data.paymentMethod
          }</p>
        </div>

        <div class="warning">
          <p>⚠️ Important: Complete your payment within 8 hours</p>
          <p><strong>Expires:</strong> ${expirationTime.toLocaleString(
            "en-RW",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          )}</p>
        </div>

        <!-- ... -->
          ${walletDetailsHtml}
        <!-- ... -->

        <div class="payment-details">
          <h2>📱 Next Steps</h2>
          <ol>
            <li>Check your phone for the payment prompt</li>
            <li>Enter your mobile money PIN to authorize</li>
            <li>Your order will be confirmed automatically</li>
            <li>You'll receive a confirmation email with delivery details</li>
          </ol>
        </div>



        <p>Need help? Contact our customer support team at any time.</p>
      </div>
      <div class="footer">
        <p>Thank you for choosing FoodBundles!</p>
        <p>🌱 <strong>Connecting farmers to markets, sustainably</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate payment confirmation email template
 */
export const sendPaymentConfirmationTemplate = (
  data: PaymentConfirmationData
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Confirmed - FoodBundles</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f8f9fa;
      }
      .container {
        margin: 0 auto;
        max-width: 600px;
        background-color: #ffffff;
        padding: 0;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .content {
        padding: 30px;
      }
      .success-badge {
        background: linear-gradient(135deg, #dcfce7, #bbf7d0);
        color: #16a34a;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 20px 0;
        font-weight: bold;
        font-size: 18px;
        border: 2px solid #22c55e;
      }
      .order-details {
        background-color: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #22c55e;
      }
      .product-item {
        display: flex;
        justify-content: space-between;
        margin: 8px 0;
        padding: 8px 0;
        border-bottom: 1px solid #e2e8f0;
      }
      .footer {
        text-align: center;
        padding: 20px;
        color: #64748b;
        background-color: #f8fafc;
      }
      .highlight {
        color: #22c55e;
        font-weight: bold;
      }
      .tracking-info {
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border-left: 4px solid #3b82f6;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        
        <p>Dear ${data.customer.name},</p>
        
        <p>Thank you for your payment! Your order from <strong>Food Bundles Ltd</strong> has been successfully processed and confirmed.</p>
        
        <div class="order-details">
          <h2>📋 Order Summary</h2>
          <p><span class="highlight">Amount Paid:</span> <strong>${data.amount.toLocaleString()} RWF</strong></p>
          ${
            data.deliveryDate
              ? `<p><span class="highlight">Delivery Date:</span> ${data.deliveryDate.toLocaleDateString(
                  "en-RW",
                  {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}</p>`
              : ""
          }
          
          <h3 style="margin-top: 20px;">🛒 Items Ordered:</h3>
          ${data.products
            .map(
              (product) => `
            <div class="product-item">
              <div>
                <strong>${product.name}</strong><br>
                <small>Quantity: ${product.quantity}</small>
              </div>
              <div><strong>${product.price.toLocaleString()} RWF</strong></div>
            </div>`
            )
            .join("")}
        </div>

        <div class="tracking-info">
          <h2>📦 What's Next?</h2>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Your order is now being prepared</li>
            <li>You'll receive updates on the preparation status</li>
            <li>Delivery will be arranged according to your specified date</li>
            <li>You'll get a notification when your order is out for delivery</li>
          </ul>
        </div>

        <div class="order-details">
          <h2>📞 Need Support?</h2>
          <p>If you have any questions about your order, please contact us:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Email: sales@food.rw</li>
            <li>Phone: +250 796 897 823</li>
          </ul>
        </div>

        <p style="text-align: center; font-size: 16px; color: #16a34a; font-weight: bold;">
          Thank you for working with us! 🇷🇼
        </p>
      </div>
      <div class="footer">
        <p>Best regards,</p>
        <p>🌱 <strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate payment failed email template
 */
export const sendPaymentFailedTemplate = (data: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  failureReason?: string;
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Failed - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .failure-badge { background: #fee2e2; color: #b91c1c; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; font-weight: bold; font-size: 18px; border: 2px solid #f87171; }
      .order-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444; }
      .product-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #b91c1c; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">

        <p>Dear ${data.customer.name},</p>
        <p>We attempted to process your payment for your order from <strong>Food Bundles Ltd</strong>, but it was not successful.</p>

        <div class="order-details">
          <h2>📋 Payment Details</h2>
          <p><span class="highlight">Amount:</span> ${data.amount.toLocaleString()} RWF</p>
          ${
            data.failureReason
              ? `<p><span class="highlight">Reason:</span> ${data.failureReason}</p>`
              : ""
          }

          <h3 style="margin-top: 20px;">🛒 Items Ordered:</h3>
          ${data.products
            .map(
              (product) => `
              <div class="product-item">
                <div>
                  <strong>${product.name}</strong><br>
                  <small>Quantity: ${product.quantity}</small>
                </div>
                <div><strong>${product.price.toLocaleString()} RWF</strong></div>
              </div>`
            )
            .join("")}
        </div>

        <p>You can try again by re-initiating the payment in your FoodBundles account or choosing a different payment method.</p>

        <div class="order-details">
          <h2>📞 Need Help?</h2>
          <ul>
            <li>Email: sales@food.rw</li>
            <li>Phone: +250 796 897 823</li>
          </ul>
        </div>

        <p style="text-align:center; font-size:16px; color:#b91c1c; font-weight:bold;">
          Don’t worry — your order is still saved and can be completed once the payment succeeds.
        </p>
      </div>
      <div class="footer">🌱 The FoodBundles Team</div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate order status update email template
 */
export const generateOrderStatusTemplate = (data: OrderStatusData): string => {
  const statusColors: Record<
    string,
    { bg: string; text: string; emoji: string }
  > = {
    PENDING: { bg: "#fef3c7", text: "#92400e", emoji: "⏳" },
    CONFIRMED: { bg: "#d1fae5", text: "#065f46", emoji: "✅" },
    PREPARING: { bg: "#dbeafe", text: "#1e40af", emoji: "👨‍🍳" },
    READY: { bg: "#e0e7ff", text: "#3730a3", emoji: "📦" },
    OUT_FOR_DELIVERY: { bg: "#fed7d7", text: "#9b2c2c", emoji: "🚚" },
    DELIVERED: { bg: "#c6f6d5", text: "#2f855a", emoji: "🎉" },
    CANCELLED: { bg: "#fed7d7", text: "#c53030", emoji: "❌" },
  };

  const statusInfo = statusColors[data.status] || statusColors.PENDING;

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Order Update - FoodBundles</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f8f9fa;
      }
      .container {
        margin: 0 auto;
        max-width: 600px;
        background-color: #ffffff;
        padding: 0;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .content {
        padding: 30px;
      }
      .status-badge {
        background-color: ${statusInfo.bg};
        color: ${statusInfo.text};
        padding: 15px;
        border-radius: 8px;
        text-align: center;
        margin: 20px 0;
        font-weight: bold;
        font-size: 18px;
      }
      .order-info {
        background-color: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #22c55e;
      }
      .footer {
        text-align: center;
        padding: 20px;
        color: #64748b;
        background-color: #f8fafc;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>📦 Order Update</h1>
      </div>
      <div class="content">
        <div class="status-badge">
          ${statusInfo.emoji} Your order is ${data.status
    .toLowerCase()
    .replace("_", " ")}
        </div>
        
        <p>Dear ${data.customer.name},</p>
        
        <p>Your order from <strong>Food Bundles Ltd</strong> has been updated.</p>
        
        <div class="order-info">
          <p><strong>Order Number:</strong> ${data.orderNumber}</p>
          <p><strong>Status:</strong> ${data.status.replace("_", " ")}</p>
          ${
            data.estimatedDelivery
              ? `<p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery.toLocaleDateString()}</p>`
              : ""
          }
          ${
            data.trackingInfo
              ? `<p><strong>Tracking Info:</strong> ${data.trackingInfo}</p>`
              : ""
          }
        </div>

        <p>Thank you for your patience!</p>
      </div>
      <div class="footer">
        <p>🌱 The FoodBundles Team</p>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate wallet notification email template
 */

export const sendWalletNotificationTemplate = (
  data: WalletNotificationData
): string => {
  const transactionTypeMap = {
    TOP_UP: { emoji: "💰", text: "Top-up" },
    PAYMENT: { emoji: "💳", text: "Payment" },
    REFUND: { emoji: "↩️", text: "Refund" },
    ADJUSTMENT: { emoji: "⚖️", text: "Adjustment" },
    WITHDRAWAL: { emoji: "💸", text: "Withdrawal" },
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
      .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .transaction-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #22c55e; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${typeInfo.emoji} Wallet ${typeInfo.text}</h1>
      </div>
      <div class="content">
        <p>Dear ${data.restaurantName},</p>
        
        <p>Your wallet has been ${data.type
          .toLowerCase()
          .replace("_", " ")}ed successfully.</p>
        
        <div class="transaction-details">
          <h2>📊 Transaction Details</h2>
          <p><span class="highlight">Transaction ID:</span> ${
            data.transactionId
          }</p>
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
        <p>Thank you for using FoodBundles Wallet!</p>
        <p>🌱 <strong>Secure and convenient payment solutions</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send payment notification email
export async function sendPaymentNotificationEmail(paymentData: {
  amount: number;
  phoneNumber: string;
  restaurantName: string;
  products: {
    name: string;
    quantity: number;
    price: number;
    unitPrice: number;
  }[];
  customer: {
    name: string;
    email: string;
  };
  paymentMethod: string;
  orderId: string;
  walletDetails?: {
    previousBalance: number;
    newBalance: number;
    transactionId: string;
  };
}) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

  const expirationTime = new Date();
  expirationTime.setHours(expirationTime.getHours() + 8);

  const paymentEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,

    to: paymentData.customer.email,
    subject: `FoodBundles Payment Request - ${paymentData.restaurantName}`,
    html: `${sendPaymentNotificationTemplate(paymentData)}`,
  };

  try {
    await transporter.sendMail(paymentEmail);
    console.log("Payment notification email sent successfully");
  } catch (error) {
    console.error("Failed to send payment notification email:", error);
  }
}

// Send payment confirmation email
export async function sendPaymentConfirmationEmail(paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
}) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

  const confirmationEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,
    to: paymentData.customer.email,
    subject: `Payment Confirmed - FoodBundles Order #${paymentData.orderNumber}`,
    html: `${sendPaymentConfirmationTemplate(paymentData)}`,
  };

  try {
    await transporter.sendMail(confirmationEmail);
    console.log("Payment confirmation email sent successfully");
  } catch (error) {
    console.error("Failed to send payment confirmation email:", error);
  }
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
  failureReason?: string;
}) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  };

  const transporter = nodemailer.createTransport(config);

  const failedEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,

    to: paymentData.customer.email,
    subject: `Payment Failed - FoodBundles Order #${paymentData.orderNumber}`,
    html: sendPaymentFailedTemplate(paymentData),
  };

  try {
    await transporter.sendMail(failedEmail);
    console.log("Payment failed email sent successfully");
  } catch (error) {
    console.error("Failed to send payment failed email:", error);
  }
}

// Send wallet notification email
export async function sendWalletNotificationEmail(
  data: WalletNotificationData
) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

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
 * Generate admin order confirmation email template
 */
const sendAdminOrderConfirmationTemplate = (paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
}): string => {
  const totalItems = paymentData.products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Order Confirmed - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .order-summary { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
      .product-list { margin: 15px 0; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #3b82f6; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #22c55e; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 New Order Confirmed!</h1>
      </div>
      <div class="content">
        <p>Dear Admin,</p>
        
        <p>A new order has been confirmed and payment has been completed successfully.</p>
        
        <div class="order-summary">
          <h2>📋 Order Details</h2>
          <p><span class="highlight">Order Number:</span> #${
            paymentData.orderNumber
          }</p>
          <p><span class="highlight">Order ID:</span> ${paymentData.orderId}</p>
          <p><span class="highlight">Restaurant:</span> ${
            paymentData.restaurantName
          }</p>
          <p><span class="highlight">Customer:</span> ${
            paymentData.customer.name
          } (${paymentData.customer.email})</p>
          <p><span class="highlight">Total Amount:</span> <span class="amount">${paymentData.amount.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Transaction ID:</span> ${
            paymentData.transactionId
          }</p>
          <p><span class="highlight">Total Items:</span> ${totalItems}</p>
        </div>

        <div class="product-list">
          <h3>🛒 Order Items:</h3>
          ${paymentData.products
            .map(
              (product) => `
            <div class="product-item">
              <strong>${product.name}</strong><br>
              Quantity: ${
                product.quantity
              } × ${product.price.toLocaleString()} RWF = <strong>${(
                product.quantity * product.price
              ).toLocaleString()} RWF</strong>
            </div>
          `
            )
            .join("")}
        </div>

        <p><strong>Action Required:</strong> Please process this order for fulfillment and delivery coordination.</p>
      </div>
      <div class="footer">
        <p>🌱 FoodBundles Admin System</p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send admin order confirmation email
export async function sendAdminOrderConfirmationEmail(paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
}) {
  if (
    !process.env.GOOGLE_EMAIL ||
    !process.env.GOOGLE_PASSWORD ||
    !process.env.ADMIN_EMAIL
  ) {
    console.log("Email credentials or admin email not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

  const adminEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🎉 New Order Confirmed - #${paymentData.orderNumber} from ${paymentData.restaurantName}`,
    html: sendAdminOrderConfirmationTemplate(paymentData),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin order confirmation email sent successfully");
  } catch (error) {
    console.error("Failed to send admin order confirmation email:", error);
  }
}

/**
 * Generate logistics order notification email template
 */
const sendLogisticsOrderNotificationTemplate = (paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
}): string => {
  const totalItems = paymentData.products.reduce(
    (sum, product) => sum + product.quantity,
    0
  );

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Order Ready for Delivery</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .order-summary { background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
      .product-list { margin: 15px 0; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #f59e0b; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #22c55e; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🚚 New Order Ready for Delivery!</h1>
      </div>
      <div class="content">
        <p>Dear Logistics Team,</p>
        
        <p>A new order has been confirmed and is ready for delivery coordination.</p>
        
        <div class="order-summary">
          <h2>📦 Delivery Details</h2>
          <p><span class="highlight">Order Number:</span> #${
            paymentData.orderNumber
          }</p>
          <p><span class="highlight">Order ID:</span> ${paymentData.orderId}</p>
          <p><span class="highlight">Restaurant:</span> ${
            paymentData.restaurantName
          }</p>
          <p><span class="highlight">Customer:</span> ${
            paymentData.customer.name
          } (${paymentData.customer.email})</p>
          <p><span class="highlight">Total Amount:</span> <span class="amount">${paymentData.amount.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Transaction ID:</span> ${
            paymentData.transactionId
          }</p>
          <p><span class="highlight">Total Items:</span> ${totalItems}</p>
        </div>

        <div class="product-list">
          <h3>📋 Items to Deliver:</h3>
          ${paymentData.products
            .map(
              (product) => `
            <div class="product-item">
              <strong>${product.name}</strong><br>
              Quantity: ${
                product.quantity
              } × ${product.price.toLocaleString()} RWF = <strong>${(
                product.quantity * product.price
              ).toLocaleString()} RWF</strong>
            </div>
          `
            )
            .join("")}
        </div>

        <p><strong>Next Steps:</strong> Please coordinate with the restaurant for pickup and delivery scheduling.</p>
      </div>
      <div class="footer">
        <p>🚛 FoodBundles Logistics System</p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send logistics order notification email to all LOGISTICS users
export async function sendLogisticsOrderNotificationEmail(paymentData: {
  amount: number;
  transactionId: string;
  restaurantName: string;
  products: { name: string; quantity: number; price: number }[];
  customer: {
    name: string;
    email: string;
  };
  orderId: string;
  orderNumber: string;
}) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  try {
    // Get all LOGISTICS users
    const logisticsUsers = await prisma.admin.findMany({
      where: {
        role: "LOGISTICS",
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (logisticsUsers.length === 0) {
      console.log("No logistics users found");
      return;
    }

    const config = {
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    };

    const transporter = nodemailer.createTransport(config);

    // Send email to all logistics users
    const emailPromises = logisticsUsers.map(
      async (user: { email: string; username: string }) => {
        const logisticsEmail = {
          from: `"Food Bundles Logistics" <${process.env.GOOGLE_EMAIL}>`,
          to: user.email,
          subject: `🚚 New Delivery Order - #${paymentData.orderNumber} from ${paymentData.restaurantName}`,
          html: sendLogisticsOrderNotificationTemplate(paymentData),
        };

        return transporter.sendMail(logisticsEmail);
      }
    );

    await Promise.all(emailPromises);
    console.log(
      `Logistics order notification emails sent to ${logisticsUsers.length} users`
    );
  } catch (error) {
    console.error("Failed to send logistics order notification emails:", error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Generate invitation email template
 */
const sendInvitationEmailTemplate = (
  firstName: string,
  inviteUrl: string
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You've Been Invited!</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .invitation-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
      .button { display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #6366f1; font-weight: bold; }
      .warning { background-color: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png" alt="FoodBundles Logo" style="max-width: 150px; margin-bottom: 20px;" />
        <h1>🎉 You've Been Invited!</h1>
      </div>
      <div class="content">
        <p>Hello ${firstName},</p>
        
        <p>You've been invited to join <strong>FoodBundles Platform</strong>. We're excited to have you on board!</p>
        
        <p>This invitation gives you access to our platform where you can collaborate with your team, manage projects, and more.</p>
        
        <div class="invitation-details">
          <h2>📋 Your Invitation Details</h2>
          <p>This invitation will expire in <span class="highlight">24 hours</span>.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="${inviteUrl}" class="button">Accept Invitation</a>
        </div>
        
        <div class="warning">
          <p><strong>If the button above doesn't work, you can copy and paste the following link into your browser:</strong></p>
          <p style="word-break: break-all; font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px;">${inviteUrl}</p>
        </div>
        
        <p>If you didn't expect this invitation or have any questions, please contact our support team.</p>
        
        <p>Best regards,<br>The FoodBundles Team</p>
      </div>
      <div class="footer">
        <p>© 2025 FoodBundles Platform. All rights reserved.</p>
        <p style="font-size: 12px; margin-top: 15px;">This is an automated email, please do not reply.</p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send invitation email
export async function sendInvitationEmail(
  email: string,
  firstName: string,
  inviteUrl: string
) {
  if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
    console.log("Email credentials not configured");
    return;
  }

  const config = {
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(config);

  const invitationEmail = {
    from: `"FoodBundles Platform" <${process.env.GOOGLE_EMAIL}>`,
    to: email,
    subject: "You've Been Invited to Join FoodBundles Platform!",
    html: sendInvitationEmailTemplate(firstName, inviteUrl),
  };

  try {
    await transporter.sendMail(invitationEmail);
    console.log("Invitation email sent successfully");
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }
}
