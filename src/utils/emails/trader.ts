import { getEmailTransporter } from "./shared";

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
        <p>Dear ${data.traderName},</p>
        <p>You have successfully approved a loan application on the FoodBundles platform.</p>
        <div class="approval-details">
          <h2>Loan Approval Details</h2>
          <p><span class="highlight">Restaurant:</span> ${data.restaurantName}</p>
          <p><span class="highlight">Approved Amount:</span> <span class="amount">${data.approvedAmount.toLocaleString()} RWF</span></p>
          <p><span class="highlight">Remaining Wallet Balance:</span> ${data.walletBalance.toLocaleString()} RWF</p>
        </div>
        <p>The approved amount has been deducted from your wallet and the voucher will be issued to the restaurant shortly.</p>
      </div>
      <div class="footer">
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
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
  const transporter = getEmailTransporter();

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
      .warning { background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d1d5db; }
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
        <p>Contact Support: sales@food.rw | +250 796 897 823</p>
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
  const transporter = getEmailTransporter();

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
