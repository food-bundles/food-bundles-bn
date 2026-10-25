import { Router } from "express";
import { Role } from "@prisma/client";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import {
  getEarningsSummaryController,
  getPerformanceController,
  getComparisonController,
  getPaymentHistoryController,
  getEarningsTimeSeriesController,
  getRecentActivityController,
  getFarmingProfileController,
  updateFarmingProfileController,
  updatePrimaryCropsController,
  addFarmerPhoneController,
  getVoucherSummaryController,
  getVouchersController,
  getLoanApplicationsController,
  getVoucherEligibilityController,
  getDashboardSummaryController,
  getCropDemandController,
  getFarmerPreferencesController,
  getFarmerReportController,
  updateFarmerPreferencesController,
} from "../controllers/farmerDashboard.controller";

import {
  getNearestSitesController,
  updateFarmerLocationController,
} from "../controllers/aggregationSite.controller";

const farmerDashboardRoutes = Router();

farmerDashboardRoutes.use(isAuthenticated, checkPermission(Role.FARMER));

farmerDashboardRoutes.get("/summary", getDashboardSummaryController);
farmerDashboardRoutes.get("/earnings-summary", getEarningsSummaryController);
farmerDashboardRoutes.get("/performance", getPerformanceController);
farmerDashboardRoutes.get("/comparison", getComparisonController);
farmerDashboardRoutes.get("/payment-history", getPaymentHistoryController);
farmerDashboardRoutes.get(
  "/earnings-timeseries",
  getEarningsTimeSeriesController
);
farmerDashboardRoutes.get("/recent-activity", getRecentActivityController);
farmerDashboardRoutes.get("/crop-demand", getCropDemandController);
farmerDashboardRoutes.get("/report", getFarmerReportController);
farmerDashboardRoutes.get("/farming-profile", getFarmingProfileController);
farmerDashboardRoutes.patch(
  "/farming-profile",
  updateFarmingProfileController
);
farmerDashboardRoutes.put("/primary-crops", updatePrimaryCropsController);
farmerDashboardRoutes.patch("/phone", addFarmerPhoneController);
farmerDashboardRoutes.get("/nearest-site", getNearestSitesController);
farmerDashboardRoutes.patch("/location", updateFarmerLocationController);
farmerDashboardRoutes.get("/preferences", getFarmerPreferencesController);
farmerDashboardRoutes.patch("/preferences", updateFarmerPreferencesController);
farmerDashboardRoutes.get("/voucher-summary", getVoucherSummaryController);
farmerDashboardRoutes.get("/vouchers", getVouchersController);
farmerDashboardRoutes.get(
  "/loan-applications",
  getLoanApplicationsController
);
farmerDashboardRoutes.get(
  "/voucher-eligibility",
  getVoucherEligibilityController
);

export default farmerDashboardRoutes;
