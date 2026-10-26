import prisma from "../prisma";
import { farmerWhere } from "../utils/farmerKey";

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
        where: farmerWhere(phoneNumber),
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

  /**
   * Sets the farmer's crops to exactly `productIds`. Crops that stay keep their
   * row (default quantity, harvest months); only removed/added ones change.
   * Returns null when a productId is unknown or inactive.
   */
  static async setPrimaryCropsById(
    farmerId: string,
    productIds: string[]
  ): Promise<{ ok: true } | { ok: false; invalidIds: string[] }> {
    const wanted = [...new Set(productIds)];

    const products = await prisma.product.findMany({
      where: { id: { in: wanted }, status: "ACTIVE" },
      select: { id: true },
    });
    const validIds = new Set(products.map((p) => p.id));
    const invalidIds = wanted.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) return { ok: false, invalidIds };

    const existing = await prisma.farmerPrimaryCrop.findMany({
      where: { farmerId },
      select: { productId: true },
    });
    const existingIds = new Set(existing.map((c) => c.productId));

    await prisma.$transaction([
      prisma.farmerPrimaryCrop.deleteMany({
        where: { farmerId, productId: { notIn: wanted } },
      }),
      prisma.farmerPrimaryCrop.createMany({
        data: wanted
          .filter((id) => !existingIds.has(id))
          .map((productId) => ({
            farmerId,
            productId,
            seasonal: false,
            defaultQuantity: 0,
            harvestMonths: [],
          })),
      }),
    ]);

    return { ok: true };
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
        where: farmerWhere(phoneNumber),
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
        where: farmerWhere(phoneNumber),
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

  static async getFarmingProfile(farmerId: string): Promise<any | null> {
    console.log("Fetching farming profile for id:", farmerId);
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { id: farmerId },
        include: {
          FarmerProfile: true,
          FarmerPrimaryCrop: {
            include: {
              product: true,
            },
          },
        },
      });

      // Ensure FarmerProfile exists or create empty object
      if (farmer && !farmer.FarmerProfile) {
        farmer.FarmerProfile = {
          id: farmer.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          farmerId: farmer.id,
          farmSize: null,
          farmSizeUnit: null,
          experienceYears: null,
          cooperativeMember: false,
          cooperativeName: null,
          certifications: [],
          farmingMethod: null,
          defaultLocation: null,
          preferredPaymentMethod: null,
          minimumOrderQuantity: null,
          deliveryPreference: null,
          maxDeliveryDistance: null,
        };
      }

      if (!farmer) return null;
      // Never hand credentials out: this object goes straight into API responses and logs
      const { password, twoFactorSecret, twoFactorBackupCodes, ...safeFarmer } = farmer;
      return safeFarmer;
    } catch (error) {
      console.error("Error fetching farming profile:", error);
      return null;
    }
  }
}
