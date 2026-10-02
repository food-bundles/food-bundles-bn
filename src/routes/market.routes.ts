import { Router } from "express";
import {
  createMarket,
  getAllMarkets,
  getMarketById,
  updateMarket,
  deleteMarket,
  recordMarketPrice,
  getPriceHistory,
  analyzePrice,
  getMarketPricesByProduct,
  updateMarketPriceHistory,
  deleteMarketPriceHistory,
  exportMarkets,
  exportPriceHistory,
  exportComparison,
  getLowestPriceComparison,
} from "../controllers/market.controller";
import {
  uploadWfpCsv,
  getWfpPrices,
  getWfpAnalytics,
  getWfpFilterOptions,
  clearWfpPrices,
} from "../controllers/wfp-market.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import { csvUpload } from "../middleware/csvUpload";

const marketRoutes = Router();

// ============================================
// WFP HISTORICAL DATASET & LIVE VISUALIZATION
// ============================================
marketRoutes.post(
  "/wfp/upload",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  csvUpload.single("file"),
  uploadWfpCsv
);

marketRoutes.get("/wfp/prices", getWfpPrices);
marketRoutes.get("/wfp/analytics", getWfpAnalytics);
marketRoutes.get("/wfp/filter-options", getWfpFilterOptions);

marketRoutes.delete(
  "/wfp/clear",
  isAuthenticated,
  checkPermission("ADMIN"),
  clearWfpPrices
);

// ============================================
// MARKET CRUD OPERATIONS
// ============================================
marketRoutes.post(
  "/",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  createMarket,
);

marketRoutes.get("/", isAuthenticated, getAllMarkets);

marketRoutes.get("/:marketId", isAuthenticated, getMarketById);

marketRoutes.put(
  "/:marketId",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  updateMarket,
);

marketRoutes.delete(
  "/:marketId",
  isAuthenticated,
  allow("markets"),
  deleteMarket,
);

// ============================================
// PRICE TRACKING OPERATIONS
// ============================================
marketRoutes.post(
  "/prices",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  recordMarketPrice,
);

marketRoutes.get("/prices/history", getPriceHistory);

marketRoutes.get("/prices/lowest-comparison", getLowestPriceComparison);

marketRoutes.post("/prices/analyze", isAuthenticated, analyzePrice);

marketRoutes.get(
  "/prices/by-product",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  getMarketPricesByProduct,
);

marketRoutes.put(
  "/prices/:historyId",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  updateMarketPriceHistory,
);

marketRoutes.delete(
  "/prices/:historyId",
  isAuthenticated,
  allow("markets"),
  deleteMarketPriceHistory,
);

// ============================================
// EXPORT ENDPOINTS
// ============================================
marketRoutes.get(
  "/export/markets",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  exportMarkets,
);

marketRoutes.get(
  "/export/price-history",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  exportPriceHistory,
);

marketRoutes.get(
  "/export/comparison",
  isAuthenticated,
  allow("markets", "LOGISTICS", "AGGREGATOR"),
  exportComparison,
);

export default marketRoutes;