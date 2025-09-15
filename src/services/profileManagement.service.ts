import prisma from "../prisma";
import { LocationValidationService } from "./location.service";

export class ProfileManagementService {
  static async updatePhoneNumber(
    currentPhone: string,
    newPhone: string,
    verificationCode: string
  ): Promise<boolean> {
    try {
      // Verify SMS code first
      const isValidCode = await this.verifySMSCode(newPhone, verificationCode);
      if (!isValidCode) return false;

      const farmer = await prisma.farmer.findUnique({
        where: { phone: currentPhone },
      });

      if (!farmer) return false;

      // Check if new phone already exists
      const existingFarmer = await prisma.farmer.findUnique({
        where: { phone: newPhone },
      });

      if (existingFarmer) return false;

      // Update phone number and log change
      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          phone: newPhone,
          phoneVerified: true,
          phoneChangedAt: new Date(),
        },
      });

      await prisma.farmerSecurityEvent.create({
        data: {
          farmerId: farmer.id,
          eventType: "PHONE_CHANGE",
          description: `Phone changed from ${currentPhone} to ${newPhone}`,
        },
      });

      return true;
    } catch (error) {
      console.error("Phone update error:", error);
      return false;
    }
  }

  static async updateLocation(
    phoneNumber: string,
    newLocation: {
      province: string;
      district: string;
      sector: string;
      cell: string;
      village: string;
    }
  ): Promise<boolean> {
    try {
      // Validate location hierarchy
      const validation =
        LocationValidationService.validateLocationHierarchy(newLocation);
      if (!validation.isValid) return false;

      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          ...newLocation,
          locationUpdatedAt: new Date(),
        },
      });

      // Update default submission location
      await prisma.farmerProfile.upsert({
        where: { farmerId: farmer.id },
        update: { defaultLocation: newLocation },
        create: {
          farmerId: farmer.id,
          defaultLocation: newLocation,
        },
      });

      return true;
    } catch (error) {
      console.error("Location update error:", error);
      return false;
    }
  }

  static async updateCommunicationPreferences(
    phoneNumber: string,
    preferences: {
      smsNotifications: boolean;
      language: "KINY" | "ENG" | "FRE";
      notificationFrequency: "IMMEDIATE" | "DAILY" | "WEEKLY";
    }
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      await prisma.farmer.update({
        where: { id: farmer.id },
        data: {
          preferredLanguage: preferences.language,
          smsNotifications: preferences.smsNotifications,
          notificationFrequency: preferences.notificationFrequency,
        },
      });

      return true;
    } catch (error) {
      console.error("Communication preferences update error:", error);
      return false;
    }
  }

  private static async verifySMSCode(
    phone: string,
    code: string
  ): Promise<boolean> {
    // TODO: Implement SMS verification logic

    return code === "1234"; // Placeholder
  }
}
