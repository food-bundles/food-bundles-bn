import nodemailer from "nodemailer";
import prisma from "../../prisma";
import { getEmailTransporter, getAdminEmailTransporter } from "./shared";

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

export interface OrderPendingPaymentData {
  orderNumber: string;
  restaurantName: string;
  totalAmount: number;
  products: { name: string; quantity: number; unitPrice: number }[];
  customer: {
    name: string;
    email: string;
  };
  paymentMethod: string;
}

/**
 * Generate order status update email template
 */
export const generateOrderStatusTemplate = (data: OrderStatusData): string => {
  const statusColors: Record<
    string,
    { bg: string; text: string }
  > = {
    PENDING: { bg: "#f3f4f6", text: "#374151" },
    CONFIRMED: { bg: "#f3f4f6", text: "#374151" },
    PREPARING: { bg: "#f3f4f6", text: "#374151" },
    READY: { bg: "#f3f4f6", text: "#374151" },
    IN_TRANSIT: { bg: "#f3f4f6", text: "#374151" },
    DELIVERED: { bg: "#f3f4f6", text: "#374151" },
    CANCELLED: { bg: "#f3f4f6", text: "#374151" },
    REFUNDED: { bg: "#f3f4f6", text: "#374151" },
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
        background: #374151;
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
        border-left: 4px solid #374151;
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
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
        <p><strong>The FoodBundles Team</strong></p>
        <p style="font-size: 12px; margin-top: 15px;">
          This is an automated message. Please do not reply to this email.
        </p></div>
    </div>
  </body>
  </html>`;
};

/**
 * Send order status update email (e.g. DELIVERED, CANCELLED)
 */
export async function sendOrderStatusEmail(data: OrderStatusData) {
  const transporter = getEmailTransporter();

  const orderStatusEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.customer.email,
    subject: `Order #${data.orderNumber} - ${data.status.replace("_", " ")}`,
    html: generateOrderStatusTemplate(data),
  };

  try {
    await transporter.sendMail(orderStatusEmail);
    console.log("Order status email sent successfully");
  } catch (error) {
    console.error("Failed to send order status email:", error);
  }
}

/**
 * Generate "order placed, payment pending" email template
 */
export const generateOrderPendingPaymentTemplate = (
  data: OrderPendingPaymentData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Order Received - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .products-list { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
      .order-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      h2 { color: #334155; margin-top: 0; font-size: 20px; }
      p { margin: 8px 0; color: #475569; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
      .status-pending { color: #374151; font-weight: bold; }
      .product-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; gap: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.customer.name},</p>

        <p>We have received your order from <strong>Food Bundles Ltd</strong>. It is now <span class="status-pending">awaiting payment</span>.</p>

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
          <div class="product-item" style="border-top: 2px solid #374151; margin-top: 10px; padding-top: 10px;">
            <div><strong>Total Amount</strong></div>
            <div class="amount">${data.totalAmount.toLocaleString()} RWF</div>
          </div>
        </div>

        <div class="order-info">
          <p><span class="highlight">Order Number:</span> ${data.orderNumber}</p>
          <p><span class="highlight">Payment Method:</span> ${data.paymentMethod}</p>
          <p><span class="highlight">Status:</span> <span class="status-pending">Pending Payment</span></p>
        </div>

        <p>Please complete payment to move your order forward. If you have already paid, you can disregard this message once payment is confirmed.</p>
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
 * Send "order placed, payment pending" email
 */
export async function sendOrderPendingPaymentEmail(
  data: OrderPendingPaymentData,
) {
  const transporter = getEmailTransporter();

  const pendingPaymentEmail = {
    from: `"Food Bundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.customer.email,
    subject: `FoodBundles Order Received - Payment Pending - ${data.orderNumber}`,
    html: `${generateOrderPendingPaymentTemplate(data)}`,
  };

  try {
    await transporter.sendMail(pendingPaymentEmail);
    console.log("Order pending-payment email sent successfully");
  } catch (error) {
    console.error("Failed to send order pending-payment email:", error);
  }
}

/**
 * Generate admin "new order created, pending payment" email template
 */
const generateAdminOrderPendingPaymentTemplate = (
  data: OrderPendingPaymentData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Order Created - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .products-list { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
      .order-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      h2 { color: #334155; margin-top: 0; font-size: 20px; }
      p { margin: 8px 0; color: #475569; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
      .status-pending { color: #374151; font-weight: bold; }
      .product-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; gap: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>

        <p>A new order has been created by <strong>${data.restaurantName}</strong> and is <span class="status-pending">awaiting payment</span>.</p>

        <div class="products-list">
          <h2>Order Items</h2>
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
          <div class="product-item" style="border-top: 2px solid #374151; margin-top: 10px; padding-top: 10px;">
            <div><strong>Total Amount</strong></div>
            <div class="amount">${data.totalAmount.toLocaleString()} RWF</div>
          </div>
        </div>

        <div class="order-info">
          <p><span class="highlight">Order Number:</span> ${data.orderNumber}</p>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Customer:</span> ${data.customer.name} (${data.customer.email})</p>
          <p><span class="highlight">Payment Method:</span> ${data.paymentMethod}</p>
          <p><span class="highlight">Status:</span> <span class="status-pending">Pending Payment</span></p>
        </div>
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
 * Send admin "new order created, pending payment" email
 */
export async function sendAdminOrderPendingPaymentEmail(
  data: OrderPendingPaymentData,
) {
  const transporter = getAdminEmailTransporter();

  const adminPendingEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Order Created - #${data.orderNumber} from ${data.restaurantName}`,
    html: generateAdminOrderPendingPaymentTemplate(data),
  };

  try {
    await transporter.sendMail(adminPendingEmail);
    console.log("Admin order pending-payment email sent successfully");
  } catch (error) {
    console.error("Failed to send admin order pending-payment email:", error);
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
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .order-summary { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .product-list { margin: 15px 0; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
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
          <p><span class="highlight">Restaurant:</span> ${
            paymentData.restaurantName
          }</p>
          <p><span class="highlight">Customer:</span> ${
            paymentData.customer.name
          } (${paymentData.customer.email})</p>
          <p><span class="highlight">Total Amount:</span> <span class="amount">${paymentData.amount.toLocaleString()} RWF</span></p>
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
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `New Order Confirmed - #${paymentData.orderNumber} from ${paymentData.restaurantName}`,
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
      .header { background: #374151; color: #ffffff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .order-summary { background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .product-list { margin: 15px 0; }
      .product-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
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
          <p><span class="highlight">Restaurant:</span> ${
            paymentData.restaurantName
          }</p>
          <p><span class="highlight">Customer:</span> ${
            paymentData.customer.name
          } (${paymentData.customer.email})</p>
          <p><span class="highlight">Total Amount:</span> <span class="amount">${paymentData.amount.toLocaleString()} RWF</span></p>
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
    throw new Error("Email not sent: EVs are not configured.");
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

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Send email to all logistics users
    const emailPromises = logisticsUsers.map(
      async (user: { email: string; username: string }) => {
        const logisticsEmail = {
          from: `"Food Bundles Logistics" <${process.env.GOOGLE_EMAIL}>`,
          to: user.email,
          subject: `New Delivery Order - #${paymentData.orderNumber} from ${paymentData.restaurantName}`,
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

export interface AdminOrderCancelledData {
  orderNumber: string;
  restaurantName: string;
  totalAmount: number;
  reason?: string;
}

/**
 * Generate admin order cancelled email template
 */
const sendAdminOrderCancelledTemplate = (
  data: AdminOrderCancelledData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Order Cancelled - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .order-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>

        <p>An order has been cancelled.</p>

        <div class="order-info">
          <p><span class="highlight">Order Number:</span> ${data.orderNumber}</p>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Total Amount:</span> <span class="amount">${data.totalAmount.toLocaleString()} RWF</span></p>
          ${data.reason ? `<p><span class="highlight">Reason:</span> ${data.reason}</p>` : ""}
        </div>
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

// Send admin order cancelled email
export async function sendAdminOrderCancelledEmail(
  data: AdminOrderCancelledData,
) {
  const transporter = getAdminEmailTransporter();

  const adminCancelledEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Order Cancelled - #${data.orderNumber} from ${data.restaurantName}`,
    html: sendAdminOrderCancelledTemplate(data),
  };

  try {
    await transporter.sendMail(adminCancelledEmail);
    console.log("Admin order cancelled email sent successfully");
  } catch (error) {
    console.error("Failed to send admin order cancelled email:", error);
  }
}
