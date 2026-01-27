import { sendMessage } from "../utils/sms.utility";
import prisma from "../prisma";
import { sendAdminWalletOTPEmail } from "../utils/emailTemplates";
import { OTPPurpose } from "@prisma/client";

export class OTPService {
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async sendRestaurantSignupOTP(
    phone: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      await prisma.oTP.deleteMany({
        where: { phone, purpose: "RESTAURANT_SIGNUP", verified: false },
      });

      await prisma.oTP.create({
        data: { phone, otp, purpose: "RESTAURANT_SIGNUP", expiresAt },
      });

      await sendMessage(
        `Your restaurant registration OTP is: ${otp}. Valid for 48 hours.`,
        phone,
      );
      return { success: true, message: "OTP sent successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  static async verifyOTP(
    phone: string,
    otp: string,
    purpose:
      | "RESTAURANT_SIGNUP"
      | "VOUCHER_CHECKOUT"
      | "ADMIN_WALLET_OPERATION",
  ): Promise<{ success: boolean; message: string }> {
    try {
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          phone,
          otp,
          purpose,
          verified: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otpRecord) {
        return { success: false, message: "Invalid or expired OTP" };
      }

      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });

      return { success: true, message: "OTP verified successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  static async sendOTPToRestaurant(
    restaurantId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { phone: true },
      });

      if (!restaurant?.phone) {
        return { success: false, message: "Restaurant phone number not found" };
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.oTP.deleteMany({
        where: {
          phone: restaurant.phone,
          purpose: "VOUCHER_CHECKOUT",
          verified: false,
        },
      });

      await prisma.oTP.create({
        data: {
          phone: restaurant.phone,
          otp,
          purpose: "VOUCHER_CHECKOUT",
          expiresAt,
        },
      });

      await sendMessage(
        `Your voucher checkout OTP is: ${otp}. Valid for 10 minutes.`,
        restaurant.phone,
      );
      return { success: true, message: "OTP sent successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  static async sendAdminWalletOTP(
    adminId: string,
    operationType: "DEPOSIT" | "ADJUSTMENT",
    amount: number,
    restaurantId?: string,
    restaurantName?: string,
    description?: string,
  ): Promise<{ success: boolean; message: string; sessionId?: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const privateReceiver = process.env.PRIVATE_RECEIVER;

      if (!privateReceiver) {
        return { success: false, message: "Private receiver not configured" };
      }

      // Delete existing OTPs for this admin
      await prisma.oTP.deleteMany({
        where: {
          phone: privateReceiver,
          purpose: "ADMIN_WALLET_OPERATION",
          verified: false,
        },
      });

      // Create new OTP record
      const otpRecord = await prisma.oTP.create({
        data: {
          phone: privateReceiver,
          otp,
          purpose: "ADMIN_WALLET_OPERATION",
          expiresAt,
        },
      });

      // Send SMS to private receiver
      await sendMessage(
        `Admin wallet ${operationType.toLowerCase()} OTP: ${otp}. Amount: ${amount} RWF${restaurantName ? ` for ${restaurantName}` : ""}. Valid for 10 minutes.`,
        privateReceiver,
      );

      // Send email to private receiver
      if (process.env.ADMIN_EMAIL) {
        await sendAdminWalletOTPEmail({
          adminId,
          operationType,
          amount,
          restaurantName,
          otp,
        });
      }

      // Create session ID with all necessary data
      const sessionId = Buffer.from(
        JSON.stringify({
          adminId,
          operationType,
          amount,
          restaurantId,
          restaurantName,
          description,
          otpId: otpRecord.id,
          timestamp: Date.now(),
        }),
      ).toString("base64");

      return {
        success: true,
        message: "OTP sent to private receiver",
        sessionId,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  static async verifyAdminWalletOTP(
    otp: string,
    sessionId: string,
  ): Promise<{ success: boolean; message: string; sessionData?: any }> {
    try {
      // Decode session data
      const sessionData = JSON.parse(
        Buffer.from(sessionId, "base64").toString(),
      );

      const privateReceiver = process.env.PRIVATE_RECEIVER;
      if (!privateReceiver) {
        return { success: false, message: "Private receiver not configured" };
      }

      // Verify OTP
      const otpRecord = await prisma.oTP.findFirst({
        where: {
          phone: privateReceiver,
          otp,
          purpose: OTPPurpose.ADMIN_WALLET_OPERATION,
          verified: false,
          expiresAt: { gt: new Date() },
        },
      });

      if (!otpRecord) {
        return { success: false, message: "Invalid or expired OTP" };
      }

      // Mark OTP as verified
      await prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      });

      return {
        success: true,
        message: "OTP verified successfully",
        sessionData,
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Invalid session or OTP verification failed",
      };
    }
  }
}
