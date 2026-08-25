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

export interface SubscriptionExpiryData {
  email: string;
  restaurantName: string;
  planName: string;
  endDate: Date;
  isWarning?: boolean;
}

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
  data: PaymentNotificationData,
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
        padding: 4 10px;
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
          <h2>Your Order</h2>
          ${data.products
            .map(
              (product) => `
            <div class="product-item">
              <div>
                <strong>${product.name}</strong><br>
                <small>Quantity: ${product.quantity}</small>
              </div>
              <div>Price: <strong>${product.unitPrice.toLocaleString()} RWF</strong></div>
            </div>`,
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
          <p>Important: Complete your payment within 8 hours</p>
          <p><strong>Expires:</strong> ${expirationTime.toLocaleString(
            "en-RW",
            {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
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
        <p style="font-size: 12px; margin-top: 15px;">Email: sales@food.rw | Phone: +250 796 897 823</p>
        <p style="font-size: 12px;">This is an automated message. Please do not reply to this email.</p>      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate payment confirmation email template
 */
export const sendPaymentConfirmationTemplate = (
  data: PaymentConfirmationData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Confirmation - FoodBundles</title>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.customer.name},</p>
        <p>Your payment of ${data.amount.toLocaleString()} RWF has been confirmed.</p>
        <p>Order ID: ${data.orderId}</p>
        <p>Transaction ID: ${data.transactionId}</p>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate enhanced payment confirmation email template
 */
const sendEnhancedPaymentConfirmationTemplate = (
  data: PaymentConfirmationData,
): string => {
  return `<!DOC
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
          <h2>Order Summary</h2>
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
                  },
                )}</p>`
              : ""
          }
          
          <h3 style="margin-top: 20px;">Items Ordered:</h3>
          ${data.products
            .map(
              (product) => `
            <div class="product-item">
              <div>
                <strong>${product.name}</strong><br>
                <small>Quantity: ${product.quantity}</small>
              </div>
              <div><strong>${product.price.toLocaleString()} RWF</strong></div>
            </div>`,
            )
            .join("")}
        </div>

        <div class="tracking-info">
          <h2>What's Next?</h2>
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
          <h2>Payment Details</h2>
          <p><span class="highlight">Amount:</span> ${data.amount.toLocaleString()} RWF</p>
          ${
            data.failureReason
              ? `<p><span class="highlight">Reason:</span> ${data.failureReason}</p>`
              : ""
          }

          <h3 style="margin-top: 20px;">Items Ordered:</h3>
          ${data.products
            .map(
              (product) => `
              <div class="product-item">
                <div>
                  <strong>${product.name}</strong><br>
                  <small>Quantity: ${product.quantity}</small>
                </div>
                <div><strong>${product.price.toLocaleString()} RWF</strong></div>
              </div>`,
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
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p></div>
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
      <div class="content">
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p></div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate wallet notification email template
 */

export const sendWalletNotificationTemplate = (
  data: WalletNotificationData,
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p>
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
  data: WalletNotificationData,
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
    0,
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
      <div class="content">
        <p>Dear Admin,</p>
        
        <p>A new order has been confirmed and payment has been completed successfully.</p>
        
        <div class="order-summary">
          <h2>Order Details</h2>
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
          <h3>Order Items:</h3>
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
          `,
            )
            .join("")}
        </div>

        <p><strong>Action Required:</strong> Please process this order for fulfillment and delivery coordination.</p>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p>
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
    0,
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
      <div class="content">
        <p>Dear Logistics Team,</p>
        
        <p>A new order has been confirmed and is ready for delivery coordination.</p>
        
        <div class="order-summary">
          <h2>Delivery Details</h2>
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
          <h3>Items to Deliver:</h3>
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
          `,
            )
            .join("")}
        </div>

        <p>Please coordinate with the restaurant for pickup and delivery arrangements.</p>
        
        <p>Thank you for your prompt attention to this delivery.</p>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #dc2626, #b91c1c); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .otp-box { background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; text-align: center; }
      .otp-code { font-size: 26px; font-weight: bold; color: #dc2626; letter-spacing: 4px; margin: 10px 0; }
      .operation-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #dc2626; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #059669; }
      .warning { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔐 Admin Wallet Operation</h1>
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
          <p><span class="highlight">Admin ID:</span> ${data.adminId}</p>
          <p><span class="highlight">Timestamp:</span> ${new Date().toLocaleString()}</p>
        </div>

        <div class="otp-box">
          <h3>Your OTP Code</h3>
          <div class="otp-code">${data.otp}</div>
          <p><strong>Valid for 10 minutes</strong></p>
        </div>

        <div class="warning">
          <p><strong>⚠️ Security Notice:</strong></p>
          <p>This OTP is required to authorize the wallet operation. Do not share this code with anyone. If you did not initiate this operation, please contact the system administrator immediately.</p>
        </div>

        <p><strong>Action Required:</strong> Enter this OTP in the admin panel to complete the wallet operation.</p>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
    from: `"Food Bundles Security" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🔐 Admin Wallet ${data.operationType} OTP - ${data.amount.toLocaleString()} RWF`,
    html: sendAdminWalletOTPTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin wallet OTP email sent successfully");
  } catch (error) {
    console.error("Failed to send admin wallet OTP email:", error);
  }
}

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
      },
    );

    await Promise.all(emailPromises);
    console.log(
      `Logistics order notification emails sent to ${logisticsUsers.length} users`,
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
      .header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .invitation-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
      .button { display: inline-block; background: linear-gradient(135deg, #82f163ff, #66e546ff); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #6366f1; font-weight: bold; }
      .warning { background-color: #fef3c7; color: #92400e; padding: 15px; border-radius: 8px; margin: 15px 0; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .credentials-box { background: linear-gradient(135deg, #f0fdf4, #dcfce7); padding: 20px; border-radius: 12px; margin: 20px 0; border: 2px solid #22c55e; }
      .button { display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .warning { background-color: #fee2e2;color: #991b1b;padding: 15px;border-radius: 8px;margin: 15px 0;font-weight: bold; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
      .credentials { font-family: monospace; background: #f3f4f6; padding: 10px; border-radius: 4px; margin: 5px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Hello <strong>${name}</strong>,</p>
        
        <p>Congratulations! You've been successfully added as an <strong>Affiliator</strong> for <span class="highlight">${restaurantName}</span> on the FoodBundles platform.</p>
        
        <div class="credentials-box">
          <h2>🔐 Your Account Credentials</h2>
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
        
        <p>Welcome aboard and let's grow together! 🇷🇼</p>
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

// Send invitation email
export async function sendInvitationEmail(
  email: string,
  firstName: string,
  inviteUrl: string,
  userType: string,
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
    html: sendInvitationEmailTemplate(firstName, inviteUrl, userType),
  };

  try {
    await transporter.sendMail(invitationEmail);
    console.log("Invitation email sent successfully");
  } catch (error) {
    console.error("Failed to send invitation email:", error);
  }
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
      .header { background: ${
        isWarning
          ? "linear-gradient(135deg, #f59e0b, #d97706)"
          : "linear-gradient(135deg, #ef4444, #b91c1c)"
      }; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .alert-box { background-color: ${
        isWarning ? "#fef3c7" : "#fee2e2"
      }; color: ${
        isWarning ? "#92400e" : "#b91c1c"
      }; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${
        isWarning ? "#f59e0b" : "#ef4444"
      }; }
      .subscription-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
      .button { display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; text-align: center; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
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
          <h2>${isWarning ? "🔔 Action Required" : "🚫 Access Restricted"}</h2>
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .user-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #3b82f6; font-weight: bold; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .payment-details { background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #22c55e; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .voucher-details { background-color: #faf5ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #8b5cf6; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #8b5cf6; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .approval-details { background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #10b981; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #10b981; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

// Admin notification functions
export async function sendAdminUserCreatedEmail(data: AdminNotificationData) {
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
    tls: { rejectUnauthorized: false },
  };

  const transporter = nodemailer.createTransport(config);

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🆕 New ${data.userType} Account Created - ${data.userName}`,
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
    tls: { rejectUnauthorized: false },
  };

  const transporter = nodemailer.createTransport(config);

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `💰 Subscription Payment Successful - ${data.restaurantName} (${data.subscriptionPlan})`,
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
    tls: { rejectUnauthorized: false },
  };

  const transporter = nodemailer.createTransport(config);

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `🎫 Voucher Applied - ${
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
    tls: { rejectUnauthorized: false },
  };

  const transporter = nodemailer.createTransport(config);

  const adminEmail = {
    from: `"FoodBundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `✅ Voucher Approved - ${data.restaurantName} (${data.voucherAmount?.toLocaleString()} RWF)`,
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
      .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .update-box { background-color: #fef3c7; color: #92400e; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
      .products-list { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #f59e0b; font-weight: bold; }
      .price { font-weight: bold; color: #22c55e; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.recipientName || "Valued Customer"},</p>
        
        <p>We want to inform you that some product prices have been updated on the FoodBundles platform.</p>
        
        <div class="update-box">
          <h2>📢 Price Update Notice</h2>
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
/**
 * Generate trader loan approval email template
 */
const sendTraderLoanApprovalTemplate = (data: {
  traderName: string;
  restaurantName: string;
  approvedAmount: number;
  loanId: string;
  walletBalance: number;
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loan Approval Confirmation - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header { background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .approval-details { background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #10b981; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #10b981; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.traderName},</p>
        <p>You have successfully approved a loan application on the FoodBundles platform.</p>
        <div class="approval-details">
          <h2>Loan Approval Details</h2>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Approved Amount:</span> <span class="amount">${data.approvedAmount.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Loan ID:</span> ${data.loanId}</p>
          <p><span class="highlight">Remaining Wallet Balance:</span> ${data.walletBalance.toLocaleString()} RWF</p>
        </div>
        <p>The approved amount has been deducted from your wallet and the voucher will be issued to the restaurant shortly.</p>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send trader loan approval email
export async function sendTraderLoanApprovalEmail(data: {
  traderEmail: string;
  traderName: string;
  restaurantName: string;
  approvedAmount: number;
  loanId: string;
  walletBalance: number;
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

  const email = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.traderEmail,
    subject: `Loan Approval Confirmation - ${data.restaurantName}`,
    html: sendTraderLoanApprovalTemplate(data),
  };

  try {
    await transporter.sendMail(email);
    console.log("Trader loan approval email sent successfully");
  } catch (error) {
    console.error("Failed to send trader loan approval email:", error);
  }
}

/**
 * Generate trader delegation OTP email template
 */
const sendTraderDelegationOTPTemplate = (data: {
  traderName: string;
  otp: string;
  commission: number;
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Delegation Approval OTP - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .header {font-size: small; padding: 2px 10px; text-align: center; }
      .content { padding: 30px; }
      .otp-box {  text-align: center; }
      .otp-code { font-size: 26px; font-weight: bold; letter-spacing: 4px; ; }
      .footer { text-align: center;  color: #5f6266; background-color: #f8fafc; }
      .highlight { font-weight: bold; }
      .warning { background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.traderName},</p>
        
        <p>Your delegation approval request requires OTP verification. with ${data.commission}% commission.</p>
        
        <div class="otp-box">
          <p>Your OTP Code <span class="otp-code">${data.otp}</span>Valid for 24 hours</p>
        </div>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Ltd</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated security message. Please do not reply to this email.
        </p>
      </div>
    </div>
  </body>
  </html>`;
};

// Send trader delegation OTP email
export async function sendTraderDelegationOTPEmail(data: {
  traderEmail: string;
  traderName: string;
  otp: string;
  commission: number;
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

  const email = {
    from: `"FoodBundles Security" <${process.env.GOOGLE_EMAIL}>`,
    to: data.traderEmail,
    subject: `Delegation Approval OTP - ${data.commission}% Commission`,
    html: sendTraderDelegationOTPTemplate(data),
  };

  try {
    await transporter.sendMail(email);
    console.log("Trader delegation OTP email sent successfully");
  } catch (error) {
    console.error("Failed to send trader delegation OTP email:", error);
  }
}

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
      .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .benefits-box { background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
      ul { margin: 10px 0; padding-left: 20px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome to FoodBundles Newsletter!</h1>
      </div>
      <div class="content">
        <p>Dear ${data.name},</p>
        
        <p>Thank you for subscribing to the <strong>FoodBundles Newsletter</strong>! We're excited to keep you informed about the latest updates from our platform.</p>
        
        <div class="benefits-box">
          <h2>📬 What You'll Receive:</h2>
          <ul>
            <li><strong>Weekly Price Updates:</strong> Stay informed with stable, competitive prices updated every week</li>
            <li><strong>New Product Announcements:</strong> Be the first to know about fresh arrivals and new products</li>
            <li><strong>Market Trends:</strong> Get insights on agricultural market trends and pricing</li>
            <li><strong>Special Offers:</strong> Exclusive deals and promotions for our subscribers</li>
            <li><strong>Platform Updates:</strong> Learn about new features and improvements</li>
          </ul>
        </div>
        
        <p>Our newsletter is designed to help you make informed decisions and get the best value from FoodBundles.</p>
              
        
        <p>Welcome aboard! 🇷🇼</p>
      </div>
      <div class="footer">
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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
      .header { background: linear-gradient(135deg, #22c55e, #16a34a); color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #22c55e; font-weight: bold; }
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
        <p>📞 Contact Support: sales@food.rw | +250 796 897 823</p>
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

  const welcomeEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: "Welcome to FoodBundles Newsletter! 🎉",
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
