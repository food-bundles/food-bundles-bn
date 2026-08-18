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
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const marketRoutes = Router();

// Market CRUD operations
marketRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  createMarket,
);

marketRoutes.get("/", isAuthenticated, getAllMarkets);

marketRoutes.get("/:marketId", isAuthenticated, getMarketById);

marketRoutes.put(
  "/:marketId",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  updateMarket,
);

marketRoutes.delete(
  "/:marketId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteMarket,
);

// Price tracking operations
marketRoutes.post(
  "/prices",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  recordMarketPrice,
);

marketRoutes.get("/prices/history", getPriceHistory);

marketRoutes.get("/prices/lowest-comparison", getLowestPriceComparison);

marketRoutes.post("/prices/analyze", isAuthenticated, analyzePrice);

marketRoutes.get(
  "/prices/by-product",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  getMarketPricesByProduct,
);

marketRoutes.put(
  "/prices/:historyId",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  updateMarketPriceHistory,
);

marketRoutes.delete(
  "/prices/:historyId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteMarketPriceHistory,
);

// Export endpoints
marketRoutes.get(
  "/export/markets",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  exportMarkets,
);

marketRoutes.get(
  "/export/price-history",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  exportPriceHistory,
);

marketRoutes.get(
  "/export/comparison",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR", "MARKET_PRICES"),
  exportComparison,
);

export default marketRoutes;