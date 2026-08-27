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
  getVoucherSummaryController,
  getVouchersController,
  getLoanApplicationsController,
  getVoucherEligibilityController,
  getDashboardSummaryController,
} from "../controllers/farmerDashboard.controller";

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
farmerDashboardRoutes.get("/farming-profile", getFarmingProfileController);
farmerDashboardRoutes.patch(
  "/farming-profile",
  updateFarmingProfileController
);
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
