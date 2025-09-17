"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsEarningsService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
class AnalyticsEarningsService {
    static async getIncomesSummary(phoneNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return null;
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
        }
        catch (error) {
            console.error("Income summary error:", error);
            return null;
        }
    }
    static async getPerformanceMetrics(phoneNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return null;
            const [acceptanceRate, avgPrice, topProducts, seasonalTrends] = await Promise.all([
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
        }
        catch (error) {
            console.error("Performance metrics error:", error);
            return null;
        }
    }
    static async getComparisonAnalytics(phoneNumber) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return null;
            const province = farmer?.province ?? "";
            const district = farmer?.district ?? "";
            const [regionalAvg, previousYearComparison, marketPosition] = await Promise.all([
                this.getRegionalAverage(province, district),
                this.getPreviousYearComparison(farmer.id),
                this.getMarketPositionRanking(farmer.id, province, district),
            ]);
            return {
                regionalAverage: regionalAvg,
                previousYear: previousYearComparison,
                marketPosition,
            };
        }
        catch (error) {
            console.error("Comparison analytics error:", error);
            return null;
        }
    }
    static async getPaymentHistory(phoneNumber, limit = 10) {
        try {
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer)
                return [];
            const payments = await prisma_1.default.farmerSubmission.findMany({
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
            const pendingPayments = await prisma_1.default.farmerSubmission.findMany({
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
            const totalPending = pendingPayments.reduce((sum, payment) => sum + (payment.totalAmount || 0), 0);
            return {
                recentPayments: payments,
                pendingAmount: totalPending,
                pendingCount: pendingPayments.length,
            };
        }
        catch (error) {
            console.error("Payment history error:", error);
            return [];
        }
    }
    static async getEarningsForPeriod(farmerId, startDate, endDate) {
        const result = await prisma_1.default.farmerSubmission.aggregate({
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
    static async getAveragePerSubmission(farmerId) {
        const result = await prisma_1.default.farmerSubmission.aggregate({
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
    static async getAcceptanceRate(farmerId) {
        const [total, accepted] = await Promise.all([
            prisma_1.default.farmerSubmission.count({ where: { farmerId } }),
            prisma_1.default.farmerSubmission.count({
                where: {
                    farmerId,
                    status: { in: ["APPROVED", "PAID"] },
                },
            }),
        ]);
        return total > 0 ? (accepted / total) * 100 : 0;
    }
    static async getAveragePrice(farmerId) {
        const result = await prisma_1.default.farmerSubmission.aggregate({
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
    static async getTopPerformingProducts(farmerId) {
        const result = await prisma_1.default.farmerSubmission.groupBy({
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
    static async getSeasonalTrends(farmerId) {
        // Get monthly earnings for the last 12 months
        const monthlyEarnings = await prisma_1.default.$queryRaw `
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
        return monthlyEarnings;
    }
    static async getRegionalAverage(province, district) {
        const result = await prisma_1.default.farmerSubmission.aggregate({
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
    static async getPreviousYearComparison(farmerId) {
        const currentYear = new Date().getFullYear();
        const currentYearStart = new Date(currentYear, 0, 1);
        const previousYearStart = new Date(currentYear - 1, 0, 1);
        const previousYearEnd = new Date(currentYear, 0, 1);
        const [currentYearEarnings, previousYearEarnings] = await Promise.all([
            this.getEarningsForPeriod(farmerId, currentYearStart, new Date()),
            this.getEarningsForPeriod(farmerId, previousYearStart, previousYearEnd),
        ]);
        const growthRate = previousYearEarnings > 0
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
    static async getMarketPositionRanking(farmerId, province, district) {
        // Get farmer's total earnings
        const farmerEarnings = await this.getEarningsForPeriod(farmerId, new Date(new Date().getFullYear(), 0, 1), new Date());
        // Count farmers with higher earnings in the same district
        const higherEarners = await prisma_1.default.$queryRaw `
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
        return higherEarners.length + 1;
    }
}
exports.AnalyticsEarningsService = AnalyticsEarningsService;
