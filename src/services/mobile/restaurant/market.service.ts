import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

// Path to the AI data directory (relative to backend root or absolute)
const MARKET_DATA_DIR =
  process.env.MARKET_DATA_DIR ||
  path.resolve(__dirname, "../../../../food-bundles-ai/data/market-prices");

export type CommodityId =
  | "irishPotatoes"
  | "tomatoes"
  | "redOnions"
  | "cabbage"
  | "carrots";

export interface CommodityInfo {
  id: CommodityId;
  name: string;
  unit: string;
  columnName: string; // exact header in xlsx
}

export const COMMODITIES: CommodityInfo[] = [
  { id: "irishPotatoes", name: "Irish Potatoes", unit: "kg", columnName: "KURUZA" },
  { id: "tomatoes", name: "Tomatoes", unit: "kg", columnName: "INYANYA" },
  { id: "redOnions", name: "Red Onions", unit: "kg", columnName: "IBITUNGURU BITUKURA" },
  { id: "cabbage", name: "Cabbage", unit: "kg", columnName: "INSHYUHYU" },
  { id: "carrots", name: "Carrots", unit: "kg", columnName: "KAROTI" },
];

export interface DailyPrice {
  date: string; // ISO date string
  prices: Partial<Record<CommodityId, number>>; // avg RWF/kg across all markets that day
  byMarket?: Record<string, Partial<Record<CommodityId, number>>>; // per-market prices
}

export interface OhlcDay {
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MomentumReading {
  direction: "UP" | "FLAT" | "DOWN";
  magnitudePct: number;
}

export interface MarketComparisonRow {
  market: string;
  priceMultiplier: number;
  stock: "HIGH" | "MEDIUM" | "LOW";
  trend: number[];
  isFoodBundles?: boolean;
}

// Excel serial date → ISO string
function excelDateToIso(serial: number): string {
  const utcDays = serial - 25569;
  const ms = utcDays * 86400 * 1000;
  return new Date(ms).toISOString().split("T")[0];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((s, v) => s + v, 0) / values.length);
}

// Parse a single xlsx file, return rows: { date, commodity -> avg price }
function parseFile(filePath: string): DailyPrice[] {
  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) return [];

    // Row 1 (index 1) has column headers
    const headers: string[] = rows[1].map((h: any) =>
      h != null ? String(h).trim() : ""
    );

    // Find column indices for each commodity
    const colIndex: Partial<Record<CommodityId, number>> = {};
    for (const commodity of COMMODITIES) {
      const idx = headers.indexOf(commodity.columnName);
      if (idx !== -1) colIndex[commodity.id] = idx;
    }

    const dateColIdx = headers.indexOf("Date");
    if (dateColIdx === -1) return [];

    const marketColIdx = headers.indexOf("ISOKO");

    // Group prices by date and market
    const byDate = new Map<string, { all: Partial<Record<CommodityId, number[]>>; byMarket: Record<string, Partial<Record<CommodityId, number[]>>> }>();

    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      const rawDate = row[dateColIdx];
      if (!rawDate || typeof rawDate !== "number") continue;
      const dateStr = excelDateToIso(rawDate);
      const marketName = marketColIdx !== -1 && row[marketColIdx] ? String(row[marketColIdx]).trim() : "";

      if (!byDate.has(dateStr)) byDate.set(dateStr, { all: {}, byMarket: {} });
      const entry = byDate.get(dateStr)!;

      if (marketName && !entry.byMarket[marketName]) entry.byMarket[marketName] = {};

      for (const commodity of COMMODITIES) {
        const ci = colIndex[commodity.id];
        if (ci === undefined) continue;
        const val = row[ci];
        if (val == null || typeof val !== "number" || val <= 0) continue;
        if (!entry.all[commodity.id]) entry.all[commodity.id] = [];
        (entry.all[commodity.id] as number[]).push(val);
        if (marketName) {
          if (!entry.byMarket[marketName][commodity.id]) entry.byMarket[marketName][commodity.id] = [];
          (entry.byMarket[marketName][commodity.id] as number[]).push(val);
        }
      }
    }

    return Array.from(byDate.entries()).map(([date, { all, byMarket }]) => ({
      date,
      prices: Object.fromEntries(
        Object.entries(all).map(([id, vals]) => [id, average(vals as number[])]),
      ) as Partial<Record<CommodityId, number>>,
      byMarket: Object.fromEntries(
        Object.entries(byMarket).map(([market, priceArrays]) => [
          market,
          Object.fromEntries(
            Object.entries(priceArrays).map(([id, vals]) => [id, average(vals as number[])]),
          ) as Partial<Record<CommodityId, number>>,
        ]),
      ),
    }));
  } catch {
    return [];
  }
}

// Cache so we don't re-parse on every request
let _cache: DailyPrice[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getAllDailyPrices(): DailyPrice[] {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  if (!fs.existsSync(MARKET_DATA_DIR)) {
    _cache = [];
    _cacheTime = now;
    return _cache;
  }

  const files = fs
    .readdirSync(MARKET_DATA_DIR)
    .filter((f) => f.endsWith(".xlsx"))
    .map((f) => path.join(MARKET_DATA_DIR, f));

  const allDays: DailyPrice[] = [];
  for (const file of files) {
    allDays.push(...parseFile(file));
  }

  // Merge duplicate dates (multiple files for same day)
  const merged = new Map<string, Partial<Record<CommodityId, number[]>>>();
  for (const day of allDays) {
    if (!merged.has(day.date)) merged.set(day.date, {});
    const entry = merged.get(day.date)!;
    for (const [id, price] of Object.entries(day.prices)) {
      if (!entry[id as CommodityId]) entry[id as CommodityId] = [];
      (entry[id as CommodityId] as number[]).push(price as number);
    }
  }

  // Also merge byMarket across files
  const mergedByMarket = new Map<string, Record<string, Partial<Record<CommodityId, number[]>>>>();
  for (const day of allDays) {
    if (!day.byMarket) continue;
    if (!mergedByMarket.has(day.date)) mergedByMarket.set(day.date, {});
    const entry = mergedByMarket.get(day.date)!;
    for (const [market, priceMap] of Object.entries(day.byMarket)) {
      if (!entry[market]) entry[market] = {};
      for (const [id, price] of Object.entries(priceMap)) {
        if (!entry[market][id as CommodityId]) entry[market][id as CommodityId] = [];
        (entry[market][id as CommodityId] as number[]).push(price as number);
      }
    }
  }

  _cache = Array.from(merged.entries())
    .map(([date, priceArrays]) => ({
      date,
      prices: Object.fromEntries(
        Object.entries(priceArrays).map(([id, vals]) => [id, average(vals as number[])]),
      ) as Partial<Record<CommodityId, number>>,
      byMarket: Object.fromEntries(
        Object.entries(mergedByMarket.get(date) ?? {}).map(([market, pa]) => [
          market,
          Object.fromEntries(
            Object.entries(pa).map(([id, vals]) => [id, average(vals as number[])]),
          ) as Partial<Record<CommodityId, number>>,
        ]),
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  _cacheTime = now;
  return _cache;
}

// Get last N days of prices for a commodity
export function getPriceHistory(
  commodityId: CommodityId,
  days = 7
): { date: string; price: number }[] {
  const all = getAllDailyPrices();
  return all
    .filter((d) => d.prices[commodityId] != null)
    .slice(-days)
    .map((d) => ({ date: d.date, price: d.prices[commodityId]! }));
}

// Derive OHLC from daily close prices
export function getOhlcHistory(commodityId: CommodityId): OhlcDay[] {
  const history = getPriceHistory(commodityId, 7);
  const closes = history.map((h) => h.price);
  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    const bodyTop = Math.max(open, close);
    const bodyBottom = Math.min(open, close);
    const spread = Math.max(bodyTop - bodyBottom, 1);
    return {
      open,
      high: bodyTop + Math.round(spread * 0.4) + 3,
      low: bodyBottom - Math.round(spread * 0.4) - 3,
      close,
    };
  });
}

// Compute momentum from last 7 days
export function getMomentum(commodityId: CommodityId): MomentumReading {
  const history = getPriceHistory(commodityId, 7);
  if (history.length < 2) return { direction: "FLAT", magnitudePct: 0 };
  const first = history[0].price;
  const last = history[history.length - 1].price;
  const pct = ((last - first) / first) * 100;
  const abs = Math.abs(pct);
  return {
    direction: pct > 1 ? "UP" : pct < -1 ? "DOWN" : "FLAT",
    magnitudePct: Math.round(abs * 10) / 10,
  };
}

export function momentumChangePct(commodityId: CommodityId): number {
  const m = getMomentum(commodityId);
  return m.direction === "DOWN" ? -m.magnitudePct : m.magnitudePct;
}

// Market comparison — derived from real per-market xlsx data
export function getMarketComparison(
  commodityId: CommodityId
): MarketComparisonRow[] {
  const allDays = getAllDailyPrices().slice(-5);
  const overallTrend = allDays
    .filter((d) => d.prices[commodityId] != null)
    .map((d) => d.prices[commodityId]!);
  const overallAvg = overallTrend.length > 0 ? average(overallTrend) : 1;

  // Collect per-market averages across last 5 days
  const marketPrices = new Map<string, number[]>();
  for (const day of allDays) {
    for (const [market, priceMap] of Object.entries(day.byMarket ?? {})) {
      const price = priceMap[commodityId];
      if (price == null) continue;
      if (!marketPrices.has(market)) marketPrices.set(market, []);
      marketPrices.get(market)!.push(price);
    }
  }

  if (marketPrices.size === 0) {
    // Fallback: return overall as single row
    return [{ market: "All Markets", priceMultiplier: 1, stock: "HIGH", trend: overallTrend, isFoodBundles: true }];
  }

  const rows: MarketComparisonRow[] = Array.from(marketPrices.entries())
    .map(([market, prices]) => {
      const avg = average(prices);
      const multiplier = overallAvg > 0 ? Math.round((avg / overallAvg) * 1000) / 1000 : 1;
      // Build a 5-point trend for this market from daily data
      const trend = allDays.map((d) => {
        const p = d.byMarket?.[market]?.[commodityId];
        return p ?? avg;
      });
      const stock: "HIGH" | "MEDIUM" | "LOW" =
        multiplier < 0.98 ? "HIGH" : multiplier > 1.05 ? "LOW" : "MEDIUM";
      return { market, priceMultiplier: multiplier, stock, trend };
    })
    .sort((a, b) => a.priceMultiplier - b.priceMultiplier);

  return rows;
}

// RSI (14-day simplified)
export function getRsi(commodityId: CommodityId): number {
  const history = getPriceHistory(commodityId, 14);
  if (history.length < 2) return 50;
  let gains = 0,
    losses = 0;
  for (let i = 1; i < history.length; i++) {
    const diff = history[i].price - history[i - 1].price;
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return Math.round(100 - 100 / (1 + rs));
}
