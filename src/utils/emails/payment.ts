import { getEmailTransporter, getAdminEmailTransporter } from "./shared";

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
  orderNumber: string;
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
  orderNumber: string;
  deliveryDate?: Date;
}

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
        background: #374151;
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
        border-left: 4px solid #374151;
      }
      .products-list {
        background-color: #f3f4f6;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
      }
      .warning {
        background-color: #f3f4f6;
        color: #374151;
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
        color: #374151;
        font-weight: bold;
      }
      .amount {
        font-size: 24px;
        font-weight: bold;
        color: #374151;
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
        background: #374151;
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
          <div class="product-item" style="border-top: 2px solid #374151; margin-top: 10px; padding-top: 10px;">
            <div><strong>Total Amount</strong></div>
            <div class="amount">${data.amount.toLocaleString()} RWF</div>
          </div>
        </div>

        <div class="payment-details">
          <h2>Payment Information</h2>
          <p><span class="highlight">Order Number:</span> ${data.orderNumber}</p>
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
          <h2>Next Steps</h2>
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
        <p>Order Number: ${data.orderNumber}</p>
      </div>
    </div>
  </body>
  </html>`;
};

/**
 * Generate enhanced payment confirmation email template
 * NOTE: dead code — not called anywhere, kept for parity with the
 * email templates this module was split from.
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
        background: #374151;
        color: #ffffff;
        padding: 30px 20px;
        text-align: center;
      }
      .content {
        padding: 30px;
      }
      .success-badge {
        background: #f3f4f6;
        color: #374151;
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        margin: 20px 0;
        font-weight: bold;
        font-size: 18px;
        border: 2px solid #374151;
      }
      .order-details {
        background-color: #f8fafc;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
        border-left: 4px solid #374151;
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
        color: #374151;
        font-weight: bold;
      }
      .tracking-info {
        background: #f3f4f6;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border-left: 4px solid #374151;
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
          <h2>Need Support?</h2>
          <p>If you have any questions about your order, please contact us:</p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Email: sales@food.rw</li>
            <li>Phone: +250 796 897 823</li>
          </ul>
        </div>

        <p style="text-align: center; font-size: 16px; color: #374151; font-weight: bold;">
          Thank you for working with us!
        </p>
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
      .header { background: #374151; color: #fff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .failure-badge { background: #f3f4f6; color: #374151; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; font-weight: bold; font-size: 18px; border: 2px solid #d1d5db; }
      .order-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .product-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
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
          <h2>Need Help?</h2>
          <ul>
            <li>Email: sales@food.rw</li>
            <li>Phone: +250 796 897 823</li>
          </ul>
        </div>

        <p style="text-align:center; font-size:16px; color:#374151; font-weight:bold;">
          Don’t worry — your order is still saved and can be completed once the payment succeeds.
        </p>
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
 * Generate admin payment failed email template
 */
const sendAdminPaymentFailedTemplate = (data: {
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
}): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Payment Failed - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; background-color: #f8f9fa; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background: #374151; color: #fff; padding: 30px 20px; text-align: center; }
      .content { padding: 30px; }
      .order-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .product-item { display: flex; justify-content: space-between; margin: 8px 0; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>
        <p>A payment attempt for the order below from <strong>${data.restaurantName}</strong> was not successful.</p>

        <div class="order-details">
          <h2>Payment Details</h2>
          <p><span class="highlight">Order Number:</span> #${data.orderNumber}</p>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Customer:</span> ${data.customer.name} (${data.customer.email})</p>
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

        <p><strong>Action Required:</strong> No further action is needed unless the restaurant reports a recurring issue — the order remains saved and can be completed once payment succeeds.</p>
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
 * Send admin payment failed email
 */
export async function sendAdminPaymentFailedEmail(paymentData: {
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
  const transporter = getAdminEmailTransporter();

  const adminFailedEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Payment Failed - Order #${paymentData.orderNumber} from ${paymentData.restaurantName}`,
    html: sendAdminPaymentFailedTemplate(paymentData),
  };

  try {
    await transporter.sendMail(adminFailedEmail);
    console.log("Admin payment failed email sent successfully");
  } catch (error) {
    console.error("Failed to send admin payment failed email:", error);
  }
}

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
  orderNumber: string;
  walletDetails?: {
    previousBalance: number;
    newBalance: number;
    transactionId: string;
  };
}) {
  const transporter = getEmailTransporter();

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
  const transporter = getEmailTransporter();

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
  const transporter = getEmailTransporter();

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
