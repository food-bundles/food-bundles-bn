import { getEmailTransporter, getAdminEmailTransporter } from "./shared";

export interface LoanApplicationSubmittedData {
  email: string;
  restaurantName: string;
  requestedAmount: number;
  purpose?: string;
  repaymentDays?: number;
  rrn?: string;
}

export interface LoanDisbursedData {
  email: string;
  restaurantName: string;
  amount: number;
  voucherCode?: string;
  rrn?: string;
  repaymentDays?: number;
}

export interface LoanRepaymentConfirmedData {
  email: string;
  restaurantName: string;
  amount: number;
  rrn?: string;
  fullySettled?: boolean;
}

export interface VoucherMaturingSoonData {
  email: string;
  restaurantName: string;
  voucherCode: string;
  amountDue: number;
  maturityDate: Date;
}

export interface AdminVoucherMaturingSoonData {
  vouchers: {
    restaurantName: string;
    voucherCode: string;
    amountDue: number;
    maturityDate: Date;
  }[];
}

/**
 * Generate loan/voucher application submitted email template
 */
const sendLoanApplicationSubmittedTemplate = (
  data: LoanApplicationSubmittedData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Application Received - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .application-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
      .status-pending { color: #374151; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        <p>We have received your loan/voucher application and it is now <span class="status-pending">pending review</span>.</p>

        <div class="application-details">
          <h2>Application Details</h2>
          ${data.rrn ? `<p><span class="highlight">Reference:</span> ${data.rrn}</p>` : ""}
          <p><span class="highlight">Requested Amount:</span> <span class="amount">${data.requestedAmount.toLocaleString()} RWF</span></p>
          ${data.purpose ? `<p><span class="highlight">Purpose:</span> ${data.purpose}</p>` : ""}
          ${data.repaymentDays ? `<p><span class="highlight">Repayment Period:</span> ${data.repaymentDays} days</p>` : ""}
          <p><span class="highlight">Status:</span> <span class="status-pending">Pending Review</span></p>
        </div>

        <p>We'll notify you as soon as your application has been reviewed.</p>
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

// Send loan/voucher application submitted email
export async function sendLoanApplicationSubmittedEmail(
  data: LoanApplicationSubmittedData,
) {
  const transporter = getEmailTransporter();

  const submittedEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `Application Received${data.rrn ? ` - ${data.rrn}` : ""}`,
    html: sendLoanApplicationSubmittedTemplate(data),
  };

  try {
    await transporter.sendMail(submittedEmail);
    console.log("Loan application submitted email sent successfully");
  } catch (error) {
    console.error("Failed to send loan application submitted email:", error);
  }
}

/**
 * Generate loan disbursed email template
 */
const sendLoanDisbursedTemplate = (data: LoanDisbursedData): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loan Disbursed - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .success-badge { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: bold; font-size: 18px; border: 2px solid #374151; }
      .loan-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        <div class="success-badge">Your loan has been disbursed!</div>

        <div class="loan-details">
          <h2>Loan Details</h2>
          ${data.rrn ? `<p><span class="highlight">Reference:</span> ${data.rrn}</p>` : ""}
          <p><span class="highlight">Amount:</span> <span class="amount">${data.amount.toLocaleString()} RWF</span></p>
          ${data.voucherCode ? `<p><span class="highlight">Voucher Code:</span> ${data.voucherCode}</p>` : ""}
          ${data.repaymentDays ? `<p><span class="highlight">Repayment Period:</span> ${data.repaymentDays} days</p>` : ""}
        </div>

        <p>You can now use this voucher credit for your orders. Thank you for working with FoodBundles!</p>
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

// Send loan disbursed email
export async function sendLoanDisbursedEmail(data: LoanDisbursedData) {
  const transporter = getEmailTransporter();

  const disbursedEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `Loan Disbursed${data.rrn ? ` - ${data.rrn}` : ""}`,
    html: sendLoanDisbursedTemplate(data),
  };

  try {
    await transporter.sendMail(disbursedEmail);
    console.log("Loan disbursed email sent successfully");
  } catch (error) {
    console.error("Failed to send loan disbursed email:", error);
  }
}

/**
 * Generate loan repayment confirmed email template
 */
const sendLoanRepaymentConfirmedTemplate = (
  data: LoanRepaymentConfirmedData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Repayment Received - FoodBundles</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .success-badge { background-color: #f3f4f6; color: #374151; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-weight: bold; font-size: 18px; border: 2px solid #374151; }
      .repayment-details { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear ${data.restaurantName},</p>

        <div class="success-badge">Repayment Received</div>

        <div class="repayment-details">
          ${data.rrn ? `<p><span class="highlight">Reference:</span> ${data.rrn}</p>` : ""}
          <p><span class="highlight">Amount Paid:</span> <span class="amount">${data.amount.toLocaleString()} RWF</span></p>
          ${
            data.fullySettled
              ? `<p><span class="highlight">Status:</span> Your loan is now fully settled. Thank you!</p>`
              : `<p><span class="highlight">Status:</span> Payment applied to your outstanding balance.</p>`
          }
        </div>

        <p>Thank you for your payment!</p>
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

// Send loan repayment confirmed email
export async function sendLoanRepaymentConfirmedEmail(
  data: LoanRepaymentConfirmedData,
) {
  const transporter = getEmailTransporter();

  const repaymentEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `Repayment Received${data.rrn ? ` - ${data.rrn}` : ""}`,
    html: sendLoanRepaymentConfirmedTemplate(data),
  };

  try {
    await transporter.sendMail(repaymentEmail);
    console.log("Loan repayment confirmed email sent successfully");
  } catch (error) {
    console.error("Failed to send loan repayment confirmed email:", error);
  }
}

/**
 * Generate voucher-maturing-soon email template (restaurant-facing)
 */
const sendVoucherMaturingSoonTemplate = (
  data: VoucherMaturingSoonData,
): string => {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voucher Maturing Soon - FoodBundles</title>
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
        <p>Dear ${data.restaurantName},</p>

        <p>Your voucher is due for repayment in approximately 48 hours.</p>

        <div class="alert-box">
          <p><span class="highlight">Voucher Code:</span> ${data.voucherCode}</p>
          <p><span class="highlight">Amount Due:</span> <span class="amount">${data.amountDue.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Due Date:</span> ${data.maturityDate.toLocaleDateString()}</p>
        </div>

        <p>Please ensure your wallet has sufficient balance, or make a repayment before the due date to avoid an automatic wallet deduction or penalty.</p>
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

// Send voucher-maturing-soon email (restaurant-facing)
export async function sendVoucherMaturingSoonEmail(
  data: VoucherMaturingSoonData,
) {
  const transporter = getEmailTransporter();

  const maturingEmail = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to: data.email,
    subject: `Voucher Due Soon - ${data.voucherCode}`,
    html: sendVoucherMaturingSoonTemplate(data),
  };

  try {
    await transporter.sendMail(maturingEmail);
    console.log("Voucher maturing soon email sent successfully");
  } catch (error) {
    console.error("Failed to send voucher maturing soon email:", error);
  }
}

/**
 * Generate admin voucher-maturing-soon summary email template
 */
const sendAdminVoucherMaturingSoonTemplate = (
  data: AdminVoucherMaturingSoonData,
): string => {
  const totalAmount = data.vouchers.reduce((sum, v) => sum + v.amountDue, 0);

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vouchers Maturing Soon - Admin Notification</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f8f9fa; }
      .container { margin: 0 auto; max-width: 600px; background-color: #ffffff; padding: 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); overflow: hidden; }
      .content { padding: 30px; }
      .summary-box { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #374151; }
      .voucher-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
      .footer { text-align: center; padding: 20px; color: #64748b; background-color: #f8fafc; }
      .highlight { color: #374151; font-weight: bold; }
      .amount { font-size: 24px; font-weight: bold; color: #374151; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <p>Dear Admin,</p>

        <p>${data.vouchers.length} voucher(s) are due for repayment in approximately 48 hours.</p>

        <div class="summary-box">
          <p><span class="highlight">Total Outstanding:</span> <span class="amount">${totalAmount.toLocaleString()} RWF</span></p>
        </div>

        <div class="summary-box">
          ${data.vouchers
            .map(
              (v) => `
            <div class="voucher-item">
              <strong>${v.restaurantName}</strong> — ${v.voucherCode}<br>
              <span class="highlight">Amount:</span> ${v.amountDue.toLocaleString()} RWF |
              <span class="highlight">Due:</span> ${v.maturityDate.toLocaleDateString()}
            </div>`,
            )
            .join("")}
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

// Send admin voucher-maturing-soon summary email
export async function sendAdminVoucherMaturingSoonEmail(
  data: AdminVoucherMaturingSoonData,
) {
  const transporter = getAdminEmailTransporter();

  const adminEmail = {
    from: `"Food Bundles System" <${process.env.GOOGLE_EMAIL}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `${data.vouchers.length} Voucher(s) Due Soon`,
    html: sendAdminVoucherMaturingSoonTemplate(data),
  };

  try {
    await transporter.sendMail(adminEmail);
    console.log("Admin voucher maturing soon email sent successfully");
  } catch (error) {
    console.error("Failed to send admin voucher maturing soon email:", error);
  }
}
