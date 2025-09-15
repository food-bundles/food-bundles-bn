"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupportService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class SupportService {
    static async submitSupportTicket(phoneNumber, issue) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return null;
            const ticketNumber = this.generateTicketNumber();
            await prisma_1.default.supportTicket.create({
                data: {
                    ticketNumber,
                    farmerId: farmer.id,
                    category: issue.category,
                    description: issue.description,
                    priority: issue.priority,
                    status: "OPEN",
                },
            });
            // Send SMS notification about ticket creation
            await this.sendTicketCreatedSMS(phoneNumber, ticketNumber, farmer.preferredLanguage || undefined);
            return ticketNumber;
        }
        catch (error) {
            console.error("Support ticket submission error:", error);
            return null;
        }
    }
    static async getTicketStatus(phoneNumber, ticketNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return null;
            const ticket = await prisma_1.default.supportTicket.findFirst({
                where: {
                    ticketNumber,
                    farmerId: farmer.id,
                },
                include: {
                    responses: {
                        orderBy: { createdAt: "asc" },
                    },
                },
            });
            return ticket;
        }
        catch (error) {
            console.error("Ticket status fetch error:", error);
            return null;
        }
    }
    static async requestCallback(phoneNumber, preferredTime, issue) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return false;
            await prisma_1.default.callbackRequest.create({
                data: {
                    farmerId: farmer.id,
                    phoneNumber,
                    preferredTime,
                    issue,
                    status: "PENDING",
                },
            });
            return true;
        }
        catch (error) {
            console.error("Callback request error:", error);
            return false;
        }
    }
    static async getSystemStatus() {
        try {
            // Check various system components
            const [dbStatus, smsStatus, paymentStatus] = await Promise.all([
                this.checkDatabaseHealth(),
                this.checkSMSServiceHealth(),
                this.checkPaymentServiceHealth(),
            ]);
            return {
                overall: dbStatus && smsStatus && paymentStatus ? "OPERATIONAL" : "DEGRADED",
                database: dbStatus ? "UP" : "DOWN",
                sms: smsStatus ? "UP" : "DOWN",
                payments: paymentStatus ? "UP" : "DOWN",
                lastUpdated: new Date(),
            };
        }
        catch (error) {
            console.error("System status check error:", error);
            return {
                overall: "DOWN",
                lastUpdated: new Date(),
            };
        }
    }
    static getFAQs(language = "KINY") {
        const faqs = {
            KINY: [
                {
                    question: "Nigute nshobora guhindura PIN yanjye?",
                    answer: "Ujya ahabanza -> Konti yanjye -> Amategeko y'umutekano -> Guhindura PIN -> andika PIN ya isanzwe -> andika PIN nshya",
                },
                {
                    question: "Ibiciro byanjye bifatwa ryari?",
                    answer: "Ibiciro bifatwa mu minsi 1-2 nyuma yo kwemererwa.",
                },
                {
                    question: "Nigute nshobora kureba amateka y'ibicuruzwa byanjye?",
                    answer: "Ujya ahabanza -> Konti yanjye -> Reba ibyohererejwe -> andika PIN yawe",
                },
            ],
            ENG: [
                {
                    question: "How do I change my PIN?",
                    answer: "Go to Main Menu -> My Account -> Security Settings -> Change PIN -> enter old PIN -> enter new PIN",
                },
                {
                    question: "When do I get paid for my products?",
                    answer: "Payments are processed within 1-2 days after approval.",
                },
                {
                    question: "How can I view my submission history?",
                    answer: "Go to Main Menu -> My Account -> Check Submissions -> enter your PIN",
                },
            ],
            FRE: [
                {
                    question: "Comment changer mon PIN?",
                    answer: "Aller au menu principal -> Mon compte -> Paramètres de sécurité -> Changer le PIN -> entrez l'ancien PIN -> entrez le nouveau PIN",
                },
                {
                    question: "Quand suis-je payé pour mes produits?",
                    answer: "Les paiements sont traités dans les 1-2 jours après approbation.",
                },
                {
                    question: "Comment voir mon historique de soumissions?",
                    answer: "Aller au menu principal -> Mon compte -> Vérifier les soumissions -> entrez votre PIN",
                },
            ],
        };
        return faqs[language] || faqs.ENG;
    }
    static generateTicketNumber() {
        return `FB${Date.now().toString().slice(-8)}`;
    }
    static async sendTicketCreatedSMS(phoneNumber, ticketNumber, language) {
        // TODO: Implement SMS sending logic
        console.log(`SMS sent to ${phoneNumber} for ticket ${ticketNumber}`);
    }
    static async checkDatabaseHealth() {
        try {
            await prisma_1.default.$queryRaw `SELECT 1`;
            return true;
        }
        catch {
            return false;
        }
    }
    static async checkSMSServiceHealth() {
        // TODO: Implement SMS service health check
        return true; // Placeholder
    }
    static async checkPaymentServiceHealth() {
        // TODO: Implement payment service health check
        return true; // Placeholder
    }
}
exports.SupportService = SupportService;
