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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const marketRoutes = Router();

// Market CRUD operations
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

// Price tracking operations
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

// Export endpoints
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