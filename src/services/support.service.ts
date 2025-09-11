import prisma from "../prisma";

export class SupportService {
  static async submitSupportTicket(
    phoneNumber: string,
    issue: {
      category: "TECHNICAL" | "PAYMENT" | "ACCOUNT" | "GENERAL";
      description: string;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    }
  ): Promise<string | null> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return null;

      const ticketNumber = this.generateTicketNumber();

      await prisma.supportTicket.create({
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
      await this.sendTicketCreatedSMS(
        phoneNumber,
        ticketNumber,
        farmer.preferredLanguage || undefined
      );

      return ticketNumber;
    } catch (error) {
      console.error("Support ticket submission error:", error);
      return null;
    }
  }

  static async getTicketStatus(
    phoneNumber: string,
    ticketNumber: string
  ): Promise<any | null> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return null;

      const ticket = await prisma.supportTicket.findFirst({
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
    } catch (error) {
      console.error("Ticket status fetch error:", error);
      return null;
    }
  }

  static async requestCallback(
    phoneNumber: string,
    preferredTime: string,
    issue: string
  ): Promise<boolean> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return false;

      await prisma.callbackRequest.create({
        data: {
          farmerId: farmer.id,
          phoneNumber,
          preferredTime,
          issue,
          status: "PENDING",
        },
      });

      return true;
    } catch (error) {
      console.error("Callback request error:", error);
      return false;
    }
  }

  static async getSystemStatus(): Promise<any> {
    try {
      // Check various system components
      const [dbStatus, smsStatus, paymentStatus] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkSMSServiceHealth(),
        this.checkPaymentServiceHealth(),
      ]);

      return {
        overall:
          dbStatus && smsStatus && paymentStatus ? "OPERATIONAL" : "DEGRADED",
        database: dbStatus ? "UP" : "DOWN",
        sms: smsStatus ? "UP" : "DOWN",
        payments: paymentStatus ? "UP" : "DOWN",
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error("System status check error:", error);
      return {
        overall: "DOWN",
        lastUpdated: new Date(),
      };
    }
  }

  static getFAQs(language: "KINY" | "ENG" | "FRE" = "KINY"): any[] {
    const faqs = {
      KINY: [
        {
          question: "Nigute nshobora guhindura PIN yanjye?",
          answer: "Kanda 3 -> 4 -> andika PIN ya kijeshi -> andika PIN nshya",
        },
        {
          question: "Ibiciro byanjye bifatwa ryari?",
          answer: "Ibiciro bifatwa mu minsi 7-10 nyuma yo kwemererwa.",
        },
        {
          question: "Nigute nshobora kureba amateka y'ibicuruzwa byanjye?",
          answer: "Kanda 3 -> 1 -> andika PIN yawe",
        },
      ],
      ENG: [
        {
          question: "How do I change my PIN?",
          answer: "Press 3 -> 4 -> enter old PIN -> enter new PIN",
        },
        {
          question: "When do I get paid for my products?",
          answer: "Payments are processed within 7-10 days after approval.",
        },
        {
          question: "How can I view my submission history?",
          answer: "Press 3 -> 1 -> enter your PIN",
        },
      ],
      FRE: [
        {
          question: "Comment changer mon PIN?",
          answer:
            "Appuyez sur 3 -> 4 -> entrez l'ancien PIN -> entrez le nouveau PIN",
        },
        {
          question: "Quand suis-je payé pour mes produits?",
          answer:
            "Les paiements sont traités dans les 7-10 jours après approbation.",
        },
        {
          question: "Comment voir mon historique de soumissions?",
          answer: "Appuyez sur 3 -> 1 -> entrez votre PIN",
        },
      ],
    };

    return faqs[language] || faqs.ENG;
  }

  private static generateTicketNumber(): string {
    return `FB${Date.now().toString().slice(-8)}`;
  }

  private static async sendTicketCreatedSMS(
    phoneNumber: string,
    ticketNumber: string,
    language?: string
  ): Promise<void> {
    // TODO: Implement SMS sending logic
    console.log(`SMS sent to ${phoneNumber} for ticket ${ticketNumber}`);
  }

  private static async checkDatabaseHealth(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private static async checkSMSServiceHealth(): Promise<boolean> {
    // TODO: Implement SMS service health check
    return true; // Placeholder
  }

  private static async checkPaymentServiceHealth(): Promise<boolean> {
    // TODO: Implement payment service health check
    return true; // Placeholder
  }
}
