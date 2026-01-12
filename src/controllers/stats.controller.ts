import { Request, Response } from "express";
import {
  getSystemStatsService,
  getUserStatsService,
  getOrderStatsService,
  getFinanceStatsService,
  getSubscriptionStatsService,
  getVoucherStatsService,
  getQuickStatsService,
  getRecentActivitiesService,
  getSystemStatusService,
} from "../services/stats.service";

// ============================================
// MAIN DASHBOARD STATS CONTROLLER
// ============================================

/**
 * Get comprehensive system statistics for dashboard
 * GET /stats/dashboard
 */
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const { year, month, period } = req.query;

    // Validate year and month if provided
    if (year) {
      const parsedYear = parseInt(year as string);
      const currentYear = new Date().getFullYear();
      if (parsedYear < 2020 || parsedYear > currentYear + 1) {
        return res.status(400).json({
          message: "Invalid year. Year must be between 2020 and next year.",
        });
      }
    }

    if (month) {
      const parsedMonth = parseInt(month as string);
      if (parsedMonth < 1 || parsedMonth > 12) {
        return res.status(400).json({
          message: "Invalid month. Month must be between 1 and 12.",
        });
      }
    }

    const stats = await getSystemStatsService({
      period: period as any,
      year: year ? parseInt(year as string) : undefined,
      month: month ? parseInt(month as string) : undefined,
    });

    res.status(200).json({
      message: "Dashboard statistics retrieved successfully",
      data: stats,
    });
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve dashboard statistics",
    });
  }
};

// ============================================
// INDIVIDUAL STATS CONTROLLERS
// ============================================

/**
 * Get user statistics
 * GET /stats/users
 */
export const getUserStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    // Calculate previous period for comparison if we have dates
    if (startDate && endDate) {
      const periodDiff = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - periodDiff);
      prevEndDate = new Date(endDate.getTime() - periodDiff);
    }

    const isMonthly = !!month;

    const userStats = await getUserStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
      filters: { period: period as any, year: year ? parseInt(year as string) : undefined, month: month ? parseInt(month as string) : undefined }
    });

    res.status(200).json({
      message: "User statistics retrieved successfully",
      data: userStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve user statistics",
    });
  }
};

/**
 * Get order statistics
 * GET /stats/orders
 */
export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    // Calculate previous period for comparison if we have dates
    if (startDate && endDate) {
      const periodDiff = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - periodDiff);
      prevEndDate = new Date(endDate.getTime() - periodDiff);
    }

    const isMonthly = !!month;

    const orderStats = await getOrderStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
      filters: { period: period as any, year: year ? parseInt(year as string) : undefined, month: month ? parseInt(month as string) : undefined }
    });

    res.status(200).json({
      message: "Order statistics retrieved successfully",
      data: orderStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve order statistics",
    });
  }
};

/**
 * Get finance statistics
 * GET /stats/finance
 */
export const getFinanceStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    const isMonthly = !!month;

    const financeStats = await getFinanceStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      isMonthly,
      filters: { period: period as any, year: year ? parseInt(year as string) : undefined, month: month ? parseInt(month as string) : undefined }
    });

    res.status(200).json({
      message: "Finance statistics retrieved successfully",
      data: financeStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching finance stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve finance statistics",
    });
  }
};

/**
 * Get subscription statistics
 * GET /stats/subscriptions
 */
export const getSubscriptionStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    // Calculate previous period for comparison if we have dates
    if (startDate && endDate) {
      const periodDiff = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - periodDiff);
      prevEndDate = new Date(endDate.getTime() - periodDiff);
    }

    const subscriptionStats = await getSubscriptionStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
    });

    res.status(200).json({
      message: "Subscription statistics retrieved successfully",
      data: subscriptionStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching subscription stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve subscription statistics",
    });
  }
};

/**
 * Get voucher statistics
 * GET /stats/vouchers
 */
export const getVoucherStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    // Calculate previous period for comparison if we have dates
    if (startDate && endDate) {
      const periodDiff = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - periodDiff);
      prevEndDate = new Date(endDate.getTime() - periodDiff);
    }

    const isMonthly = !!month;

    const voucherStats = await getVoucherStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
      isMonthly,
      filters: { period: period as any, year: year ? parseInt(year as string) : undefined, month: month ? parseInt(month as string) : undefined }
    });

    res.status(200).json({
      message: "Voucher statistics retrieved successfully",
      data: voucherStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching voucher stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve voucher statistics",
    });
  }
};

/**
 * Get quick statistics for dashboard cards
 * GET /stats/quick
 */
export const getQuickStats = async (req: Request, res: Response) => {
  try {
    const { year, month, dateFrom, dateTo, period } = req.query;

    let startDate: Date | undefined;
    let endDate: Date | undefined;
    let prevStartDate: Date | undefined;
    let prevEndDate: Date | undefined;

    // Only calculate dates if filters are provided
    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom as string);
      endDate = new Date(dateTo as string);
    } else if (year || month) {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      if (month) {
        const targetMonth = parseInt(month as string);
        startDate = new Date(targetYear, targetMonth - 1, 1);
        endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      } else {
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
    }

    // Calculate previous period for comparison if we have dates
    if (startDate && endDate) {
      const periodDiff = endDate.getTime() - startDate.getTime();
      prevStartDate = new Date(startDate.getTime() - periodDiff);
      prevEndDate = new Date(endDate.getTime() - periodDiff);
    }

    const quickStats = await getQuickStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom: prevStartDate,
      prevDateTo: prevEndDate,
    });

    res.status(200).json({
      message: "Quick statistics retrieved successfully",
      data: quickStats,
      filters: {
        period: period || 'lifetime',
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        dateFrom: startDate,
        dateTo: endDate,
      },
    });
  } catch (error: any) {
    console.error("Error fetching quick stats:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve quick statistics",
    });
  }
};

/**
 * Get recent activities
 * GET /stats/activities
 */
export const getRecentActivities = async (req: Request, res: Response) => {
  try {
    const activities = await getRecentActivitiesService();

    res.status(200).json({
      message: "Recent activities retrieved successfully",
      data: activities,
    });
  } catch (error: any) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve recent activities",
    });
  }
};

/**
 * Get system status
 * GET /stats/system-status
 */
export const getSystemStatus = async (req: Request, res: Response) => {
  try {
    const systemStatus = await getSystemStatusService();

    res.status(200).json({
      message: "System status retrieved successfully",
      data: systemStatus,
    });
  } catch (error: any) {
    console.error("Error fetching system status:", error);
    res.status(500).json({
      message: error.message || "Failed to retrieve system status",
    });
  }
};
