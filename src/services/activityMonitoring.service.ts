import prisma from "../prisma";

export class ActivityMonitoringService {
  static async logLoginAttempt(
    phoneNumber: string,
    success: boolean,
    deviceInfo?: string
  ): Promise<void> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (farmer) {
        await prisma.farmerLoginAttempt.create({
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
    } catch (error) {
      console.error("Login attempt logging error:", error);
    }
  }

  static async checkSuspiciousActivity(farmerId: string): Promise<void> {
    try {
      // Check failed attempts in last hour
      const failedAttempts = await prisma.farmerLoginAttempt.count({
        where: {
          farmerId,
          successful: false,
          attemptTime: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      if (failedAttempts >= 5) {
        await prisma.farmerSecurityAlert.create({
          data: {
            farmerId,
            alertType: "MULTIPLE_FAILED_LOGINS",
            description: `${failedAttempts} failed login attempts in the last hour`,
            severity: "HIGH",
          },
        });

        // Lock account temporarily
        await prisma.farmer.update({
          where: { id: farmerId },
          data: {
            accountLocked: true,
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          },
        });
      }
    } catch (error) {
      console.error("Suspicious activity check error:", error);
    }
  }

  static async getRecentActivity(phoneNumber: string): Promise<any[]> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
        include: {
          FarmerLoginAttempt: {
            orderBy: { attemptTime: "desc" },
            take: 10,
          },
        },
      });

      return farmer?.FarmerLoginAttempt || [];
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      return [];
    }
  }
}
