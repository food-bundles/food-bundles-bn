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

// Market CRUD operations (Admin only)
marketRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  createMarket,
);

marketRoutes.get("/", isAuthenticated, getAllMarkets);

marketRoutes.get("/:marketId", isAuthenticated, getMarketById);

marketRoutes.put(
  "/:marketId",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
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
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  recordMarketPrice,
);

marketRoutes.get("/prices/history", getPriceHistory);

marketRoutes.get("/prices/lowest-comparison", getLowestPriceComparison);

marketRoutes.post("/prices/analyze", isAuthenticated, analyzePrice);

marketRoutes.get(
  "/prices/by-product",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  getMarketPricesByProduct,
);

marketRoutes.put(
  "/prices/:historyId",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
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
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  exportMarkets,
);

marketRoutes.get(
  "/export/price-history",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  exportPriceHistory,
);

marketRoutes.get(
  "/export/comparison",
  isAuthenticated,
  checkPermission("ADMIN", "LOGISTICS", "AGGREGATOR"),
  exportComparison,
);

export default marketRoutes;