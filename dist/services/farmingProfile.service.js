"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmingProfileService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class FarmingProfileService {
    static async updatePrimaryCrops(phoneNumber, crops) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            // Clear existing primary crops
            await prisma_1.default.farmerPrimaryCrop.deleteMany({
                where: { farmerId: farmer.id },
            });
            // Add new primary crops
            await prisma_1.default.farmerPrimaryCrop.createMany({
                data: crops.map((crop) => ({
                    farmerId: farmer.id,
                    ...crop,
                })),
            });
            return true;
        }
        catch (error) {
            console.error("Primary crops update error:", error);
            return false;
        }
    }
    static async updateFarmInformation(phoneNumber, farmInfo) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            await prisma_1.default.farmerProfile.upsert({
                where: { farmerId: farmer.id },
                update: farmInfo,
                create: {
                    farmerId: farmer.id,
                    ...farmInfo,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Farm information update error:", error);
            return false;
        }
    }
    static async updateBusinessPreferences(phoneNumber, preferences) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            await prisma_1.default.farmerProfile.upsert({
                where: { farmerId: farmer.id },
                update: preferences,
                create: {
                    farmerId: farmer.id,
                    ...preferences,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Business preferences update error:", error);
            return false;
        }
    }
    static async getFarmingProfile(farmerId) {
        console.log("Fetching farming profile for id:", farmerId);
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
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
            return farmer;
        }
        catch (error) {
            console.error("Error fetching farming profile:", error);
            return null;
        }
    }
}
exports.FarmingProfileService = FarmingProfileService;
