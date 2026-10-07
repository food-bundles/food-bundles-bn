import fs from "fs";
import readline from "readline";
import prisma from "../prisma";

interface CsvRowData {
  date: string;
  admin1?: string;
  admin2?: string;
  market: string;
  market_id?: string;
  latitude?: string;
  longitude?: string;
  category: string;
  commodity: string;
  commodity_id?: string;
  unit?: string;
  priceflag?: string;
  pricetype?: string;
  currency?: string;
  price: string;
  usdprice?: string;
}

// Parse date string like "1/15/2000" or "2000-01-15"
function parseCsvDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(Date.UTC(year, month, day));
    }
  }
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Fast CSV line splitter handling quoted strings
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// High-speed streaming ingestion for WFP Rwanda CSV
export const importWfpCsvService = async (
  filePath: string,
  adminId?: string
) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at path: ${filePath}`);
  }

  const startTime = Date.now();
  const fileStream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isHeader = true;
  let headers: string[] = [];
  let totalRows = 0;
  let insertedCount = 0;
  const batchSize = 2000;
  let batch: any[] = [];
  const discoveredMarkets = new Map<
    string,
    { province?: string; district?: string; location?: string }
  >();

  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;

  for await (const line of rl) {
    if (!line || line.trim() === "") continue;

    if (isHeader) {
      headers = parseCsvLine(line).map((h) => h.toLowerCase().trim());
      isHeader = false;
      continue;
    }

    const cols = parseCsvLine(line);
    if (cols.length < headers.length) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || "";
    });

    const marketName = row["market"] || "Unknown Market";
    const commodity = row["commodity"] || "Unknown";
    const priceVal = parseFloat(row["price"]);
    if (isNaN(priceVal)) continue;

    const date = parseCsvDate(row["date"]);
    if (!earliestDate || date < earliestDate) earliestDate = date;
    if (!latestDate || date > latestDate) latestDate = date;

    const province = row["admin1"] || null;
    const district = row["admin2"] || null;

    if (marketName && !discoveredMarkets.has(marketName)) {
      discoveredMarkets.set(marketName, {
        province: province || undefined,
        district: district || undefined,
        location:
          row["latitude"] && row["longitude"]
            ? `${row["latitude"]}, ${row["longitude"]}`
            : undefined,
      });
    }

    batch.push({
      date,
      province,
      district,
      marketName,
      marketId: row["market_id"] ? parseInt(row["market_id"], 10) : null,
      latitude: row["latitude"] ? parseFloat(row["latitude"]) : null,
      longitude: row["longitude"] ? parseFloat(row["longitude"]) : null,
      category: row["category"] || "Other",
      commodity,
      commodityId: row["commodity_id"]
        ? parseInt(row["commodity_id"], 10)
        : null,
      unit: row["unit"] || "KG",
      priceFlag: row["priceflag"] || null,
      priceType: row["pricetype"] || "Wholesale",
      currency: row["currency"] || "RWF",
      price: priceVal,
      usdPrice: row["usdprice"] ? parseFloat(row["usdprice"]) : null,
    });

    totalRows++;

    if (batch.length >= batchSize) {
      await prisma.wfpMarketPrice.createMany({
        data: batch,
        skipDuplicates: true,
      });
      insertedCount += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.wfpMarketPrice.createMany({
      data: batch,
      skipDuplicates: true,
    });
    insertedCount += batch.length;
    batch = [];
  }

  // WFP market surveillance points are kept isolated inside WfpMarketPrice table
  // and do NOT pollute the FoodBundles internal Market / MarketPriceHistory tables.
  const durationMs = Date.now() - startTime;

  return {
    success: true,
    totalRows,
    insertedCount,
    marketsDiscovered: discoveredMarkets.size,
    marketsCreated: 0,
    dateRange: {
      earliest: earliestDate,
      latest: latestDate,
    },
    durationSeconds: (durationMs / 1000).toFixed(2),
  };
};

// Query paginated prices with multi-filters
export const getWfpPricesService = async (filters: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  commodity?: string;
  market?: string;
  province?: string;
  district?: string;
  priceType?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "date" | "price" | "commodity" | "marketName";
  sortOrder?: "asc" | "desc";
}) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    commodity,
    market,
    province,
    district,
    priceType,
    startDate,
    endDate,
    sortBy = "date",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where: any = {};

  if (search && search.trim() !== "") {
    const query = search.trim();
    where.OR = [
      { commodity: { contains: query, mode: "insensitive" } },
      { marketName: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
      { district: { contains: query, mode: "insensitive" } },
      { province: { contains: query, mode: "insensitive" } },
    ];
  }

  if (category && category !== "ALL") where.category = category;
  if (commodity && commodity !== "ALL") where.commodity = commodity;
  if (market && market !== "ALL") where.marketName = market;
  if (province && province !== "ALL") where.province = province;
  if (district && district !== "ALL") where.district = district;
  if (priceType && priceType !== "ALL") where.priceType = priceType;

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  const [prices, total] = await Promise.all([
    prisma.wfpMarketPrice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.wfpMarketPrice.count({ where }),
  ]);

  return {
    prices,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Analytics & Visualizations Service
export const getWfpAnalyticsService = async (filters: {
  commodity?: string;
  category?: string;
  market?: string;
  province?: string;
  priceType?: string;
  startDate?: string;
  endDate?: string;
}) => {
  const {
    commodity = "Maize",
    category,
    market,
    province,
    priceType = "ALL",
    startDate,
    endDate,
  } = filters;

  // 1. Overall Dataset Metrics
  const [totalRecords, countMarkets, countCommodities, earliestRec, latestRec] =
    await Promise.all([
      prisma.wfpMarketPrice.count(),
      prisma.wfpMarketPrice.groupBy({
        by: ["marketName"],
        _count: true,
      }),
      prisma.wfpMarketPrice.groupBy({
        by: ["commodity"],
        _count: true,
      }),
      prisma.wfpMarketPrice.findFirst({
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      prisma.wfpMarketPrice.findFirst({
        orderBy: { date: "desc" },
        select: { date: true },
      }),
    ]);

  // 2. Filter condition for commodity time-series
  const trendWhere: any = {};
  if (commodity && commodity !== "ALL") trendWhere.commodity = commodity;
  if (category && category !== "ALL") trendWhere.category = category;
  if (market && market !== "ALL") trendWhere.marketName = market;
  if (province && province !== "ALL") trendWhere.province = province;
  if (priceType && priceType !== "ALL") trendWhere.priceType = priceType;

  if (startDate || endDate) {
    trendWhere.date = {};
    if (startDate) trendWhere.date.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      trendWhere.date.lte = end;
    }
  }

  // Fetch prices for time series
  const rawPriceRecords = await prisma.wfpMarketPrice.findMany({
    where: trendWhere,
    select: {
      date: true,
      price: true,
      marketName: true,
      province: true,
      district: true,
      latitude: true,
      longitude: true,
      commodity: true,
      priceType: true,
      unit: true,
    },
    orderBy: { date: "asc" },
    take: 50000,
  });

  // Group by date (YYYY-MM) and calculate average price and market breakdown
  const timeMap = new Map<
    string,
    {
      date: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      count: number;
      sum: number;
      markets: Record<string, { sum: number; count: number }>;
    }
  >();

  const marketPriceMap = new Map<
    string,
    {
      sum: number;
      count: number;
      province?: string;
      district?: string;
      latitude?: number;
      longitude?: number;
      latestPrice?: number;
      latestDate?: Date;
    }
  >();

  let overallMinPrice = Infinity;
  let overallMaxPrice = -Infinity;
  let overallSumPrice = 0;

  for (const item of rawPriceRecords) {
    const monthKey = item.date.toISOString().substring(0, 7); // "YYYY-MM"
    overallSumPrice += item.price;
    if (item.price < overallMinPrice) overallMinPrice = item.price;
    if (item.price > overallMaxPrice) overallMaxPrice = item.price;

    // By Time
    if (!timeMap.has(monthKey)) {
      timeMap.set(monthKey, {
        date: monthKey,
        avgPrice: 0,
        minPrice: item.price,
        maxPrice: item.price,
        count: 0,
        sum: 0,
        markets: {},
      });
    }

    const tEntry = timeMap.get(monthKey)!;
    tEntry.count++;
    tEntry.sum += item.price;
    if (item.price < tEntry.minPrice) tEntry.minPrice = item.price;
    if (item.price > tEntry.maxPrice) tEntry.maxPrice = item.price;

    if (!tEntry.markets[item.marketName]) {
      tEntry.markets[item.marketName] = { sum: 0, count: 0 };
    }
    tEntry.markets[item.marketName].sum += item.price;
    tEntry.markets[item.marketName].count++;

    // By Market
    if (!marketPriceMap.has(item.marketName)) {
      marketPriceMap.set(item.marketName, {
        sum: 0,
        count: 0,
        province: item.province || undefined,
        district: item.district || undefined,
        latitude: item.latitude || undefined,
        longitude: item.longitude || undefined,
        latestPrice: item.price,
        latestDate: item.date,
      });
    }
    const mEntry = marketPriceMap.get(item.marketName)!;
    mEntry.sum += item.price;
    mEntry.count++;
    if (!mEntry.latestDate || item.date >= mEntry.latestDate) {
      mEntry.latestPrice = item.price;
      mEntry.latestDate = item.date;
    }
    if (item.latitude && !mEntry.latitude) mEntry.latitude = item.latitude;
    if (item.longitude && !mEntry.longitude) mEntry.longitude = item.longitude;
    if (item.district && !mEntry.district) mEntry.district = item.district;
    if (item.province && !mEntry.province) mEntry.province = item.province;
  }

  // Format time series data points
  const timeSeries = Array.from(timeMap.entries())
    .map(([date, val]) => {
      const point: Record<string, any> = {
        date,
        avgPrice: Math.round((val.sum / val.count) * 100) / 100,
        minPrice: Math.round(val.minPrice * 100) / 100,
        maxPrice: Math.round(val.maxPrice * 100) / 100,
      };
      Object.entries(val.markets).forEach(([mName, mStats]) => {
        point[mName] = Math.round((mStats.sum / mStats.count) * 100) / 100;
      });
      return point;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Regional breakdown by market (includes coordinates for map)
  const marketComparisons = Array.from(marketPriceMap.entries())
    .map(([marketName, stats]) => ({
      market: marketName,
      province: stats.province || "Other",
      district: stats.district || "",
      latitude: stats.latitude || null,
      longitude: stats.longitude || null,
      avgPrice: Math.round((stats.sum / stats.count) * 100) / 100,
      latestPrice: stats.latestPrice,
      dataPoints: stats.count,
    }))
    .sort((a, b) => b.avgPrice - a.avgPrice);

  // Top commodities with average prices
  const topCommodityGroups = await prisma.wfpMarketPrice.groupBy({
    by: ["commodity", "category", "unit"],
    _count: true,
    _avg: { price: true },
    orderBy: { _count: { commodity: "desc" } },
    take: 10,
  });

  const topCommodities = topCommodityGroups.map((g) => ({
    commodity: g.commodity,
    category: g.category,
    unit: g.unit,
    records: g._count,
    avgPrice: Math.round((g._avg.price || 0) * 100) / 100,
  }));

  return {
    kpis: {
      totalRecords,
      totalMarkets: countMarkets.length,
      totalCommodities: countCommodities.length,
      earliestDate: earliestRec?.date || null,
      latestDate: latestRec?.date || null,
      selectedDataPoints: rawPriceRecords.length,
      selectedAvgPrice:
        rawPriceRecords.length > 0
          ? Math.round((overallSumPrice / rawPriceRecords.length) * 100) / 100
          : 0,
      minPrice: overallMinPrice === Infinity ? 0 : overallMinPrice,
      maxPrice: overallMaxPrice === -Infinity ? 0 : overallMaxPrice,
      priceSpread:
        overallMaxPrice > 0 && overallMinPrice < Infinity
          ? Math.round((overallMaxPrice - overallMinPrice) * 100) / 100
          : 0,
    },
    timeSeries,
    marketComparisons,
    topCommodities,
  };
};

// Filter Options (Categories, Commodities, Markets, Provinces)
export const getWfpFilterOptionsService = async () => {
  const [categories, commodities, markets, provinces, districts] =
    await Promise.all([
      prisma.wfpMarketPrice.findMany({
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
      prisma.wfpMarketPrice.findMany({
        distinct: ["commodity"],
        select: { commodity: true, category: true, unit: true },
        orderBy: { commodity: "asc" },
      }),
      prisma.wfpMarketPrice.findMany({
        distinct: ["marketName"],
        select: {
          marketName: true,
          province: true,
          district: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { marketName: "asc" },
      }),
      prisma.wfpMarketPrice.findMany({
        where: { province: { not: null } },
        distinct: ["province"],
        select: { province: true },
        orderBy: { province: "asc" },
      }),
      prisma.wfpMarketPrice.findMany({
        where: { district: { not: null } },
        distinct: ["district"],
        select: { district: true },
        orderBy: { district: "asc" },
      }),
    ]);

  return {
    categories: categories.map((c) => c.category),
    commodities: commodities.map((c) => ({
      name: c.commodity,
      category: c.category,
      unit: c.unit,
    })),
    markets: markets.map((m) => ({
      name: m.marketName,
      province: m.province,
      district: m.district,
      latitude: m.latitude,
      longitude: m.longitude,
    })),
    provinces: provinces.map((p) => p.province).filter(Boolean),
    districts: districts.map((d) => d.district).filter(Boolean),
    priceTypes: ["All Types", "Retail", "Wholesale"],
  };
};

// Clear WFP data
export const clearWfpPricesService = async () => {
  const count = await prisma.wfpMarketPrice.count();
  await prisma.wfpMarketPrice.deleteMany();
  return { success: true, message: `Successfully cleared ${count} records` };
};
