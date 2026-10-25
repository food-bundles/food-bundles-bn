import { sendMessage } from "../utils/sms.utility";
import prisma from "../prisma";
import { NotificationCategory, OTPPurpose } from "@prisma/client";
import { getEmailTransporter } from "../utils/emails/shared";

export interface OTPChannelDelivery {
  status: "accepted_by_provider" | "failed" | "unavailable";
  deliveryStatus: "unknown" | "provider_reported_delivered" | "not_attempted";
  providerStatus?: string;
  error?: string;
}

export interface OTPDispatchResult {
  success: boolean;
  partial: boolean;
  message: string;
  channels: {
    sms: OTPChannelDelivery;
    email: OTPChannelDelivery;
  };
}

export class OTPService {
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static async sendOTPNotification(data: {
    phone?: string | null;
    email?: string | null;
    subject: string;
    message: string;
  }): Promise<OTPDispatchResult> {
    const smsPromise: Promise<OTPChannelDelivery> = data.phone
      ? sendMessage(data.message, data.phone)
          .then((response) => {
            const providerStatus =
              typeof response?.status === "string"
                ? response.status.toLowerCase()
                : undefined;
            const failedStatuses = [
              "failed",
              "undelivered",
              "rejected",
              "cancelled",
              "canceled",
              "error",
            ];

            if (providerStatus && failedStatuses.includes(providerStatus)) {
              return {
                status: "failed",
                deliveryStatus: "unknown",
                providerStatus,
                error: "SMS provider rejected the message.",
              };
            }

            return {
              status: "accepted_by_provider",
              deliveryStatus:
                providerStatus === "delivered"
                  ? "provider_reported_delivered"
                  : "unknown",
              providerStatus,
            };
          })
          .catch((error: unknown) => {
            console.error("OTP SMS dispatch failed:", error);
            return {
              status: "failed",
              deliveryStatus: "unknown",
              error:
                error instanceof Error
                  ? error.message
                  : "SMS provider rejected the message.",
            };
          })
      : Promise.resolve({
          status: "unavailable",
          deliveryStatus: "not_attempted",
          error: "No phone number is available.",
        });

    const emailAddress = data.email?.trim();
    const emailPromise: Promise<OTPChannelDelivery> = emailAddress
      ? Promise.resolve()
          .then(() =>
            getEmailTransporter().sendMail({
              from: `"FoodBundles Security" <${process.env.GOOGLE_EMAIL}>`,
              to: emailAddress,
              subject: data.subject,
              text: data.message,
            }),
          )
          .then(() => ({
            status: "accepted_by_provider",
            deliveryStatus: "unknown",
            providerStatus: "accepted",
          }))
          .catch((error: unknown) => {
            console.error("OTP email dispatch failed:", error);
            return {
              status: "failed",
              deliveryStatus: "unknown",
              error:
                error instanceof Error
                  ? error.message
                  : "Email provider rejected the message.",
            };
          })
      : Promise.resolve({
          status: "unavailable",
          deliveryStatus: "not_attempted",
          error: "No email address is available.",
        });

    const [sms, email] = await Promise.all([smsPromise, emailPromise]);
    const channels = { sms, email };
    const accepted = [sms, email].filter(
      (channel) => channel.status === "accepted_by_provider",
    ).length;
    const failed = [sms, email].filter(
      (channel) => channel.status === "failed",
    ).length;

    return {
      success: accepted > 0,
      partial: accepted > 0 && failed > 0,
      message:
        accepted === 0
          ? "OTP dispatch failed on all available channels."
          : failed > 0
            ? "OTP dispatch was partially accepted; check channel results. Final delivery is not confirmed."
            : "OTP dispatch was accepted by the available provider(s); final delivery is not confirmed.",
      channels,
    };
  }

  static async getPrivateReceiverEmail(phone: string): Promise<string | undefined> {
    const configuredEmail = process.env.PRIVATE_RECEIVER_EMAIL?.trim();
    if (configuredEmail) {
      return configuredEmail;
    }

    const normalizePhone = (value: string) =>
      value.replace(/\D/g, "").replace(/^250/, "0");
    try {
      const recipients = await prisma.notificationRecipient.findMany({
        where: {
          category: NotificationCategory.PRIVATE_RECEIVER,
          isActive: true,
          email: { not: null },
        },
        select: { phoneNumber: true, email: true },
      });
      const matchingRecipient = recipients.find(
        (recipient) =>
          normalizePhone(recipient.phoneNumber) === normalizePhone(phone),
      );

      return matchingRecipient?.email || process.env.ADMIN_EMAIL || undefined;
    } catch (error) {
      console.error("Could not look up private receiver email:", error);
      return process.env.ADMIN_EMAIL || undefined;
    }
  }

  private static failedDispatch(message: string): OTPDispatchResult {
    return {
      success: false,
      partial: false,
      message,
      channels: {
        sms: {
          status: "unavailable",
          deliveryStatus: "not_attempted",
          error: message,
        },
        email: {
          status: "unavailable",
          deliveryStatus: "not_attempted",
          error: message,
        },
      },
    };
  }

  static async sendRestaurantSignupOTP(
    phone: string,
    email?: string | null,
  ): Promise<OTPDispatchResult> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const restaurant = email
        ? null
        : await prisma.restaurant.findUnique({
            where: { phone },
            select: { email: true },
          });

      await prisma.oTP.deleteMany({
        where: { phone, purpose: "RESTAURANT_SIGNUP", verified: false },
      });

      await prisma.oTP.create({
        data: { phone, otp, purpose: "RESTAURANT_SIGNUP", expiresAt },
      });

      return await this.sendOTPNotification({
        phone,
        email: email || restaurant?.email,
        subject: "FoodBundles restaurant registration OTP",
        message: `Your FoodBundles restaurant registration OTP is ${otp}. It is valid for 48 hours. Do not share this code with anyone.`,
      });
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare restaurant signup OTP: ${error.message}`);
    }
  }

  static async verifyOTP(
    phone: string,
    otp: string,
    purpose: OTPPurpose,
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
  ): Promise<OTPDispatchResult> {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { phone: true, email: true },
      });

      if (!restaurant?.phone) {
        return this.failedDispatch("Restaurant phone number not found.");
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

      return await this.sendOTPNotification({
        phone: restaurant.phone,
        email: restaurant.email,
        subject: "FoodBundles voucher checkout OTP",
        message: `Your voucher checkout OTP is ${otp}. It is valid for 10 minutes. Do not share this code with anyone.`,
      });
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare voucher checkout OTP: ${error.message}`);
    }
  }

  /**
   * OTP sent to the restaurant when an admin places an order on its behalf
   * and pays with the restaurant's voucher or prepaid wallet. The restaurant
   * shares the code with the admin to confirm it authorizes the payment.
   */
  static async sendAdminOrderOTPToRestaurant(
    restaurantId: string,
    paymentMethod: "VOUCHER" | "CASH",
    amount: number,
  ): Promise<OTPDispatchResult & { phone?: string }> {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { phone: true, email: true },
      });

      if (!restaurant?.phone) {
        return {
          ...this.failedDispatch("Restaurant phone number not found."),
        };
      }

      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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

      const source = paymentMethod === "VOUCHER" ? "voucher" : "prepaid wallet";
      const result = await this.sendOTPNotification({
        phone: restaurant.phone,
        email: restaurant.email,
        subject: "FoodBundles order authorization OTP",
        message: `An order of ${amount.toLocaleString()} RWF is being placed for you and paid with your ${source}. Your confirmation code is ${otp}. Share it only with FoodBundles staff. It is valid for 10 minutes.`,
      });

      return {
        ...result,
        phone: restaurant.phone,
      };
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare order authorization OTP: ${error.message}`);
    }
  }

  /**
   * OTP sent to the restaurant when an admin pays its voucher (loan) from the
   * restaurant's prepaid wallet. The restaurant reads the code to the admin
   * to confirm it agrees to the wallet being debited.
   */
  static async sendVoucherRepaymentOTPToRestaurant(
    restaurantId: string,
    amount: number,
    rrn: string,
  ): Promise<OTPDispatchResult & { phone?: string }> {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { phone: true, email: true },
      });

      if (!restaurant?.phone) {
        return this.failedDispatch("Restaurant phone number not found.");
      }

      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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

      const result = await this.sendOTPNotification({
        phone: restaurant.phone,
        email: restaurant.email,
        subject: "FoodBundles voucher repayment authorization OTP",
        message: `${amount.toLocaleString()} RWF is about to be taken from your prepaid wallet to repay voucher ${rrn}. Your confirmation code is ${otp}. Share it only with FoodBundles staff. It is valid for 10 minutes.`,
      });

      return {
        ...result,
        phone: restaurant.phone,
      };
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare voucher repayment OTP: ${error.message}`);
    }
  }

  static async sendAdminWalletOTP(
    adminId: string,
    operationType: "DEPOSIT" | "ADJUSTMENT",
    amount: number,
    restaurantId?: string,
    restaurantName?: string,
    description?: string,
  ): Promise<OTPDispatchResult & { sessionId?: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const privateReceiver = process.env.PRIVATE_RECEIVER;

      if (!privateReceiver) {
        return this.failedDispatch("Private receiver not configured.");
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

      const receiverEmail = await this.getPrivateReceiverEmail(privateReceiver);
      const notification = await this.sendOTPNotification({
        phone: privateReceiver,
        email: receiverEmail,
        subject: `FoodBundles admin wallet ${operationType.toLowerCase()} OTP`,
        message: `Admin wallet ${operationType.toLowerCase()} OTP: ${otp}. Amount: ${amount} RWF${restaurantName ? ` for ${restaurantName}` : ""}. Valid for 10 minutes.`,
      });

      if (!notification.success) {
        return notification;
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
        ...notification,
        sessionId,
      };
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare admin wallet OTP: ${error.message}`);
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

  /**
   * Request OTP for a farmer submission payout (PayPack cashout). Mirrors
   * sendAdminWalletOTP exactly: OTP goes to PRIVATE_RECEIVER, not the
   * initiating admin, since cashout is an irreversible money movement that
   * should require the same second factor as admin wallet operations.
   */
  static async sendSubmissionPayoutOTP(
    adminId: string,
    submissionId: string,
    phoneNumber: string,
    amount: number,
    productName?: string,
  ): Promise<OTPDispatchResult & { sessionId?: string }> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const privateReceiver = process.env.PRIVATE_RECEIVER;

      if (!privateReceiver) {
        return this.failedDispatch("Private receiver not configured.");
      }

      await prisma.oTP.deleteMany({
        where: {
          phone: privateReceiver,
          purpose: "SUBMISSION_PAYOUT",
          verified: false,
        },
      });

      const otpRecord = await prisma.oTP.create({
        data: {
          phone: privateReceiver,
          otp,
          purpose: "SUBMISSION_PAYOUT",
          expiresAt,
        },
      });

      const receiverEmail = await this.getPrivateReceiverEmail(privateReceiver);
      const notification = await this.sendOTPNotification({
        phone: privateReceiver,
        email: receiverEmail,
        subject: "FoodBundles farmer submission payout OTP",
        message: `Farmer submission payout OTP: ${otp}. Amount: ${amount.toLocaleString()} RWF${productName ? ` for ${productName}` : ""}. Valid for 10 minutes.`,
      });

      if (!notification.success) {
        return notification;
      }

      const sessionId = Buffer.from(
        JSON.stringify({
          adminId,
          submissionId,
          phoneNumber,
          amount,
          otpId: otpRecord.id,
          timestamp: Date.now(),
        }),
      ).toString("base64");

      return {
        ...notification,
        sessionId,
      };
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare farmer submission payout OTP: ${error.message}`);
    }
  }

  static async sendPasswordResetOTP(
    phone: string,
    email?: string | null,
  ): Promise<OTPDispatchResult> {
    try {
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.oTP.deleteMany({
        where: { phone, purpose: "PASSWORD_RESET", verified: false },
      });

      await prisma.oTP.create({
        data: { phone, otp, purpose: "PASSWORD_RESET", expiresAt },
      });

      return await this.sendOTPNotification({
        phone,
        email,
        subject: "FoodBundles password reset OTP",
        message: `Your FoodBundles password reset OTP is ${otp}. It is valid for 10 minutes. Do not share this code with anyone.`,
      });
    } catch (error: any) {
      return this.failedDispatch(`Could not prepare password reset OTP: ${error.message}`);
    }
  }

  static async verifySubmissionPayoutOTP(
    otp: string,
    sessionId: string,
  ): Promise<{ success: boolean; message: string; sessionData?: any }> {
    try {
      const sessionData = JSON.parse(
        Buffer.from(sessionId, "base64").toString(),
      );

      const privateReceiver = process.env.PRIVATE_RECEIVER;
      if (!privateReceiver) {
        return { success: false, message: "Private receiver not configured" };
      }

      const otpRecord = await prisma.oTP.findFirst({
        where: {
          phone: privateReceiver,
          otp,
          purpose: OTPPurpose.SUBMISSION_PAYOUT,
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

  static async verifyPasswordResetOTP(
    phone: string,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.verifyOTP(phone, otp, "PASSWORD_RESET");
  }
}
