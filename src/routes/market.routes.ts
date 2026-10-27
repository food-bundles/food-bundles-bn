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
  bulkUpdateMarketStatus,
  bulkDeleteMarkets,
  bulkDeletePriceHistory,
} from "../controllers/market.controller";
import {
  uploadWfpCsv,
  getWfpPrices,
  getWfpAnalytics,
  getWfpFilterOptions,
  clearWfpPrices,
} from "../controllers/wfp-market.controller";
import { isAuthenticated, checkPermission, allow } from "../middleware/authMiddleware";
import { csvUpload } from "../middleware/csvUpload";

const marketRoutes = Router();

// ============================================
// WFP HISTORICAL DATASET & LIVE VISUALIZATION
// ============================================
marketRoutes.post(
  "/wfp/upload",
  isAuthenticated,
  allow.to("markets.upload_wfp"),
  csvUpload.single("file"),
  uploadWfpCsv
);

marketRoutes.get("/wfp/prices", getWfpPrices);
marketRoutes.get("/wfp/analytics", getWfpAnalytics);
marketRoutes.get("/wfp/filter-options", getWfpFilterOptions);

marketRoutes.delete(
  "/wfp/clear",
  isAuthenticated,
  allow.to("markets.clear_wfp"),
  clearWfpPrices
);

// ============================================
// MARKET CRUD OPERATIONS
// ============================================
marketRoutes.post(
  "/",
  isAuthenticated,
  allow.to("markets.create"),
  createMarket,
);

marketRoutes.get("/", isAuthenticated, getAllMarkets);

// Bulk operations (must be before /:marketId routes)
marketRoutes.patch(
  "/bulk-status",
  isAuthenticated,
  allow.to("markets.edit"),
  bulkUpdateMarketStatus,
);

marketRoutes.delete(
  "/bulk",
  isAuthenticated,
  allow.to("markets.delete"),
  bulkDeleteMarkets,
);

marketRoutes.delete(
  "/prices/bulk",
  isAuthenticated,
  allow.to("markets.delete_prices"),
  bulkDeletePriceHistory,
);

marketRoutes.get("/:marketId", isAuthenticated, getMarketById);

marketRoutes.put(
  "/:marketId",
  isAuthenticated,
  allow.to("markets.edit"),
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
  allow.to("markets.update_prices"),
  recordMarketPrice,
);

marketRoutes.get("/prices/history", getPriceHistory);

marketRoutes.get("/prices/lowest-comparison", getLowestPriceComparison);

marketRoutes.post("/prices/analyze", isAuthenticated, analyzePrice);

marketRoutes.get(
  "/prices/by-product",
  isAuthenticated,
  allow("markets"),
  getMarketPricesByProduct,
);

marketRoutes.put(
  "/prices/:historyId",
  isAuthenticated,
  allow.to("markets.update_prices"),
  updateMarketPriceHistory,
);

marketRoutes.delete(
  "/prices/:historyId",
  isAuthenticated,
  allow.to("markets.delete_prices"),
  deleteMarketPriceHistory,
);

// ============================================
// EXPORT ENDPOINTS
// ============================================
marketRoutes.get(
  "/export/markets",
  isAuthenticated,
  allow.to("markets.export"),
  exportMarkets,
);

marketRoutes.get(
  "/export/price-history",
  isAuthenticated,
  allow.to("markets.export"),
  exportPriceHistory,
);

marketRoutes.get(
  "/export/comparison",
  isAuthenticated,
  allow.to("markets.export"),
  exportComparison,
);

export default marketRoutes;