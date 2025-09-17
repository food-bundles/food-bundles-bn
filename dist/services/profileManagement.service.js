"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileManagementService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const location_service_1 = require("./location.service");
class ProfileManagementService {
    static async updatePhoneNumber(currentPhone, newPhone, verificationCode) {
        try {
            // Verify SMS code first
            const isValidCode = await this.verifySMSCode(newPhone, verificationCode);
            if (!isValidCode)
                return false;
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: currentPhone },
            });
            if (!farmer)
                return false;
            // Check if new phone already exists
            const existingFarmer = await prisma_1.default.farmer.findUnique({
                where: { phone: newPhone },
            });
            if (existingFarmer)
                return false;
            // Update phone number and log change
            await prisma_1.default.farmer.update({
                where: { id: farmer.id },
                data: {
                    phone: newPhone,
                    phoneVerified: true,
                    phoneChangedAt: new Date(),
                },
            });
            await prisma_1.default.farmerSecurityEvent.create({
                data: {
                    farmerId: farmer.id,
                    eventType: "PHONE_CHANGE",
                    description: `Phone changed from ${currentPhone} to ${newPhone}`,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Phone update error:", error);
            return false;
        }
    }
    static async updateLocation(phoneNumber, newLocation) {
        try {
            // Validate location hierarchy
            const validation = location_service_1.LocationValidationService.validateLocationHierarchy(newLocation);
            if (!validation.isValid)
                return false;
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            await prisma_1.default.farmer.update({
                where: { id: farmer.id },
                data: {
                    ...newLocation,
                    locationUpdatedAt: new Date(),
                },
            });
            // Update default submission location
            await prisma_1.default.farmerProfile.upsert({
                where: { farmerId: farmer.id },
                update: { defaultLocation: newLocation },
                create: {
                    farmerId: farmer.id,
                    defaultLocation: newLocation,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Location update error:", error);
            return false;
        }
    }
    static async updateCommunicationPreferences(phoneNumber, preferences) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            await prisma_1.default.farmer.update({
                where: { id: farmer.id },
                data: {
                    preferredLanguage: preferences.language,
                    smsNotifications: preferences.smsNotifications,
                    notificationFrequency: preferences.notificationFrequency,
                },
            });
            return true;
        }
        catch (error) {
            console.error("Communication preferences update error:", error);
            return false;
        }
    }
    static async verifySMSCode(phone, code) {
        // TODO: Implement SMS verification logic
        return code === "1234"; // Placeholder
    }
}
exports.ProfileManagementService = ProfileManagementService;
