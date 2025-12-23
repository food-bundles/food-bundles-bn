import prisma from "../prisma";
import {
  OrderStatus,
  PaymentStatus,
  VoucherStatus,
  SubscriptionStatus,
  Role,
} from "@prisma/client";

// ============================================
// TYPES AND INTERFACES
// ============================================

interface StatsFilters {
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
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

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

const getUserStatsByPeriod = async (dateFrom: Date, dateTo: Date) => {
  const [restaurants, farmers, admins, affiliators, logistics] =
    await Promise.all([
      prisma.restaurant.count({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      prisma.farmer.count({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      prisma.admin.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          role: Role.ADMIN,
        },
      }),
      prisma.affiliator.count({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      prisma.admin.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          role: Role.LOGISTICS,
        },
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

const getOrderStatsByPeriod = async (dateFrom: Date, dateTo: Date) => {
  const ongoingStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
    OrderStatus.IN_TRANSIT,
  ];

  const [totalOrders, completedOrders, cancelledOrders, ongoingOrders] =
    await Promise.all([
      prisma.order.count({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: OrderStatus.DELIVERED,
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: OrderStatus.CANCELLED,
        },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: dateFrom, lte: dateTo },
          status: { in: ongoingStatuses },
        },
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

const getTimeSeriesFinanceData = async (dateFrom: Date, dateTo: Date, isMonthly: boolean) => {
  const data = [];
  
  if (isMonthly) {
    // Generate daily data for the month
    const currentDate = new Date(dateFrom);
    while (currentDate <= dateTo) {
      const dayStart = new Date(currentDate);
      const dayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59);
      
      const [orderRev, subscriptionRev, voucherRev] = await Promise.all([
        getOrderRevenue(dayStart, dayEnd),
        getSubscriptionRevenue(dayStart, dayEnd),
        getVoucherRevenue(dayStart, dayEnd),
      ]);
      
      const [usedVoucherExp, maturedVoucherExp, farmerPaymentsExp] = await Promise.all([
        getUsedVoucherExpenses(dayStart, dayEnd),
        getMaturedVoucherExpenses(dayStart, dayEnd),
        getFarmerPayments(dayStart, dayEnd),
      ]);
      
      const revenue = orderRev + subscriptionRev + voucherRev;
      const expenses = usedVoucherExp + maturedVoucherExp + farmerPaymentsExp;
      
      data.push({
        period: currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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
      
      const [usedVoucherExp, maturedVoucherExp, farmerPaymentsExp] = await Promise.all([
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

const getTimeSeriesOrderStats = async (dateFrom: Date, dateTo: Date, isMonthly: boolean) => {
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: { createdAt: true, status: true },
  });
  
  const ongoingStatuses = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.IN_TRANSIT];
  const timeStats = new Map<string, { completed: number; cancelled: number; ongoing: number; total: number }>();
  
  orders.forEach((order) => {
    const key = isMonthly 
      ? order.createdAt.toISOString().split("T")[0]
      : `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
    
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
      period: isMonthly ? new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getTimeSeriesUserStats = async (dateFrom: Date, dateTo: Date, isMonthly: boolean) => {
  const users = await Promise.all([
    prisma.restaurant.findMany({ where: { createdAt: { gte: dateFrom, lte: dateTo } }, select: { createdAt: true } }),
    prisma.farmer.findMany({ where: { createdAt: { gte: dateFrom, lte: dateTo } }, select: { createdAt: true } }),
    prisma.admin.findMany({ where: { createdAt: { gte: dateFrom, lte: dateTo } }, select: { createdAt: true } }),
    prisma.affiliator.findMany({ where: { createdAt: { gte: dateFrom, lte: dateTo } }, select: { createdAt: true } }),
  ]);
  
  const allUsers = [...users[0], ...users[1], ...users[2], ...users[3]];
  const timeStats = new Map<string, { restaurants: number; farmers: number; admins: number; affiliators: number; total: number }>();
  
  users[0].forEach(user => {
    const key = isMonthly ? user.createdAt.toISOString().split("T")[0] : `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!timeStats.has(key)) timeStats.set(key, { restaurants: 0, farmers: 0, admins: 0, affiliators: 0, total: 0 });
    timeStats.get(key)!.restaurants++;
    timeStats.get(key)!.total++;
  });
  
  users[1].forEach(user => {
    const key = isMonthly ? user.createdAt.toISOString().split("T")[0] : `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!timeStats.has(key)) timeStats.set(key, { restaurants: 0, farmers: 0, admins: 0, affiliators: 0, total: 0 });
    timeStats.get(key)!.farmers++;
    timeStats.get(key)!.total++;
  });
  
  users[2].forEach(user => {
    const key = isMonthly ? user.createdAt.toISOString().split("T")[0] : `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!timeStats.has(key)) timeStats.set(key, { restaurants: 0, farmers: 0, admins: 0, affiliators: 0, total: 0 });
    timeStats.get(key)!.admins++;
    timeStats.get(key)!.total++;
  });
  
  users[3].forEach(user => {
    const key = isMonthly ? user.createdAt.toISOString().split("T")[0] : `${user.createdAt.getFullYear()}-${String(user.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!timeStats.has(key)) timeStats.set(key, { restaurants: 0, farmers: 0, admins: 0, affiliators: 0, total: 0 });
    timeStats.get(key)!.affiliators++;
    timeStats.get(key)!.total++;
  });
  
  return Array.from(timeStats.entries())
    .map(([key, stats]) => ({
      period: isMonthly ? new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getTimeSeriesVoucherStats = async (dateFrom: Date, dateTo: Date, isMonthly: boolean) => {
  const vouchers = await prisma.voucher.findMany({
    where: { createdAt: { gte: dateFrom, lte: dateTo } },
    select: { createdAt: true, status: true, totalCredit: true, usedCredit: true },
  });
  
  const timeStats = new Map<string, { total: number; used: number; matured: number; totalValue: number; usedValue: number }>();
  
  vouchers.forEach((voucher) => {
    const key = isMonthly ? voucher.createdAt.toISOString().split("T")[0] : `${voucher.createdAt.getFullYear()}-${String(voucher.createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!timeStats.has(key)) {
      timeStats.set(key, { total: 0, used: 0, matured: 0, totalValue: 0, usedValue: 0 });
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
      period: isMonthly ? new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : new Date(key + "-01").toLocaleDateString("en-US", { month: "short" }),
      date: key,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// ============================================
// MAIN STATS SERVICE
// ============================================

export const getSystemStatsService = async (filters: StatsFilters = {}) => {
  const { year = new Date().getFullYear(), month } = filters;

  const currentDate = new Date();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  let dateFrom = startOfYear;
  let dateTo = endOfYear;

  if (month) {
    dateFrom = new Date(year, month - 1, 1);
    dateTo = new Date(year, month, 0, 23, 59, 59);
  }

  const prevDateFrom = new Date(dateFrom);
  const prevDateTo = new Date(dateTo);
  const periodDiff = dateTo.getTime() - dateFrom.getTime();
  prevDateFrom.setTime(dateFrom.getTime() - periodDiff);
  prevDateTo.setTime(dateTo.getTime() - periodDiff);

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
    getUserStatsService({ dateFrom, dateTo, prevDateFrom, prevDateTo, isMonthly }),
    getOrderStatsService({ dateFrom, dateTo, prevDateFrom, prevDateTo, isMonthly }),
    getFinanceStatsService({ dateFrom, dateTo, isMonthly }),
    getSubscriptionStatsService({ dateFrom, dateTo, prevDateFrom, prevDateTo }),
    getVoucherStatsService({ dateFrom, dateTo, prevDateFrom, prevDateTo, isMonthly }),
    getQuickStatsService({ dateFrom, dateTo, prevDateFrom, prevDateTo }),
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
      year,
      month,
      dateFrom,
      dateTo,
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

  const timeSeriesData = await getTimeSeriesFinanceData(dateFrom, dateTo, isMonthly);

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
  const [currentStats, prevStats, nearMaturityCount, timeSeriesData] = await Promise.all([
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
      description: `${voucher.voucherCode} - ${voucher.restaurant.name}`,
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
      description: `${subscription.restaurant.name} - ${subscription.plan.name}`,
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
  const services = [
    {
      name: "API Gateway",
      status: "Operational" as const,
      responseTime: Math.floor(Math.random() * 200) + 100,
      lastChecked: new Date(),
    },
    {
      name: "Database",
      status: "Operational" as const,
      responseTime: Math.floor(Math.random() * 50) + 20,
      lastChecked: new Date(),
    },
    {
      name: "WebSocket",
      status: "Operational" as const,
      responseTime: Math.floor(Math.random() * 100) + 200,
      lastChecked: new Date(),
    },
    {
      name: "External APIs",
      status: "Operational" as const,
      responseTime: Math.floor(Math.random() * 150) + 250,
      lastChecked: new Date(),
    },
  ];

  const avgResponseTime =
    services.reduce((sum, service) => sum + service.responseTime, 0) /
    services.length;
  const uptime = 99.9;

  return {
    overallStatus: "Operational",
    uptime,
    avgResponseTime: Math.round(avgResponseTime),
    services,
  };
};
