import prisma from "../prisma";

export class AnalyticsEarningsService {
  static async getIncomesSummary(phoneNumber: string): Promise<any> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return null;

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const [thisMonth, previousMonth, yearToDate] = await Promise.all([
        this.getEarningsForPeriod(farmer.id, currentMonth, now),
        this.getEarningsForPeriod(farmer.id, lastMonth, currentMonth),
        this.getEarningsForPeriod(farmer.id, yearStart, now),
      ]);

      const avgPerSubmission = await this.getAveragePerSubmission(farmer.id);

      return {
        thisMonth,
        lastMonth: previousMonth,
        yearToDate,
        avgPerSubmission,
      };
    } catch (error) {
      console.error("Income summary error:", error);
      return null;
    }
  }

  static async getPerformanceMetrics(phoneNumber: string): Promise<any> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return null;

      const [acceptanceRate, avgPrice, topProducts, seasonalTrends] =
        await Promise.all([
          this.getAcceptanceRate(farmer.id),
          this.getAveragePrice(farmer.id),
          this.getTopPerformingProducts(farmer.id),
          this.getSeasonalTrends(farmer.id),
        ]);

      return {
        acceptanceRate,
        avgPrice,
        topProducts,
        seasonalTrends,
      };
    } catch (error) {
      console.error("Performance metrics error:", error);
      return null;
    }
  }

  static async getComparisonAnalytics(phoneNumber: string): Promise<any> {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return null;

      const province = farmer?.province ?? "";
      const district = farmer?.district ?? "";

      const [regionalAvg, previousYearComparison, marketPosition] =
        await Promise.all([
          this.getRegionalAverage(province, district),
          this.getPreviousYearComparison(farmer.id),
          this.getMarketPositionRanking(farmer.id, province, district),
        ]);

      return {
        regionalAverage: regionalAvg,
        previousYear: previousYearComparison,
        marketPosition,
      };
    } catch (error) {
      console.error("Comparison analytics error:", error);
      return null;
    }
  }

  static async getPaymentHistory(
    phoneNumber: string,
    limit: number = 10
  ): Promise<
    | {
        recentPayments: any[];
        pendingAmount: number;
        pendingCount: number;
      }
    | []
  > {
    try {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) return [];

      const payments = await prisma.farmerSubmission.findMany({
        where: {
          farmerId: farmer.id,
          status: "PAID",
        },
        select: {
          id: true,
          productName: true,
          acceptedQty: true,
          acceptedPrice: true,
          totalAmount: true,
          paidAt: true,
          paymentMethod: true,
        },
        orderBy: { paidAt: "desc" },
        take: limit,
      });

      // Get pending payments
      const pendingPayments = await prisma.farmerSubmission.findMany({
        where: {
          farmerId: farmer.id,
          status: "APPROVED",
        },
        select: {
          id: true,
          productName: true,
          acceptedQty: true,
          acceptedPrice: true,
          totalAmount: true,
          approvedAt: true,
        },
        orderBy: { approvedAt: "desc" },
      });

      const totalPending = pendingPayments.reduce(
        (sum, payment) => sum + (payment.totalAmount || 0),
        0
      );

      return {
        recentPayments: payments,
        pendingAmount: totalPending,
        pendingCount: pendingPayments.length,
      };
    } catch (error) {
      console.error("Payment history error:", error);
      return [];
    }
  }

  private static async getEarningsForPeriod(
    farmerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await prisma.farmerSubmission.aggregate({
      where: {
        farmerId,
        status: "PAID",
        paidAt: {
          gte: startDate,
          lt: endDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
    });

    return result._sum.totalAmount || 0;
  }

  private static async getAveragePerSubmission(
    farmerId: string
  ): Promise<number> {
    const result = await prisma.farmerSubmission.aggregate({
      where: {
        farmerId,
        status: "PAID",
      },
      _avg: {
        totalAmount: true,
      },
    });

    return result._avg.totalAmount || 0;
  }

  private static async getAcceptanceRate(farmerId: string): Promise<number> {
    const [total, accepted] = await Promise.all([
      prisma.farmerSubmission.count({ where: { farmerId } }),
      prisma.farmerSubmission.count({
        where: {
          farmerId,
          status: { in: ["APPROVED", "PAID"] },
        },
      }),
    ]);

    return total > 0 ? (accepted / total) * 100 : 0;
  }

  private static async getAveragePrice(farmerId: string): Promise<number> {
    const result = await prisma.farmerSubmission.aggregate({
      where: {
        farmerId,
        status: { in: ["APPROVED", "PAID"] },
      },
      _avg: {
        acceptedPrice: true,
      },
    });

    return result._avg.acceptedPrice || 0;
  }

  private static async getTopPerformingProducts(
    farmerId: string
  ): Promise<any[]> {
    const result = await prisma.farmerSubmission.groupBy({
      by: ["productName"],
      where: {
        farmerId,
        status: "PAID",
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        productName: true,
      },
      orderBy: [
        {
          _sum: {
            totalAmount: "desc",
          },
        },
      ],
      take: 5,
    });
    return result;
  }

  private static async getSeasonalTrends(farmerId: string): Promise<any[]> {
    // Get monthly earnings for the last 12 months
    const monthlyEarnings = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "paidAt") as month,
        EXTRACT(YEAR FROM "paidAt") as year,
        SUM("totalAmount") as earnings
      FROM "FarmerSubmission"
      WHERE "farmerId" = ${farmerId}
        AND "status" = 'PAID'
        AND "paidAt" >= NOW() - INTERVAL '12 months'
      GROUP BY EXTRACT(YEAR FROM "paidAt"), EXTRACT(MONTH FROM "paidAt")
      ORDER BY year, month
    `;

    return monthlyEarnings as any[];
  }

  private static async getRegionalAverage(
    province: string,
    district: string
  ): Promise<number> {
    const result = await prisma.farmerSubmission.aggregate({
      where: {
        province,
        district,
        status: "PAID",
        paidAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _avg: {
        totalAmount: true,
      },
    });

    return result._avg.totalAmount || 0;
  }

  private static async getPreviousYearComparison(
    farmerId: string
  ): Promise<any> {
    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(currentYear, 0, 1);
    const previousYearStart = new Date(currentYear - 1, 0, 1);
    const previousYearEnd = new Date(currentYear, 0, 1);

    const [currentYearEarnings, previousYearEarnings] = await Promise.all([
      this.getEarningsForPeriod(farmerId, currentYearStart, new Date()),
      this.getEarningsForPeriod(farmerId, previousYearStart, previousYearEnd),
    ]);

    const growthRate =
      previousYearEarnings > 0
        ? ((currentYearEarnings - previousYearEarnings) /
            previousYearEarnings) *
          100
        : 0;

    return {
      currentYear,
      previousYear: previousYearEarnings,
      growthRate,
    };
  }

  private static async getMarketPositionRanking(
    farmerId: string,
    province: string,
    district: string
  ): Promise<number> {
    // Get farmer's total earnings
    const farmerEarnings = await this.getEarningsForPeriod(
      farmerId,
      new Date(new Date().getFullYear(), 0, 1),
      new Date()
    );

    // Count farmers with higher earnings in the same district
    const higherEarners = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "farmerId") as count
      FROM "FarmerSubmission"
      WHERE "province" = ${province}
        AND "district" = ${district}
        AND "status" = 'PAID'
        AND "farmerId" != ${farmerId}
        AND "paidAt" >= ${new Date(new Date().getFullYear(), 0, 1)}
      GROUP BY "farmerId"
      HAVING SUM("totalAmount") > ${farmerEarnings}
    `;

    return (higherEarners as any[]).length + 1;
  }
}
