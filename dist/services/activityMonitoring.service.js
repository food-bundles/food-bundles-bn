"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityMonitoringService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class ActivityMonitoringService {
    static async logLoginAttempt(phoneNumber, success, deviceInfo) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (farmer) {
                await prisma_1.default.farmerLoginAttempt.create({
                    data: {
                        farmerId: farmer.id,
                        successful: success,
                        attemptTime: new Date(),
                        deviceInfo: deviceInfo || null,
                    },
                });
                // Check for suspicious activity
                await this.checkSuspiciousActivity(farmer.id);
            }
        }
        catch (error) {
            console.error("Login attempt logging error:", error);
        }
    }
    static async checkSuspiciousActivity(farmerId) {
        try {
            // Check failed attempts in last hour
            const failedAttempts = await prisma_1.default.farmerLoginAttempt.count({
                where: {
                    farmerId,
                    successful: false,
                    attemptTime: {
                        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
                    },
                },
            });
            if (failedAttempts >= 5) {
                await prisma_1.default.farmerSecurityAlert.create({
                    data: {
                        farmerId,
                        alertType: "MULTIPLE_FAILED_LOGINS",
                        description: `${failedAttempts} failed login attempts in the last hour`,
                        severity: "HIGH",
                    },
                });
                // Lock account temporarily
                await prisma_1.default.farmer.update({
                    where: { id: farmerId },
                    data: {
                        accountLocked: true,
                        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
                    },
                });
            }
        }
        catch (error) {
            console.error("Suspicious activity check error:", error);
        }
    }
    static async getRecentActivity(phoneNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
                include: {
                    FarmerLoginAttempt: {
                        orderBy: { attemptTime: "desc" },
                        take: 10,
                    },
                },
            });
            return farmer?.FarmerLoginAttempt || [];
        }
        catch (error) {
            console.error("Error fetching recent activity:", error);
            return [];
        }
    }
}
exports.ActivityMonitoringService = ActivityMonitoringService;
