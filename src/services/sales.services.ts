import prisma from "../prisma";

export interface SalesFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'revenue' | 'expense' | 'all';
  category?: string;
  page?: number;
  limit?: number;
}

// Get Revenue Data
export const getRevenueService = async (filters: SalesFilters) => {
  const { startDate, endDate, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const dateFilter = startDate && endDate ? {
    gte: startDate,
    lte: endDate,
  } : {};

  // Get completed orders (revenue)
  const [orders, orderCount] = await Promise.all([
    prisma.order.findMany({
      where: {
        paymentStatus: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paidAt: true,
        restaurant: { select: { name: true } },
      },
      skip,
      take: limit,
      orderBy: { paidAt: 'desc' },
    }),
    prisma.order.count({
      where: {
        paymentStatus: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
    }),
  ]);

  // Get subscription payments (revenue)
  const [subscriptions, subscriptionCount] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where: {
        paymentStatus: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        subscription: {
          select: {
            restaurant: { select: { name: true } },
            plan: { select: { name: true } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { paidAt: 'desc' },
    }),
    prisma.subscriptionPayment.count({
      where: {
        paymentStatus: 'COMPLETED',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
    }),
  ]);

  const totalRevenue = await prisma.order.aggregate({
    where: {
      paymentStatus: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
    },
    _sum: { totalAmount: true },
  });

  const subscriptionRevenue = await prisma.subscriptionPayment.aggregate({
    where: {
      paymentStatus: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
    },
    _sum: { amount: true },
  });

  return {
    orders,
    subscriptions,
    totalOrderRevenue: totalRevenue._sum.totalAmount || 0,
    totalSubscriptionRevenue: subscriptionRevenue._sum.amount || 0,
    totalRevenue: (totalRevenue._sum.totalAmount || 0) + (subscriptionRevenue._sum.amount || 0),
    pagination: {
      page,
      limit,
      totalOrders: orderCount,
      totalSubscriptions: subscriptionCount,
      totalPages: Math.ceil(Math.max(orderCount, subscriptionCount) / limit),
    },
  };
};

// Get Expense Data
export const getExpenseService = async (filters: SalesFilters) => {
  const { startDate, endDate, page = 1, limit = 10 } = filters;
  const skip = (page - 1) * limit;

  const dateFilter = startDate && endDate ? {
    gte: startDate,
    lte: endDate,
  } : {};

  // Get paid farmer submissions (expenses)
  const [submissions, submissionCount] = await Promise.all([
    prisma.farmerSubmission.findMany({
      where: {
        status: 'PAID',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
      select: {
        id: true,
        productName: true,
        totalAmount: true,
        paidAt: true,
        farmer: { select: { phone: true } },
      },
      skip,
      take: limit,
      orderBy: { paidAt: 'desc' },
    }),
    prisma.farmerSubmission.count({
      where: {
        status: 'PAID',
        ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
      },
    }),
  ]);

  // Get voucher transactions (expenses - discounts given)
  const [voucherTransactions, voucherCount] = await Promise.all([
    prisma.voucherTransaction.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { transactionDate: dateFilter }),
      },
      select: {
        id: true,
        discountAmount: true,
        transactionDate: true,
        restaurant: { select: { name: true } },
        voucher: { select: { voucherCode: true } },
      },
      skip,
      take: limit,
      orderBy: { transactionDate: 'desc' },
    }),
    prisma.voucherTransaction.count({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { transactionDate: dateFilter }),
      },
    }),
  ]);

  const totalSubmissionExpense = await prisma.farmerSubmission.aggregate({
    where: {
      status: 'PAID',
      ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
    },
    _sum: { totalAmount: true },
  });

  const totalVoucherExpense = await prisma.voucherTransaction.aggregate({
    where: {
      ...(Object.keys(dateFilter).length > 0 && { transactionDate: dateFilter }),
    },
    _sum: { discountAmount: true },
  });

  return {
    submissions,
    voucherTransactions,
    totalSubmissionExpense: totalSubmissionExpense._sum.totalAmount || 0,
    totalVoucherExpense: totalVoucherExpense._sum.discountAmount || 0,
    totalExpense: (totalSubmissionExpense._sum.totalAmount || 0) + (totalVoucherExpense._sum.discountAmount || 0),
    pagination: {
      page,
      limit,
      totalSubmissions: submissionCount,
      totalVouchers: voucherCount,
      totalPages: Math.ceil(Math.max(submissionCount, voucherCount) / limit),
    },
  };
};

// Get Sales Summary
export const getSalesSummaryService = async (filters: SalesFilters) => {
  const revenue = await getRevenueService(filters);
  const expense = await getExpenseService(filters);

  return {
    revenue: {
      orders: revenue.totalOrderRevenue,
      subscriptions: revenue.totalSubscriptionRevenue,
      total: revenue.totalRevenue,
    },
    expense: {
      submissions: expense.totalSubmissionExpense,
      vouchers: expense.totalVoucherExpense,
      total: expense.totalExpense,
    },
    profit: revenue.totalRevenue - expense.totalExpense,
    profitMargin: revenue.totalRevenue > 0 ? ((revenue.totalRevenue - expense.totalExpense) / revenue.totalRevenue) * 100 : 0,
  };
};

// Get Sales Analytics
export const getSalesAnalyticsService = async (filters: SalesFilters) => {
  const { startDate, endDate } = filters;
  
  const dateFilter = startDate && endDate ? {
    gte: startDate,
    lte: endDate,
  } : {};

  // Monthly revenue trend
  let monthlyRevenue;
  if (Object.keys(dateFilter).length > 0) {
    monthlyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "paidAt") as month,
        SUM("totalAmount") as revenue
      FROM "Order" 
      WHERE "paymentStatus" = 'COMPLETED'
        AND "paidAt" >= ${startDate}
        AND "paidAt" <= ${endDate}
      GROUP BY DATE_TRUNC('month', "paidAt")
      ORDER BY month DESC
      LIMIT 12
    `;
  } else {
    monthlyRevenue = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "paidAt") as month,
        SUM("totalAmount") as revenue
      FROM "Order" 
      WHERE "paymentStatus" = 'COMPLETED'
      GROUP BY DATE_TRUNC('month', "paidAt")
      ORDER BY month DESC
      LIMIT 12
    `;
  }

  // Top restaurants by revenue
  const topRestaurants = await prisma.order.groupBy({
    by: ['restaurantId'],
    where: {
      paymentStatus: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 && { paidAt: dateFilter }),
    },
    _sum: { totalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { totalAmount: 'desc' } },
    take: 10,
  });

  const restaurantDetails = await prisma.restaurant.findMany({
    where: { id: { in: topRestaurants.map(r => r.restaurantId) } },
    select: { id: true, name: true },
  });

  const topRestaurantsWithNames = topRestaurants.map(restaurant => ({
    ...restaurant,
    name: restaurantDetails.find(r => r.id === restaurant.restaurantId)?.name || 'Unknown',
  }));

  return {
    monthlyRevenue,
    topRestaurants: topRestaurantsWithNames,
  };
};