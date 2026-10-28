import { Router } from "express";
import { isAuthenticated, allow } from "../middleware/authMiddleware";
import {
  addSiteMembersController,
  listAssignedFarmersController,
  getSiteCandidatesController,
  removeSiteMembersController,
  assignAggregatorSiteController,
  assignAllSitesController,
  createSiteController,
  assignFarmerSiteController,
  getAssignmentController,
  getSiteMembersController,
  listSitesController,
  syncSitesController,
  updateSiteController,
} from "../controllers/aggregationSite.controller";

// Admin side of the aggregation sites (the sites are seeded from the WFP market list).
// The farmer side lives under /farmers/dashboard (nearest-site, location).
const aggregationSiteRoutes = Router();

aggregationSiteRoutes.get("/", isAuthenticated, allow.to("markets.view"), listSitesController);
aggregationSiteRoutes.post("/", isAuthenticated, allow.to("markets.edit"), createSiteController);
aggregationSiteRoutes.post("/sync-wfp", isAuthenticated, allow.to("markets.edit"), syncSitesController);
aggregationSiteRoutes.post("/assign-all", isAuthenticated, allow.to("markets.edit"), assignAllSitesController);
aggregationSiteRoutes.get("/assigned-farmers", isAuthenticated, allow.to("markets.view"), listAssignedFarmersController);
aggregationSiteRoutes.get("/farmers/:farmerId",isAuthenticated, allow.to("markets.view"), getAssignmentController("farmer"));
aggregationSiteRoutes.get("/aggregators/:adminId", isAuthenticated, allow.to("markets.view"), getAssignmentController("aggregator"));
aggregationSiteRoutes.patch("/farmers/:farmerId", isAuthenticated, allow.to("markets.edit"), assignFarmerSiteController);
aggregationSiteRoutes.patch("/aggregators/:adminId", isAuthenticated, allow.to("markets.edit"), assignAggregatorSiteController);
aggregationSiteRoutes.get("/:id/members", isAuthenticated, allow.to("markets.view"), getSiteMembersController);
aggregationSiteRoutes.get("/:id/candidates", isAuthenticated, allow.to("markets.view"), getSiteCandidatesController);
aggregationSiteRoutes.post("/:id/members", isAuthenticated, allow.to("markets.edit"), addSiteMembersController);
aggregationSiteRoutes.post("/:id/members/remove", isAuthenticated, allow.to("markets.edit"), removeSiteMembersController);
aggregationSiteRoutes.patch("/:id",isAuthenticated, allow.to("markets.edit"), updateSiteController);

export default aggregationSiteRoutes;
