"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinManagementService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const password_1 = require("../utils/password");
class PinManagementService {
    static async changePIN(phoneNumber, oldPin, newPin) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer || !(0, password_1.comparePassword)(oldPin, farmer.password)) {
                return false;
            }
            const hashedNewPin = await (0, password_1.hashPassword)(newPin);
            // Log PIN change for security history
            await prisma_1.default.farmerSecurityEvent.create({
                data: {
                    farmerId: farmer.id,
                    eventType: "PIN_CHANGE",
                    ipAddress: null,
                    deviceInfo: null,
                },
            });
            await prisma_1.default.farmer.update({
                where: { id: farmer.id },
                data: {
                    password: hashedNewPin,
                    pinChangedAt: new Date(),
                },
            });
            return true;
        }
        catch (error) {
            console.error("PIN change error:", error);
            return false;
        }
    }
    static async getPinChangeHistory(phoneNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
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
        }
        catch (error) {
            console.error("Error fetching PIN history:", error);
            return [];
        }
    }
    static async setupSecurityQuestions(phoneNumber, questions) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            // Hash security answers
            const hashedQuestions = await Promise.all(questions.map(async (q) => ({
                farmerId: farmer.id,
                question: q.question,
                answerHash: await (0, password_1.hashPassword)(q.answer.toLowerCase()),
            })));
            await prisma_1.default.farmerSecurityQuestion.createMany({
                data: hashedQuestions,
            });
            return true;
        }
        catch (error) {
            console.error("Security questions setup error:", error);
            return false;
        }
    }
}
exports.PinManagementService = PinManagementService;
