import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileMarketPrices,
  mobileMarketSeries,
  mobileMarketAdvice,
  mobileMarketRanking,
  mobileRestaurantDirectory,
  mobileMarketSubstitutions,
  mobileOrderTimingInsights,
} from "../../../controllers/mobile/restaurant/market.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET /mobile/restaurant/market/prices
router.get("/prices", ...guard, mobileMarketPrices);

// GET /mobile/restaurant/market/prices/:commodityId/series?range=7D
router.get("/prices/:commodityId/series", ...guard, mobileMarketSeries);

// GET /mobile/restaurant/market/advice
router.get("/advice", ...guard, mobileMarketAdvice);

// GET /mobile/restaurant/market/ranking
router.get("/ranking", ...guard, mobileMarketRanking);

// GET /mobile/restaurant/market/restaurant-directory
router.get("/restaurant-directory", ...guard, mobileRestaurantDirectory);

// GET /mobile/restaurant/market/substitutions
router.get("/substitutions", ...guard, mobileMarketSubstitutions);

// GET /mobile/restaurant/market/order-timing-insights
router.get("/order-timing-insights", ...guard, mobileOrderTimingInsights);

export default router;
