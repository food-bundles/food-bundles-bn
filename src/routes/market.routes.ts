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
} from "../controllers/market.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const marketRoutes = Router();

// Market CRUD operations (Admin only)
marketRoutes.post("/", isAuthenticated, checkPermission("ADMIN"), createMarket);

marketRoutes.get("/", isAuthenticated, getAllMarkets);

marketRoutes.get("/:marketId", isAuthenticated, getMarketById);

marketRoutes.put(
  "/:marketId",
  isAuthenticated,
  checkPermission("ADMIN"),
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
  checkPermission("ADMIN"),
  recordMarketPrice,
);

marketRoutes.get("/prices/history", isAuthenticated, getPriceHistory);

marketRoutes.post("/prices/analyze", isAuthenticated, analyzePrice);

marketRoutes.get(
  "/prices/by-product",
  isAuthenticated,
  getMarketPricesByProduct,
);

marketRoutes.put(
  "/prices/:historyId",
  isAuthenticated,
  checkPermission("ADMIN"),
  updateMarketPriceHistory,
);

marketRoutes.delete(
  "/prices/:historyId",
  isAuthenticated,
  checkPermission("ADMIN"),
  deleteMarketPriceHistory,
);

export default marketRoutes;
