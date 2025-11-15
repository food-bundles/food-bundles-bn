import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import { getUserByEmail } from "../services/userGets";

export interface PasswordResetData {
  email: string;
  name: string;
  resetLink: string;
  userType: string;
}

/**
 * Generate password reset email template
 */
export const sendPasswordResetTemplate = (data: PasswordResetData): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Your Password - FoodBundles</title>
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.5;
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
      background-color: #ffffff;
      color: black;
      padding: 15px 20px; /* reduced space */
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #16a34a;
    }
    .content {
      padding: 20px; /* reduced space */
    }
    .reset-button {
      display: inline-block;
      background: #16a34a;
      color: white;
      padding: 12px 25px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      margin: 15px 0; /* less margin */
      text-align: center;
    }
    hover .reset-button {
      background: #15803d;
    }
    .warning {
      background-color: #fef3c7;
      color: #92400e;
      padding: 12px;
      border-radius: 8px;
      margin: 15px 0;
    }
    .warning-title {
      text-align: center;
      margin: 0 0 10px 0;
      font-weight: bold;
      font-size: 16px;
    }
    .footer {
      text-align: center;
      padding: 15px;
      color: #64748b;
      background-color: #f8fafc;
    }
    p {
      margin: 10px 0;
      color: #475569;
    }
    .highlight {
      color: #16a34a;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
      <p>Reset your FoodBundles account password</p>
    </div>
    <div class="content">
      <p>Hello <strong>${data.name}</strong>,</p>

      <p>We received a request to reset the password for your <span class="highlight">${data.userType}</span> account associated with <strong>${data.email}</strong>.</p>

      <p>Click the button below to create a new password:</p>

    <div style="text-align: center;">
  <a 
    href="${data.resetLink}" 
    class="reset-button" 
    style="color: #ffffff !important; text-decoration: none;"
  >
    Reset My Password
  </a>
</div>


      <div class="warning">
        <p class="warning-title">Important Security Information</p>
        <ul>
          <li>This link will expire in <strong>1 hour</strong></li>
          <li>If you didn't request this reset, please ignore this email</li>
          <li>Never share this link with anyone</li>
        </ul>
      </div>

      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3b82f6;">${data.resetLink}</p>

      <p>If you didn't request a password reset, you can safely ignore this email.</p>

      <p>For security questions or support, contact our team at foodbundlesrw@gmail.com</p>
    </div>
    <div class="footer">
      <p>Thank you for using FoodBundles!</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send email using nodemailer
 */
export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL,
      pass: process.env.GOOGLE_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"FoodBundles" <${process.env.GOOGLE_EMAIL}>`,
    to,
    subject,
    html,
  };

  return await transporter.sendMail(mailOptions);
};

/**
 * Generate password reset token
 */
export const generateResetToken = (
  userId: string,
  userType: string
): string => {
  return jwt.sign(
    { userId, userType },
    process.env.JWT_SECRET || "fallback-secret",
    { expiresIn: "1h" }
  );
};

/**
 * Verify password reset token
 */
export const verifyResetToken = (
  token: string
): { userId: string; userType: string } | null => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret"
    ) as any;
    return { userId: decoded.userId, userType: decoded.userType };
  } catch (error) {
    return null;
  }
};
