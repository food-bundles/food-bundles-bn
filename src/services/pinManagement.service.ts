import prisma from "../prisma";
import bcrypt from "bcrypt";
import { comparePassword, hashPassword } from "../utils/password";
import { sendMessage } from "../utils/sms.utility";

export class PinManagementService {
  static async changePIN(
    phoneNumber: string,
    oldPin: string,
    newPin: string
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer || !comparePassword(oldPin, farmer.password!)) {
        return false;
      }

      const hashedNewPin = await hashPassword(newPin);

      // Log PIN change for security history
      await prisma.farmerSecurityEvent.create({
        data: {
          farmerId: farmer.id,
          eventType: "PIN_CHANGE",
          ipAddress: null,
          deviceInfo: null,
        },
      });

      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          password: hashedNewPin,
          pinChangedAt: new Date(),
        },
      });

      // Notify the farmer (SMS, minimal wording) so they have a chance to
      // catch an unauthorized PIN change — previously completely silent.
      try {
        if (farmer.phone) {
          await sendMessage(
            "Your Food Bundles account PIN was changed. If this wasn't you, contact support immediately.",
            farmer.phone,
          );
        }
      } catch (notifyError) {
        console.error("Failed to send PIN change notification:", notifyError);
      }

      return true;
    } catch (error) {
      console.error("PIN change error:", error);
      return false;
    }
  }

  static async getPinChangeHistory(phoneNumber: string): Promise<any[]> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
        include: {
          FarmerSecurityEvent: {
            where: { eventType: "PIN_CHANGE" },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      });

      return farmer?.FarmerSecurityEvent || [];
    } catch (error) {
      console.error("Error fetching PIN history:", error);
      return [];
    }
  }

  static async setupSecurityQuestions(
    phoneNumber: string,
    questions: Array<{ question: string; answer: string }>
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      // Hash security answers
      const hashedQuestions = await Promise.all(
        questions.map(async (q) => ({
          farmerId: farmer.id,
          question: q.question,
          answerHash: await hashPassword(q.answer.toLowerCase()),
        }))
      );

      await prisma.farmerSecurityQuestion.createMany({
        data: hashedQuestions,
      });

      return true;
    } catch (error) {
      console.error("Security questions setup error:", error);
      return false;
    }
  }
}
