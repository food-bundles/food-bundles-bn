import prisma from "../prisma";
import {
  OrderStatus,
  PaymentStatus,
  VoucherStatus,
  SubscriptionStatus,
  Role,
} from "@prisma/client";
import os from "os";
import { performance } from "perf_hooks";
import net from "net";
import https from "https";

// ============================================
// TYPES AND INTERFACES
// ============================================

interface StatsFilters {
  period?: 'lifetime' | 'year' | 'month' | 'week' | 'today';
  year?: number;
  month?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

interface UserStats {
  totalUsers: number;
  restaurants: number;
  farmers: number;
  admins: number;
  affiliators: number;
  logistics: number;
  timeSeriesData: Array<{
    period: string;
    date: string;
    restaurants: number;
    farmers: number;
    admins: number;
    affiliators: number;
    total: number;
  }>;
  growth: {
    totalChange: number;
    restaurantChange: number;
    farmerChange: number;
    adminChange: number;
  };
}

interface OrderStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  ongoingOrders: number;
  timeSeriesData: Array<{
    period: string;
    date: string;
    completed: number;
    cancelled: number;
    ongoing: number;
    total: number;
  }>;
  growth: {
    totalChange: number;
    completedChange: number;
  };
}

interface FinanceStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  timeSeriesData: Array<{
    period: string;
    date?: string;
    month?: number;
    revenue: number;
    expenses: number;
  }>;
  revenueBreakdown: {
    orders: number;
    subscriptions: number;
    vouchers: number;
  };
  expenseBreakdown: {
    usedVouchers: number;
    maturedVouchers: number;
    nearMaturityVouchers: number;
    farmerPayments: number;
  };
}

interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  planBreakdown: Array<{
    planName: string;
    count: number;
    revenue: number;
  }>;
  growth: {
    totalChange: number;
    activeChange: number;
  };
}

interface VoucherStats {
  totalVouchers: number;
  usedVouchers: number;
  maturedVouchers: number;
  nearMaturityVouchers: number;
  totalValue: number;
  usedValue: number;
  timeSeriesData: Array<{
    period: string;
    date: string;
    total: number;
    used: number;
    matured: number;
    totalValue: number;
    usedValue: number;
  }>;
  growth: {
    totalChange: number;
    usedChange: number;
  };
}

interface QuickStats {
  totalUsers: {
    value: number;
    change: number;
  };
  totalOrders: {
    value: number;
    change: number;
  };
  totalRevenue: {
    value: number;
    change: number;
  };
  activeSubscriptions: {
    value: number;
    change: number;
  };
  usedVouchers: {
    value: number;
    change: number;
  };
  completionRate: {
    value: number;
    change: number;
  };
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  timestamp: Date;
  metadata?: any;
}

interface SystemStatus {
  overallStatus: "Operational" | "Degraded" | "Down";
  uptime: number;
  avgResponseTime: number;
  services: Array<{
    name: string;
    status: "Operational" | "Degraded" | "Down";
    responseTime: number;
    lastChecked: Date;
  }>;
  systemMetrics?: {
    cpu: {
      cores: number;
      usagePercent: number;
      loadAverage: number[];
    };
    memory: {
      total: number;
      used: number;
      free: number;
      usagePercent: number;
    };
    uptime: {
      seconds: number;
      formatted: string;
    };
    platform: {
      os: string;
      arch: string;
      hostname: string;
    };
  };
}

// ============================================
// SYSTEM MONITORING UTILITIES
// ============================================

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const checkDatabaseConnection = async (): Promise<{
  isConnected: boolean;
  responseTime: number;
}> => {
  const start = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Math.round(performance.now() - start);
    return { isConnected: true, responseTime };
  } catch (error) {
    const responseTime = Math.round(performance.now() - start);
    return { isConnected: false, responseTime };
  }
};

const checkPort = async (
  host: string,
  port: number,
  timeout = 5000
): Promise<{ isOpen: boolean; responseTime: number }> => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({ isOpen: true, responseTime });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ isOpen: false, responseTime: timeout });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ isOpen: false, responseTime: Date.now() - startTime });
    });

    socket.connect(port, host);
  });
};

const checkHttpsEndpoint = async (
  url: string
): Promise<{
  isOnline: boolean;
  responseTime: number;
  statusCode?: number;
}> => {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const req = https.get(url, { timeout: 10000 }, (res) => {
      const responseTime = Date.now() - startTime;
      resolve({
        isOnline: true,
        responseTime,
        statusCode: res.statusCode,
      });
      res.resume();
    });

    req.on("error", () => {
      resolve({
        isOnline: false,
        responseTime: Date.now() - startTime,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        isOnline: false,
        responseTime: 10000,
      });
    });
  });
};

const getSystemMetrics = () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);

  const cpuLoad = os.loadavg();
  const cpuUsagePercent = Math.min(Math.round(cpuLoad[0] * 25), 100);

  const uptime = os.uptime();

  return {
    memory: {
      total: Math.round(totalMem / 1024 / 1024 / 1024), // GB
      used: Math.round(usedMem / 1024 / 1024 / 1024), // GB
      free: Math.round(freeMem / 1024 / 1024 / 1024), // GB
      usagePercent: memoryUsagePercent,
    },
    cpu: {
      cores: os.cpus().length,
      usagePercent: cpuUsagePercent,
      loadAverage: cpuLoad,
    },
    uptime: {
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    platform: {
      os: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
  };
};

const calculatePercentageChange = (
  oldValue: number,
  newValue: number
): number => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Math.round(((newValue - oldValue) / oldValue) * 100 * 100) / 100;
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDateRange = (filters: StatsFilters): { dateFrom?: Date; dateTo?: Date } => {
  const now = new Date();
  
  if (filters.period === 'lifetime' || !filters.period) {
    return {}; // No date filter for lifetime
  }
  
  if (filters.period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { dateFrom: startOfDay, dateTo: endOfDay };
  }
  
  if (filters.period === 'week') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return { dateFrom: startOfWeek, dateTo: now };
  }
  
  if (filters.period === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateFrom: startOfMonth, dateTo: now };
  }
  
  if (filters.period === 'year') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return { dateFrom: startOfYear, dateTo: now };
  }
  
  // Custom date range
  return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
};

const getUserStatsByPeriod = async (dateFrom?: Date, dateTo?: Date) => {
  const whereClause = dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};
  
  const [restaurants, farmers, admins, affiliators, logistics] =
    await Promise.all([
      prisma.restaurant.count({ where: whereClause }),
      prisma.farmer.count({ where: whereClause }),
      prisma.admin.count({
        where: { ...whereClause, role: Role.ADMIN },
      }),
      prisma.affiliator.count({ where: whereClause }),
      prisma.admin.count({
        where: { ...whereClause, role: Role.LOGISTICS },
      }),
    ]);

  return {
    totalUsers: restaurants + farmers + admins + affiliators + logistics,
    restaurants,
    farmers,
    admins,
    affiliators,
    logistics,
  };
};

const getOrderStatsByPeriod = async (dateFrom?: Date, dateTo?: Date) => {
  const whereClause = dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};
  const ongoingStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.IN_TRANSIT,
  ];

  const [totalOrders, completedOrders, cancelledOrders, ongoingOrders] =
    await Promise.all([
      prisma.order.count({ where: whereClause }),
      prisma.order.count({
        where: { ...whereClause, status: OrderStatus.DELIVERED },
      }),
      prisma.order.count({
        where: { ...whereClause, status: OrderStatus.CANCELLED },
      }),
      prisma.order.count({
        where: { ...whereClause, status: { in: ongoingStatuses } },
      }),
    ]);

  return {
    totalOrders,
    completedOrders,
    cancelledOrders,
    ongoingOrders,
  };
};

const getDailyOrderStats = async (dateFrom: Date, dateTo: Date) => {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: {
      createdAt: true,
      status: true,
    },
  });

  const dailyStats = new Map<
    string,
    { completed: number; cancelled: number; ongoing: number }
  >();
  const ongoingStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.IN_TRANSIT,
  ];

  orders.forEach((order) => {
    const date = order.createdAt.toISOString().split("T")[0];
    if (!dailyStats.has(date)) {
      dailyStats.set(date, { completed: 0, cancelled: 0, ongoing: 0 });
    }

    const stats = dailyStats.get(date)!;
    if (order.status === OrderStatus.DELIVERED) {
      stats.completed++;
    } else if (order.status === OrderStatus.CANCELLED) {
      stats.cancelled++;
    } else if (
      ongoingStatuses.includes(order.status as (typeof ongoingStatuses)[number])
    ) {
      stats.ongoing++;
    }
  });

  return Array.from(dailyStats.entries())
    .map(([date, stats]) => ({
      date,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getOrderRevenue = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.order.aggregate({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      paymentStatus: PaymentStatus.COMPLETED,
    },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount || 0;
};

const getSubscriptionRevenue = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.subscriptionPayment.aggregate({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
      paymentStatus: PaymentStatus.COMPLETED,
    },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
};

const getVoucherRevenue = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.voucherRepayment.aggregate({
    where: {
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
};

const getUsedVoucherExpenses = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.voucher.aggregate({
    where: {
      status: VoucherStatus.USED,
      usedAt: { gte: dateFrom, lte: dateTo },
    },
    _sum: { usedCredit: true },
  });
  return result._sum.usedCredit || 0;
};

const getMaturedVoucherExpenses = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.voucher.aggregate({
    where: {
      status: VoucherStatus.MATURED,
      updatedAt: { gte: dateFrom, lte: dateTo },
    },
    _sum: { usedCredit: true },
  });
  return result._sum.usedCredit || 0;
};

const getNearMaturityVoucherExpenses = async (): Promise<number> => {
  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  const nearMaturityVouchers = await prisma.voucher.findMany({
    where: {
      status: VoucherStatus.USED,
      loan: {
        repaymentDueDate: {
          lte: twoDaysFromNow,
          gte: new Date(),
        },
      },
    },
    select: { usedCredit: true },
  });

  return nearMaturityVouchers.reduce(
    (sum, voucher) => sum + voucher.usedCredit,
    0
  );
};

const getFarmerPayments = async (
  dateFrom: Date,
  dateTo: Date
): Promise<number> => {
  const result = await prisma.farmerSubmission.aggregate({
    where: {
      paidAt: { gte: dateFrom, lte: dateTo },
      status: "PAID",
    },
    _sum: { totalAmount: true },
  });
  return result._sum.totalAmount || 0;
};

const getTimeSeriesFinanceData = async (
  dateFrom: Date,
  dateTo: Date,
  isMonthly: boolean
) => {
  const data = [];

  if (isMonthly) {
    // Generate daily data for the month
    const currentDate = new Date(dateFrom);
    while (currentDate <= dateTo) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        23,
        59,
        59
      );

      const [orderRev, subscriptionRev, voucherRev] = await Promise.all([
        getOrderRevenue(dayStart, dayEnd),
        getSubscriptionRevenue(dayStart, dayEnd),
        getVoucherRevenue(dayStart, dayEnd),
      ]);

      const [usedVoucherExp, maturedVoucherExp, farmerPaymentsExp] =
        await Promise.all([
          getUsedVoucherExpenses(dayStart, dayEnd),
          getMaturedVoucherExpenses(dayStart, dayEnd),
          getFarmerPayments(dayStart, dayEnd),
        ]);

      const revenue = orderRev + subscriptionRev + voucherRev;
      const expenses = usedVoucherExp + maturedVoucherExp + farmerPaymentsExp;

      data.push({
        period: currentDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        date: currentDate.toISOString().split("T")[0],
        revenue,
        expenses,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // Generate monthly data for the year
    const year = dateFrom.getFullYear();
    for (let month = 0; month < 12; month++) {
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const [orderRev, subscriptionRev, voucherRev] = await Promise.all([
        getOrderRevenue(startOfMonth, endOfMonth),
        getSubscriptionRevenue(startOfMonth, endOfMonth),
        getVoucherRevenue(startOfMonth, endOfMonth),
      ]);

      const [usedVoucherExp, maturedVoucherExp, farmerPaymentsExp] =
        await Promise.all([
          getUsedVoucherExpenses(startOfMonth, endOfMonth),
          getMaturedVoucherExpenses(startOfMonth, endOfMonth),
          getFarmerPayments(startOfMonth, endOfMonth),
        ]);

      const revenue = orderRev + subscriptionRev + voucherRev;
      const expenses = usedVoucherExp + maturedVoucherExp + farmerPaymentsExp;

      data.push({
        period: startOfMonth.toLocaleDateString("en-US", { month: "short" }),
        month: month + 1,
        revenue,
        expenses,
      });
    }
  }

  return data;
};

const getTimeSeriesOrderStats = async (
  dateFrom: Date,
  dateTo: Date,
  isMonthly: boolean
) => {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: { createdAt: true, status: true },
  });

  const ongoingStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.IN_TRANSIT,
  ];
  const timeStats = new Map<
    string,
    { completed: number; cancelled: number; ongoing: number; total: number }
  >();

  orders.forEach((order) => {
    const key = isMonthly
      ? order.createdAt.toISOString().split("T")[0]
      : `${order.createdAt.getFullYear()}-${String(
          order.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;

    if (!timeStats.has(key)) {
      timeStats.set(key, { completed: 0, cancelled: 0, ongoing: 0, total: 0 });
    }

    const stats = timeStats.get(key)!;
    stats.total++;

    if (order.status === OrderStatus.DELIVERED) {
      stats.completed++;
    } else if (order.status === OrderStatus.CANCELLED) {
      stats.cancelled++;
    } else if (ongoingStatuses.includes(order.status as any)) {
      stats.ongoing++;
    }
  });

  return Array.from(timeStats.entries())
    .map(([key, stats]) => ({
      period: isMonthly
        ? new Date(key).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getTimeSeriesUserStats = async (
  dateFrom: Date,
  dateTo: Date,
  isMonthly: boolean
) => {
  const users = await Promise.all([
    prisma.restaurant.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true },
    }),
    prisma.farmer.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true },
    }),
    prisma.admin.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true },
    }),
    prisma.affiliator.findMany({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true },
    }),
  ]);

  const allUsers = [...users[0], ...users[1], ...users[2], ...users[3]];
  const timeStats = new Map<
    string,
    {
      restaurants: number;
      farmers: number;
      admins: number;
      affiliators: number;
      total: number;
    }
  >();

  users[0].forEach((user) => {
    const key = isMonthly
      ? user.createdAt.toISOString().split("T")[0]
      : `${user.createdAt.getFullYear()}-${String(
          user.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;
    if (!timeStats.has(key))
      timeStats.set(key, {
        restaurants: 0,
        farmers: 0,
        admins: 0,
        affiliators: 0,
        total: 0,
      });
    timeStats.get(key)!.restaurants++;
    timeStats.get(key)!.total++;
  });

  users[1].forEach((user) => {
    const key = isMonthly
      ? user.createdAt.toISOString().split("T")[0]
      : `${user.createdAt.getFullYear()}-${String(
          user.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;
    if (!timeStats.has(key))
      timeStats.set(key, {
        restaurants: 0,
        farmers: 0,
        admins: 0,
        affiliators: 0,
        total: 0,
      });
    timeStats.get(key)!.farmers++;
    timeStats.get(key)!.total++;
  });

  users[2].forEach((user) => {
    const key = isMonthly
      ? user.createdAt.toISOString().split("T")[0]
      : `${user.createdAt.getFullYear()}-${String(
          user.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;
    if (!timeStats.has(key))
      timeStats.set(key, {
        restaurants: 0,
        farmers: 0,
        admins: 0,
        affiliators: 0,
        total: 0,
      });
    timeStats.get(key)!.admins++;
    timeStats.get(key)!.total++;
  });

  users[3].forEach((user) => {
    const key = isMonthly
      ? user.createdAt.toISOString().split("T")[0]
      : `${user.createdAt.getFullYear()}-${String(
          user.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;
    if (!timeStats.has(key))
      timeStats.set(key, {
        restaurants: 0,
        farmers: 0,
        admins: 0,
        affiliators: 0,
        total: 0,
      });
    timeStats.get(key)!.affiliators++;
    timeStats.get(key)!.total++;
  });

  return Array.from(timeStats.entries())
    .map(([key, stats]) => ({
      period: isMonthly
        ? new Date(key).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getTimeSeriesVoucherStats = async (
  dateFrom: Date,
  dateTo: Date,
  isMonthly: boolean
) => {
  const vouchers = await prisma.voucher.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: {
      createdAt: true,
      status: true,
      totalCredit: true,
      usedCredit: true,
    },
  });

  const timeStats = new Map<
    string,
    {
      total: number;
      used: number;
      matured: number;
      totalValue: number;
      usedValue: number;
    }
  >();

  vouchers.forEach((voucher) => {
    const key = isMonthly
      ? voucher.createdAt.toISOString().split("T")[0]
      : `${voucher.createdAt.getFullYear()}-${String(
          voucher.createdAt.getMonth() + 1
        ).padStart(2, "0")}`;

    if (!timeStats.has(key)) {
      timeStats.set(key, {
        total: 0,
        used: 0,
        matured: 0,
        totalValue: 0,
        usedValue: 0,
      });
    }

    const stats = timeStats.get(key)!;
    stats.total++;
    stats.totalValue += voucher.totalCredit;
    stats.usedValue += voucher.usedCredit;

    if (voucher.status === VoucherStatus.USED) {
      stats.used++;
    } else if (voucher.status === VoucherStatus.MATURED) {
      stats.matured++;
    }
  });

  return Array.from(timeStats.entries())
    .map(([key, stats]) => ({
      period: isMonthly
        ? new Date(key).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ============================================
// MAIN STATS SERVICE
// ============================================

export const getSystemStatsService = async (filters: StatsFilters = {}) => {
  const { dateFrom, dateTo } = getDateRange(filters);
  const { year = new Date().getFullYear(), month } = filters;

  const currentDate = new Date();
  let startDate = dateFrom;
  let endDate = dateTo;

  // If no specific date range from period filter, use year/month logic
  if (!startDate || !endDate) {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    startDate = startOfYear;
    endDate = endOfYear;

    if (month) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59);
    }
  }

  const prevDateFrom = new Date(startDate);
  const prevDateTo = new Date(endDate);
  const periodDiff = endDate.getTime() - startDate.getTime();
  prevDateFrom.setTime(startDate.getTime() - periodDiff);
  prevDateTo.setTime(endDate.getTime() - periodDiff);

  const isMonthly = !!month;

  const [
    userStats,
    orderStats,
    financeStats,
    subscriptionStats,
    voucherStats,
    quickStats,
    recentActivities,
    systemStatus,
  ] = await Promise.all([
    getUserStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom,
      prevDateTo,
      isMonthly,
    }),
    getOrderStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom,
      prevDateTo,
      isMonthly,
    }),
    getFinanceStatsService({ dateFrom: startDate, dateTo: endDate, isMonthly }),
    getSubscriptionStatsService({ dateFrom: startDate, dateTo: endDate, prevDateFrom, prevDateTo }),
    getVoucherStatsService({
      dateFrom: startDate,
      dateTo: endDate,
      prevDateFrom,
      prevDateTo,
      isMonthly,
    }),
    getQuickStatsService({ dateFrom: startDate, dateTo: endDate, prevDateFrom, prevDateTo }),
    getRecentActivitiesService(),
    getSystemStatusService(),
  ]);

  return {
    users: userStats,
    orders: orderStats,
    finance: financeStats,
    subscriptions: subscriptionStats,
    vouchers: voucherStats,
    quickStats,
    recentActivities,
    systemStatus,
    filters: {
      period: filters.period || 'lifetime',
      year,
      month,
      dateFrom: startDate,
      dateTo: endDate,
    },
  };
};

// ============================================
// USER STATS SERVICE
// ============================================

export const getUserStatsService = async ({
  dateFrom,
  dateTo,
  prevDateFrom,
  prevDateTo,
  isMonthly,
}: {
  dateFrom: Date;
  dateTo: Date;
  prevDateFrom: Date;
  prevDateTo: Date;
  isMonthly: boolean;
}): Promise<UserStats> => {
  const [currentStats, prevStats, timeSeriesData] = await Promise.all([
    getUserStatsByPeriod(dateFrom, dateTo),
    getUserStatsByPeriod(prevDateFrom, prevDateTo),
    getTimeSeriesUserStats(dateFrom, dateTo, isMonthly),
  ]);

  return {
    totalUsers: currentStats.totalUsers,
    restaurants: currentStats.restaurants,
    farmers: currentStats.farmers,
    admins: currentStats.admins,
    affiliators: currentStats.affiliators,
    logistics: currentStats.logistics,
    timeSeriesData,
    growth: {
      totalChange: calculatePercentageChange(
        prevStats.totalUsers,
        currentStats.totalUsers
      ),
      restaurantChange: calculatePercentageChange(
        prevStats.restaurants,
        currentStats.restaurants
      ),
      farmerChange: calculatePercentageChange(
        prevStats.farmers,
        currentStats.farmers
      ),
      adminChange: calculatePercentageChange(
        prevStats.admins,
        currentStats.admins
      ),
    },
  };
};

// ============================================
// ORDER STATS SERVICE
// ============================================

export const getOrderStatsService = async ({
  dateFrom,
  dateTo,
  prevDateFrom,
  prevDateTo,
  isMonthly,
}: {
  dateFrom: Date;
  dateTo: Date;
  prevDateFrom: Date;
  prevDateTo: Date;
  isMonthly: boolean;
}): Promise<OrderStats> => {
  const [currentOrders, prevOrders, timeSeriesData] = await Promise.all([
    getOrderStatsByPeriod(dateFrom, dateTo),
    getOrderStatsByPeriod(prevDateFrom, prevDateTo),
    getTimeSeriesOrderStats(dateFrom, dateTo, isMonthly),
  ]);

  return {
    totalOrders: currentOrders.totalOrders,
    completedOrders: currentOrders.completedOrders,
    cancelledOrders: currentOrders.cancelledOrders,
    ongoingOrders: currentOrders.ongoingOrders,
    timeSeriesData,
    growth: {
      totalChange: calculatePercentageChange(
        prevOrders.totalOrders,
        currentOrders.totalOrders
      ),
      completedChange: calculatePercentageChange(
        prevOrders.completedOrders,
        currentOrders.completedOrders
      ),
    },
  };
};

// ============================================
// FINANCE STATS SERVICE
// ============================================

export const getFinanceStatsService = async ({
  dateFrom,
  dateTo,
  isMonthly,
}: {
  dateFrom: Date;
  dateTo: Date;
  isMonthly: boolean;
}): Promise<FinanceStats> => {
  const [orderRevenue, subscriptionRevenue, voucherRevenue] = await Promise.all(
    [
      getOrderRevenue(dateFrom, dateTo),
      getSubscriptionRevenue(dateFrom, dateTo),
      getVoucherRevenue(dateFrom, dateTo),
    ]
  );

  const [
    usedVoucherExpenses,
    maturedVoucherExpenses,
    nearMaturityExpenses,
    farmerPayments,
  ] = await Promise.all([
    getUsedVoucherExpenses(dateFrom, dateTo),
    getMaturedVoucherExpenses(dateFrom, dateTo),
    getNearMaturityVoucherExpenses(),
    getFarmerPayments(dateFrom, dateTo),
  ]);

  const totalRevenue = orderRevenue + subscriptionRevenue + voucherRevenue;
  const totalExpenses =
    usedVoucherExpenses +
    maturedVoucherExpenses +
    nearMaturityExpenses +
    farmerPayments;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const timeSeriesData = await getTimeSeriesFinanceData(
    dateFrom,
    dateTo,
    isMonthly
  );

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMargin,
    timeSeriesData,
    revenueBreakdown: {
      orders: orderRevenue,
      subscriptions: subscriptionRevenue,
      vouchers: voucherRevenue,
    },
    expenseBreakdown: {
      usedVouchers: usedVoucherExpenses,
      maturedVouchers: maturedVoucherExpenses,
      nearMaturityVouchers: nearMaturityExpenses,
      farmerPayments,
    },
  };
};

// ============================================
// SUBSCRIPTION STATS SERVICE
// ============================================

export const getSubscriptionStatsService = async ({
  dateFrom,
  dateTo,
  prevDateFrom,
  prevDateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
  prevDateFrom: Date;
  prevDateTo: Date;
}): Promise<SubscriptionStats> => {
  const [currentStats, prevStats, planBreakdown] = await Promise.all([
    getSubscriptionStatsByPeriod(dateFrom, dateTo),
    getSubscriptionStatsByPeriod(prevDateFrom, prevDateTo),
    getSubscriptionPlanBreakdown(dateFrom, dateTo),
  ]);

  return {
    totalSubscriptions: currentStats.totalSubscriptions,
    activeSubscriptions: currentStats.activeSubscriptions,
    expiredSubscriptions: currentStats.expiredSubscriptions,
    planBreakdown,
    growth: {
      totalChange: calculatePercentageChange(
        prevStats.totalSubscriptions,
        currentStats.totalSubscriptions
      ),
      activeChange: calculatePercentageChange(
        prevStats.activeSubscriptions,
        currentStats.activeSubscriptions
      ),
    },
  };
};

const getSubscriptionStatsByPeriod = async (dateFrom: Date, dateTo: Date) => {
  const [totalSubscriptions, activeSubscriptions, expiredSubscriptions] =
    await Promise.all([
      prisma.restaurantSubscription.count({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      prisma.restaurantSubscription.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      prisma.restaurantSubscription.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: SubscriptionStatus.EXPIRED,
        },
      }),
    ]);

  return {
    totalSubscriptions,
    activeSubscriptions,
    expiredSubscriptions,
  };
};

const getSubscriptionPlanBreakdown = async (dateFrom: Date, dateTo: Date) => {
  const subscriptions = await prisma.restaurantSubscription.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    include: {
      plan: { select: { name: true, price: true } },
      payments: {
        where: { paymentStatus: PaymentStatus.COMPLETED },
        select: { amount: true },
      },
    },
  });

  const planStats = new Map<string, { count: number; revenue: number }>();

  subscriptions.forEach((subscription) => {
    const planName = subscription.plan.name;
    if (!planStats.has(planName)) {
      planStats.set(planName, { count: 0, revenue: 0 });
    }

    const stats = planStats.get(planName)!;
    stats.count++;
    stats.revenue += subscription.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
  });

  return Array.from(planStats.entries()).map(([planName, stats]) => ({
    planName,
    ...stats,
  }));
};

// ============================================
// VOUCHER STATS SERVICE
// ============================================

export const getVoucherStatsService = async ({
  dateFrom,
  dateTo,
  prevDateFrom,
  prevDateTo,
  isMonthly,
}: {
  dateFrom: Date;
  dateTo: Date;
  prevDateFrom: Date;
  prevDateTo: Date;
  isMonthly: boolean;
}): Promise<VoucherStats> => {
  const [currentStats, prevStats, nearMaturityCount, timeSeriesData] =
    await Promise.all([
      getVoucherStatsByPeriod(dateFrom, dateTo),
      getVoucherStatsByPeriod(prevDateFrom, prevDateTo),
      getNearMaturityVoucherCount(),
      getTimeSeriesVoucherStats(dateFrom, dateTo, isMonthly),
    ]);

  return {
    totalVouchers: currentStats.totalVouchers,
    usedVouchers: currentStats.usedVouchers,
    maturedVouchers: currentStats.maturedVouchers,
    nearMaturityVouchers: nearMaturityCount,
    totalValue: currentStats.totalValue,
    usedValue: currentStats.usedValue,
    timeSeriesData,
    growth: {
      totalChange: calculatePercentageChange(
        prevStats.totalVouchers,
        currentStats.totalVouchers
      ),
      usedChange: calculatePercentageChange(
        prevStats.usedVouchers,
        currentStats.usedVouchers
      ),
    },
  };
};

const getVoucherStatsByPeriod = async (dateFrom: Date, dateTo: Date) => {
  const [totalVouchers, usedVouchers, maturedVouchers, totalValue, usedValue] =
    await Promise.all([
      prisma.voucher.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { in: [VoucherStatus.USED, VoucherStatus.MATURED] },
        },
      }),
      prisma.voucher.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: VoucherStatus.USED,
        },
      }),
      prisma.voucher.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: VoucherStatus.MATURED,
        },
      }),
      prisma.voucher.aggregate({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { in: [VoucherStatus.USED, VoucherStatus.MATURED] },
        },
        _sum: { totalCredit: true },
      }),
      prisma.voucher.aggregate({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { in: [VoucherStatus.USED, VoucherStatus.MATURED] },
        },
        _sum: { usedCredit: true },
      }),
    ]);

  return {
    totalVouchers,
    usedVouchers,
    maturedVouchers,
    totalValue: totalValue._sum.totalCredit || 0,
    usedValue: usedValue._sum.usedCredit || 0,
  };
};

const getNearMaturityVoucherCount = async (): Promise<number> => {
  const twoDaysFromNow = new Date();
  twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

  return await prisma.voucher.count({
    where: {
      status: VoucherStatus.USED,
      loan: {
        repaymentDueDate: {
          lte: twoDaysFromNow,
          gte: new Date(),
        },
      },
    },
  });
};

// ============================================
// QUICK STATS SERVICE
// ============================================

export const getQuickStatsService = async ({
  dateFrom,
  dateTo,
  prevDateFrom,
  prevDateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
  prevDateFrom: Date;
  prevDateTo: Date;
}): Promise<QuickStats> => {
  const [currentPeriod, prevPeriod] = await Promise.all([
    getQuickStatsByPeriod(dateFrom, dateTo),
    getQuickStatsByPeriod(prevDateFrom, prevDateTo),
  ]);

  return {
    totalUsers: {
      value: currentPeriod.totalUsers,
      change: calculatePercentageChange(
        prevPeriod.totalUsers,
        currentPeriod.totalUsers
      ),
    },
    totalOrders: {
      value: currentPeriod.totalOrders,
      change: calculatePercentageChange(
        prevPeriod.totalOrders,
        currentPeriod.totalOrders
      ),
    },
    totalRevenue: {
      value: currentPeriod.totalRevenue,
      change: calculatePercentageChange(
        prevPeriod.totalRevenue,
        currentPeriod.totalRevenue
      ),
    },
    activeSubscriptions: {
      value: currentPeriod.activeSubscriptions,
      change: calculatePercentageChange(
        prevPeriod.activeSubscriptions,
        currentPeriod.activeSubscriptions
      ),
    },
    usedVouchers: {
      value: currentPeriod.usedVouchers,
      change: calculatePercentageChange(
        prevPeriod.usedVouchers,
        currentPeriod.usedVouchers
      ),
    },
    completionRate: {
      value: currentPeriod.completionRate,
      change: currentPeriod.completionRate - prevPeriod.completionRate,
    },
  };
};

const getQuickStatsByPeriod = async (dateFrom: Date, dateTo: Date) => {
  const [
    userStats,
    totalOrders,
    completedOrders,
    totalRevenue,
    activeSubscriptions,
    usedVouchers,
  ] = await Promise.all([
    getUserStatsByPeriod(dateFrom, dateTo),
    prisma.order.count({
      where: { createdAt: { gte: dateFrom, lte: dateTo } },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: OrderStatus.DELIVERED,
      },
    }),
    getOrderRevenue(dateFrom, dateTo),
    prisma.restaurantSubscription.count({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: SubscriptionStatus.ACTIVE,
      },
    }),
    prisma.voucher.count({
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
        status: VoucherStatus.USED,
      },
    }),
  ]);

  const completionRate =
    totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  return {
    totalUsers: userStats.totalUsers,
    totalOrders,
    totalRevenue,
    activeSubscriptions,
    usedVouchers,
    completionRate,
  };
};

// ============================================
// RECENT ACTIVITIES SERVICE
// ============================================

export const getRecentActivitiesService = async (): Promise<
  RecentActivity[]
> => {
  const activities: RecentActivity[] = [];

  const recentOrders = await prisma.order.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    include: { restaurant: { select: { name: true } } },
  });

  recentOrders.forEach((order) => {
    activities.push({
      id: order.id,
      type: "order",
      title: "New Order Placed",
      description: `Order #${order.orderNumber} - ${order.restaurant.name}`,
      status: order.status.toLowerCase(),
      timestamp: order.createdAt,
      metadata: { amount: order.totalAmount, currency: "RWF" },
    });
  });

  const recentVouchers = await prisma.voucher.findMany({
    take: 3,
    orderBy: { createdAt: "desc" },
    include: { restaurant: { select: { name: true } } },
  });

  recentVouchers.forEach((voucher) => {
    activities.push({
      id: voucher.id,
      type: "voucher",
      title: "Voucher Used",
      description: `${voucher.voucherCode} - ${voucher.restaurant?.name || ""}`,
      status: voucher.status.toLowerCase(),
      timestamp: voucher.usedAt || voucher.createdAt,
      metadata: { discountPercentage: voucher.discountPercentage },
    });
  });

  const recentSubscriptions = await prisma.restaurantSubscription.findMany({
    take: 2,
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { name: true } },
      plan: { select: { name: true } },
    },
  });

  recentSubscriptions.forEach((subscription) => {
    activities.push({
      id: subscription.id,
      type: "subscription",
      title: "Subscription Renewed",
      description: `${subscription.restaurant?.name || ""} - ${
        subscription.plan.name
      }`,
      status: subscription.status.toLowerCase(),
      timestamp: subscription.createdAt,
    });
  });

  const recentUsers = await prisma.restaurant.findMany({
    take: 2,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true },
  });

  recentUsers.forEach((user) => {
    activities.push({
      id: user.id,
      type: "user",
      title: "New User Registered",
      description: `Restaurant: ${user.name}`,
      status: "success",
      timestamp: user.createdAt,
    });
  });

  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);
};

// ============================================
// SYSTEM STATUS SERVICE
// ============================================

export const getSystemStatusService = async (): Promise<SystemStatus> => {
  try {
    const systemMetrics = getSystemMetrics();

    // Check database connection
    const dbCheck = await checkDatabaseConnection();

    // Check external services if URLs are provided
    const externalApiCheck = process.env.EXTERNAL_API_URL
      ? await checkHttpsEndpoint(process.env.EXTERNAL_API_URL)
      : { isOnline: true, responseTime: 50 };

    // Check WebSocket port if configured
    const wsPort = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
    const wsCheck = await checkPort("localhost", wsPort, 3000);

    const services = [
      {
        name: "API Gateway",
        status:
          systemMetrics.cpu.usagePercent < 80 &&
          systemMetrics.memory.usagePercent < 85
            ? ("Operational" as const)
            : ("Degraded" as const),
        responseTime: Math.round(performance.now() % 100) + 50, // Simulated API response time
        lastChecked: new Date(),
      },
      {
        name: "Database",
        status: dbCheck.isConnected
          ? ("Operational" as const)
          : ("Down" as const),
        responseTime: dbCheck.responseTime,
        lastChecked: new Date(),
      },
      {
        name: "WebSocket",
        status: wsCheck.isOpen ? ("Operational" as const) : ("Down" as const),
        responseTime: wsCheck.responseTime,
        lastChecked: new Date(),
      },
      {
        name: "External APIs",
        status: externalApiCheck.isOnline
          ? ("Operational" as const)
          : ("Degraded" as const),
        responseTime: externalApiCheck.responseTime,
        lastChecked: new Date(),
      },
    ];

    // Calculate overall status
    const downServices = services.filter((s) => s.status === "Down").length;
    const degradedServices = services.filter(
      (s) => s.status === "Degraded"
    ).length;

    let overallStatus: "Operational" | "Degraded" | "Down";
    if (downServices > 0) {
      overallStatus = "Down";
    } else if (
      degradedServices > 0 ||
      systemMetrics.cpu.usagePercent > 90 ||
      systemMetrics.memory.usagePercent > 95
    ) {
      overallStatus = "Degraded";
    } else {
      overallStatus = "Operational";
    }

    // Calculate average response time
    const avgResponseTime = Math.round(
      services.reduce((sum, service) => sum + service.responseTime, 0) /
        services.length
    );

    // Calculate uptime percentage based on system uptime and service availability
    const serviceAvailability =
      services.filter((s) => s.status === "Operational").length /
      services.length;
    const uptime = Math.min(99.9, serviceAvailability * 100);

    return {
      overallStatus,
      uptime: Math.round(uptime * 100) / 100,
      avgResponseTime,
      services,
      systemMetrics: {
        cpu: systemMetrics.cpu,
        memory: systemMetrics.memory,
        uptime: systemMetrics.uptime,
        platform: systemMetrics.platform,
      },
    };
  } catch (error) {
    console.error("Error getting system status:", error);

    // Fallback status when monitoring fails
    return {
      overallStatus: "Degraded",
      uptime: 95.0,
      avgResponseTime: 500,
      services: [
        {
          name: "API Gateway",
          status: "Degraded",
          responseTime: 500,
          lastChecked: new Date(),
        },
        {
          name: "Database",
          status: "Down",
          responseTime: 1000,
          lastChecked: new Date(),
        },
        {
          name: "WebSocket",
          status: "Down",
          responseTime: 1000,
          lastChecked: new Date(),
        },
        {
          name: "External APIs",
          status: "Degraded",
          responseTime: 800,
          lastChecked: new Date(),
        },
      ],
    };
  }
};
