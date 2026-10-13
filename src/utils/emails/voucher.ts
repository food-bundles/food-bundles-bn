import { getEmailTransporter } from "./shared";

export interface LoanApplicationSubmittedData {
  email: string;
  restaurantName: string;
  requestedAmount: number;
  purpose?: string;
  repaymentDays?: number;
  rrn?: string;
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
