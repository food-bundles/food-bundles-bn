import prisma from "../prisma";

export class FarmingProfileService {
  static async updatePrimaryCrops(
    phoneNumber: string,
    crops: Array<{
      productId: string;
      seasonal: boolean;
      defaultQuantity: number;
      harvestMonths?: string[];
    }>
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      // Clear existing primary crops
      await prisma.farmerPrimaryCrop.deleteMany({
        where: { farmerId: farmer.id },
      });

      // Add new primary crops
      await prisma.farmerPrimaryCrop.createMany({
        data: crops.map((crop) => ({
          farmerId: farmer.id,
          ...crop,
        })),
      });

      return true;
    } catch (error) {
      console.error("Primary crops update error:", error);
      return false;
    }
  }

  static async updateFarmInformation(
    phoneNumber: string,
    farmInfo: {
      farmSize?: number;
      farmSizeUnit?: "HECTARES" | "ACRES";
      experienceYears?: number;
      cooperativeMember?: boolean;
      cooperativeName?: string;
      certifications?: string[];
      farmingMethod?: "ORGANIC" | "CONVENTIONAL" | "MIXED";
    }
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      await prisma.farmerProfile.upsert({
        where: { farmerId: farmer.id },
        update: farmInfo,
        create: {
          farmerId: farmer.id,
          ...farmInfo,
        },
      });

      return true;
    } catch (error) {
      console.error("Farm information update error:", error);
      return false;
    }
  }

  static async updateBusinessPreferences(
    phoneNumber: string,
    preferences: {
      preferredPaymentMethod?: "MOBILE_MONEY" | "BANK_TRANSFER" | "CASH";
      minimumOrderQuantity?: number;
      deliveryPreference?:
        | "FARM_PICKUP"
        | "COOPERATIVE_CENTER"
        | "MARKET_DELIVERY";
      maxDeliveryDistance?: number;
    }
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      await prisma.farmerProfile.upsert({
        where: { farmerId: farmer.id },
        update: preferences,
        create: {
          farmerId: farmer.id,
          ...preferences,
        },
      });

      return true;
    } catch (error) {
      console.error("Business preferences update error:", error);
      return false;
    }
  }

  static async getFarmingProfile(phoneNumber: string): Promise<any | null> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
        include: {
          FarmerProfile: true,
          FarmerPrimaryCrop: {
            include: {
              product: true,
            },
          },
        },
      });

      return farmer;
    } catch (error) {
      console.error("Error fetching farming profile:", error);
      return null;
    }
  }
}
