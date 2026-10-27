import { Router } from "express";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import {
  listSitesController,
  syncSitesController,
  updateSiteController,
} from "../controllers/aggregationSite.controller";

// Admin side of the aggregation sites (the sites are seeded from the WFP market list).
// The farmer side lives under /farmers/dashboard (nearest-site, location).
const aggregationSiteRoutes = Router();

aggregationSiteRoutes.get("/", isAuthenticated, allow.to("markets.view"), listSitesController);
aggregationSiteRoutes.post("/sync-wfp", isAuthenticated, allow.to("markets.edit"), syncSitesController);
aggregationSiteRoutes.patch("/:id", isAuthenticated, allow.to("markets.edit"), updateSiteController);

export default aggregationSiteRoutes;
