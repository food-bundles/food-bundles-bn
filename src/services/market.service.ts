import prisma from "../prisma";

// Create market
export const createMarketService = async (data: {
  name: string;
  createdBy: string;
  location?: string;
  province?: string;
  district?: string;
}) => {
  const existingMarket = await prisma.market.findUnique({
    where: { name: data.name },
  });

  if (existingMarket) {
    throw new Error("Market with this name already exists");
  }

  return await prisma.market.create({ data });
};

// Get all markets
export const getAllMarketsService = async (filters?: {
  page?: number;
  limit?: number;
  province?: string;
  district?: string;
  isActive?: boolean;
}) => {
  const { page = 1, limit = 10, province, district, isActive } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (province) where.province = province;
  if (district) where.district = district;
  if (isActive !== undefined) where.isActive = isActive;

  const [markets, total] = await Promise.all([
    prisma.market.findMany({
      where,
      include: {
        priceHistory: true,
        admin: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.market.count({ where }),
  ]);

  return {
    markets,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Get market by ID
export const getMarketByIdService = async (marketId: string) => {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      priceHistory: {
        include: { product: true, admin: true },
        orderBy: { recordedDate: "desc" },
        take: 10,
      },
    },
  });

  if (!market) {
    throw new Error("Market not found");
  }

  return market;
};

// Update market
export const updateMarketService = async (
  marketId: string,
  data: {
    name?: string;
    location?: string;
    province?: string;
    district?: string;
    isActive?: boolean;
  },
) => {
  const market = await prisma.market.findUnique({ where: { id: marketId } });

  if (!market) {
    throw new Error("Market not found");
  }

  if (data.name && data.name !== market.name) {
    const existingMarket = await prisma.market.findUnique({
      where: { name: data.name },
    });
    if (existingMarket) {
      throw new Error("Market with this name already exists");
    }
  }

  return await prisma.market.update({
    where: { id: marketId },
    data,
  });
};

// Delete market
export const deleteMarketService = async (marketId: string) => {
  const market = await prisma.market.findUnique({ where: { id: marketId } });

  if (!market) {
    throw new Error("Market not found");
  }

  return await prisma.market.delete({ where: { id: marketId } });
};

// Record market price
export const recordMarketPriceService = async (data: {
  productId: string;
  marketId: string;
  marketPrice: number;
  recordedBy: string;
  recordedDate?: Date;
}) => {
  const [product, market] = await Promise.all([
    prisma.product.findUnique({ where: { id: data.productId } }),
    prisma.market.findUnique({ where: { id: data.marketId } }),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }

  if (!market) {
    throw new Error("Market not found");
  }

  return await prisma.marketPriceHistory.create({
    data: {
      productId: data.productId,
      marketId: data.marketId,
      ourPrice: product.unitPrice,
      marketPrice: data.marketPrice,
      recordedBy: data.recordedBy,
      recordedDate: data.recordedDate || new Date(),
    },
    include: {
      product: true,
      market: true,
      admin: true,
    },
  });
};

// Get price history
export const getPriceHistoryService = async (filters: {
  productId?: string;
  marketId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) => {
  const {
    productId,
    marketId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (productId) where.productId = productId;
  if (marketId) where.marketId = marketId;
  if (startDate || endDate) {
    where.recordedDate = {};
    if (startDate) where.recordedDate.gte = startDate;
    if (endDate) where.recordedDate.lte = endDate;
  }

  const [history, total] = await Promise.all([
    prisma.marketPriceHistory.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: { select: { id: true, productName: true, unitPrice: true } },
        market: {
          select: { id: true, name: true, province: true, district: true },
        },
        admin: true,
      },
      orderBy: { recordedDate: "desc" },
    }),
    prisma.marketPriceHistory.count({ where }),
  ]);

  return {
    history,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Price analysis for a product across markets
export const analyzePriceService = async (data: {
  productId: string;
  marketIds?: string[];
  startDate: Date;
  endDate: Date;
}) => {
  const { productId, marketIds, startDate, endDate } = data;

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  const where: any = {
    productId,
    recordedDate: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (marketIds && marketIds.length > 0) {
    where.marketId = { in: marketIds };
  }

  const priceHistory = await prisma.marketPriceHistory.findMany({
    where,
    include: {
      market: true,
      admin: true,
    },
    orderBy: { recordedDate: "asc" },
  });

  if (priceHistory.length === 0) {
    return {
      product: {
        id: product.id,
        name: product.productName,
        currentPrice: product.unitPrice,
      },
      analysis: {
        totalRecords: 0,
        message: "No price data available for the selected period",
      },
    };
  }

  // Calculate statistics
  const ourPrices = priceHistory.map((h) => h.ourPrice);
  const marketPrices = priceHistory.map((h) => h.marketPrice);
  const priceDifferences = priceHistory.map((h) => h.ourPrice - h.marketPrice);

  const avgOurPrice = ourPrices.reduce((a, b) => a + b, 0) / ourPrices.length;
  const avgMarketPrice =
    marketPrices.reduce((a, b) => a + b, 0) / marketPrices.length;
  const avgDifference =
    priceDifferences.reduce((a, b) => a + b, 0) / priceDifferences.length;

  const minMarketPrice = Math.min(...marketPrices);
  const maxMarketPrice = Math.max(...marketPrices);

  // Group by market
  const byMarket = priceHistory.reduce((acc: any, record) => {
    const marketId = record.marketId;
    if (!acc[marketId]) {
      acc[marketId] = {
        market: record.market,
        records: [],
        avgMarketPrice: 0,
        avgOurPrice: 0,
        avgDifference: 0,
      };
    }
    acc[marketId].records.push(record);
    return acc;
  }, {});

  // Calculate per-market statistics
  Object.keys(byMarket).forEach((marketId) => {
    const marketData = byMarket[marketId];
    const records = marketData.records;
    marketData.avgMarketPrice =
      records.reduce((sum: number, r: any) => sum + r.marketPrice, 0) /
      records.length;
    marketData.avgOurPrice =
      records.reduce((sum: number, r: any) => sum + r.ourPrice, 0) /
      records.length;
    marketData.avgDifference =
      marketData.avgOurPrice - marketData.avgMarketPrice;
    marketData.priceStatus =
      marketData.avgDifference > 0
        ? "HIGHER"
        : marketData.avgDifference < 0
          ? "LOWER"
          : "EQUAL";
    marketData.profitLoss =
      marketData.avgDifference > 0
        ? "PROFIT"
        : marketData.avgDifference < 0
          ? "LOSS"
          : "BREAK_EVEN";
  });

  return {
    product: {
      id: product.id,
      name: product.productName,
      currentPrice: product.unitPrice,
    },
    period: {
      startDate,
      endDate,
    },
    analysis: {
      totalRecords: priceHistory.length,
      avgOurPrice: parseFloat(avgOurPrice.toFixed(2)),
      avgMarketPrice: parseFloat(avgMarketPrice.toFixed(2)),
      avgDifference: parseFloat(avgDifference.toFixed(2)),
      minMarketPrice,
      maxMarketPrice,
      priceStatus:
        avgDifference > 0 ? "HIGHER" : avgDifference < 0 ? "LOWER" : "EQUAL",
      profitLoss:
        avgDifference > 0
          ? "PROFIT"
          : avgDifference < 0
            ? "LOSS"
            : "BREAK_EVEN",
      percentageDifference: parseFloat(
        ((avgDifference / avgMarketPrice) * 100).toFixed(2),
      ),
    },
    marketBreakdown: Object.values(byMarket).map((m: any) => ({
      market: {
        id: m.market.id,
        name: m.market.name,
        location: m.market.location,
        province: m.market.province,
        district: m.market.district,
      },
      recordCount: m.records.length,
      avgMarketPrice: parseFloat(m.avgMarketPrice.toFixed(2)),
      avgOurPrice: parseFloat(m.avgOurPrice.toFixed(2)),
      avgDifference: parseFloat(m.avgDifference.toFixed(2)),
      priceStatus: m.priceStatus,
      profitLoss: m.profitLoss,
      percentageDifference: parseFloat(
        ((m.avgDifference / m.avgMarketPrice) * 100).toFixed(2),
      ),
    })),
    priceHistory: priceHistory.map((h) => ({
      id: h.id,
      ourPrice: h.ourPrice,
      marketPrice: h.marketPrice,
      difference: h.ourPrice - h.marketPrice,
      recordedDate: h.recordedDate,
      market: {
        id: h.market.id,
        name: h.market.name,
      },
    })),
  };
};

// Update market price history
export const updateMarketPriceHistoryService = async (
  historyId: string,
  data: {
    marketPrice?: number;
    recordedDate?: Date;
  },
) => {
  const history = await prisma.marketPriceHistory.findUnique({
    where: { id: historyId },
  });

  if (!history) {
    throw new Error("Price history record not found");
  }

  return await prisma.marketPriceHistory.update({
    where: { id: historyId },
    data,
    include: {
      product: true,
      market: true,
    },
  });
};

// Delete market price history
export const deleteMarketPriceHistoryService = async (historyId: string) => {
  const history = await prisma.marketPriceHistory.findUnique({
    where: { id: historyId },
  });

  if (!history) {
    throw new Error("Price history record not found");
  }

  return await prisma.marketPriceHistory.delete({ where: { id: historyId } });
};

// Get market prices by product
export const getMarketPricesByProductService = async (filters: {
  productId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}) => {
  const { productId, startDate, endDate, page = 1, limit = 50 } = filters;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (productId) where.productId = productId;
  if (startDate || endDate) {
    where.recordedDate = {};
    if (startDate) where.recordedDate.gte = startDate;
    if (endDate) where.recordedDate.lte = endDate;
  }

  const [priceData, total] = await Promise.all([
    prisma.marketPriceHistory.findMany({
      where,
      skip,
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            unitPrice: true,
          },
        },
        market: {
          select: {
            id: true,
            name: true,
            province: true,
            district: true,
          },
        },
      },
      orderBy: { recordedDate: "desc" },
    }),
    prisma.marketPriceHistory.count({ where }),
  ]);

  return {
    data: priceData.map((item) => ({
      id: item.id,
      product: {
        id: item.product.id,
        name: item.product.productName,
      },
      market: {
        id: item.market.id,
        name: item.market.name,
        province: item.market.province,
        district: item.market.district,
      },
      ourPrice: item.ourPrice,
      marketPrice: item.marketPrice,
      difference: item.ourPrice - item.marketPrice,
      recordedDate: item.recordedDate,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Export markets to CSV/Excel
export const exportMarketsService = async (format: string = 'csv') => {
  const markets = await prisma.market.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const headers = ['Market Name', 'Location', 'Province', 'District', 'Status', 'Created Date'];
  const rows = markets.map(m => [
    `"${m.name}"`,
    `"${m.location || ''}"`,
    `"${m.province || ''}"`,
    `"${m.district || ''}"`,
    m.isActive ? 'Active' : 'Inactive',
    new Date(m.createdAt).toLocaleDateString(),
  ]);

  if (format === 'csv') {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return {
      data: csv,
      contentType: 'text/csv',
      filename: `markets_${Date.now()}.csv`,
    };
  }

  const tsv = [headers.join('\t'), ...rows.map(r => r.map(c => c.replace(/"/g, '')).join('\t'))].join('\n');
  return {
    data: tsv,
    contentType: 'application/vnd.ms-excel',
    filename: `markets_${Date.now()}.xls`,
  };
};

// Export price history to CSV/Excel
export const exportPriceHistoryService = async (format: string = 'csv') => {
  const history = await prisma.marketPriceHistory.findMany({
    include: {
      product: { select: { productName: true } },
      market: { select: { name: true, district: true, province: true } },
    },
    orderBy: { recordedDate: 'desc' },
  });

  const headers = ['Product', 'Market Name', 'Location', 'Our Price (RWF)', 'Market Price (RWF)', 'Difference (RWF)', 'Recorded Date'];
  const rows = history.map(h => [
    `"${h.product.productName}"`,
    `"${h.market.name}"`,
    `"${h.market.district}, ${h.market.province}"`,
    h.ourPrice.toString(),
    h.marketPrice.toString(),
    (h.ourPrice - h.marketPrice).toString(),
    new Date(h.recordedDate).toLocaleDateString(),
  ]);

  if (format === 'csv') {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return {
      data: csv,
      contentType: 'text/csv',
      filename: `price_history_${Date.now()}.csv`,
    };
  }

  const tsv = [headers.join('\t'), ...rows.map(r => r.map(c => c.replace(/"/g, '')).join('\t'))].join('\n');
  return {
    data: tsv,
    contentType: 'application/vnd.ms-excel',
    filename: `price_history_${Date.now()}.xls`,
  };
};

// Export comparison to CSV/Excel
export const exportComparisonService = async (format: string = 'csv') => {
  const history = await prisma.marketPriceHistory.findMany({
    include: {
      product: { select: { productName: true } },
      market: { select: { name: true, district: true, province: true } },
    },
    orderBy: { recordedDate: 'desc' },
  });

  const headers = ['Product', 'Our Price (RWF)', 'Market Name', 'Market Price (RWF)', 'Difference (RWF)', 'Status', 'Location', 'Recorded Date'];
  const rows = history.map(h => {
    const diff = h.ourPrice - h.marketPrice;
    const isProfit = diff < 0;
    const percentChange = ((Math.abs(diff) / h.ourPrice) * 100).toFixed(1);
    return [
      `"${h.product.productName}"`,
      h.ourPrice.toString(),
      `"${h.market.name}"`,
      h.marketPrice.toString(),
      `${isProfit ? '-' : '+'}${Math.abs(diff)}`,
      `${isProfit ? 'PROFIT' : 'LOSS'} (${percentChange}%)`,
      `"${h.market.district}, ${h.market.province}"`,
      new Date(h.recordedDate).toLocaleDateString(),
    ];
  });

  if (format === 'csv') {
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return {
      data: csv,
      contentType: 'text/csv',
      filename: `price_comparison_${Date.now()}.csv`,
    };
  }

  const tsv = [headers.join('\t'), ...rows.map(r => r.map(c => c.replace(/"/g, '')).join('\t'))].join('\n');
  return {
    data: tsv,
    contentType: 'application/vnd.ms-excel',
    filename: `price_comparison_${Date.now()}.xls`,
  };
};
