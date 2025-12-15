import { sendMessage } from "../utils/sms.utility";
import prisma from "../prisma";

export class OTPService {
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async sendRestaurantSignupOTP(
    phone: string
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
        phone
      );
      return { success: true, message: "OTP sent successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  static async verifyOTP(
    phone: string,
    otp: string,
    purpose: "RESTAURANT_SIGNUP" | "VOUCHER_CHECKOUT"
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
    restaurantId: string
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
        restaurant.phone
      );
      return { success: true, message: "OTP sent successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  //    static  async verifyOTPCheckout(phone: string, otp: string, purpose: 'RESTAURANT_SIGNUP' | 'VOUCHER_CHECKOUT'): Promise<{ success: boolean; message: string }> {
  //   try {
  //     const otpRecord = await prisma.oTP.findFirst({
  //       where: {
  //         phone,
  //         otp,
  //         purpose,
  //         verified: false,
  //         expiresAt: { gt: new Date() }
  //       }
  //     });

  //     if (!otpRecord) {
  //       return { success: false, message: 'Invalid or expired OTP' };
  //     }

  //     await prisma.oTP.update({
  //       where: { id: otpRecord.id },
  //       data: { verified: true }
  //     });

  //     return { success: true, message: 'OTP verified successfully' };
  //   } catch (error: any) {
  //     return { success: false, message: error.message };
  //   }
  // }
}
