import { Request, Response, NextFunction } from "express";
import { catchAsyncError } from "../utils/errorhandler.utlity";
import errorHandler from "../utils/errorhandler.utlity";
import { AnalyticsEarningsService } from "../services/analyticsEarnings.service";
import { ActivityMonitoringService } from "../services/activityMonitoring.service";
import { FarmingProfileService } from "../services/farmingProfile.service";
import {
  getFarmerVoucherApplications,
  getFarmerVouchers,
  checkFarmerVoucherEligibility,
  getFarmerVoucherSummary,
} from "../services/farmerVoucher.service";

const FARM_INFO_KEYS = [
  "farmSize",
  "farmSizeUnit",
  "experienceYears",
  "cooperativeMember",
  "cooperativeName",
  "certifications",
  "farmingMethod",
] as const;

const BUSINESS_PREF_KEYS = [
  "preferredPaymentMethod",
  "minimumOrderQuantity",
  "deliveryPreference",
  "maxDeliveryDistance",
] as const;

const FARM_SIZE_UNITS = ["HECTARES", "ACRES"];
const FARMING_METHODS = ["ORGANIC", "CONVENTIONAL", "MIXED"];
const PAYMENT_METHODS = ["MOBILE_MONEY", "BANK_TRANSFER", "CASH"];
const DELIVERY_PREFERENCES = [
  "FARM_PICKUP",
  "COOPERATIVE_CENTER",
  "MARKET_DELIVERY",
];

const requirePhone = (req: Request, next: NextFunction): string | null => {
  const phone = (req as any).user?.phone;
  if (!phone) {
    next(
      new errorHandler({
        message: "A phone number is required on your account for this feature",
        statusCode: 400,
      })
    );
    return null;
  }
  return phone;
};

export const getEarningsSummaryController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const summary = await AnalyticsEarningsService.getIncomesSummary(phone);
    if (!summary) {
      return next(
        new errorHandler({
          message: "Unable to compute earnings summary",
          statusCode: 404,
        })
      );
    }

    res.status(200).json({
      success: true,
      message: "Earnings summary retrieved successfully",
      data: summary,
    });
  }
);

export const getPerformanceController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const performance = await AnalyticsEarningsService.getPerformanceMetrics(
      phone
    );
    if (!performance) {
      return next(
        new errorHandler({
          message: "Unable to compute performance metrics",
          statusCode: 404,
        })
      );
    }

    const topProducts = (performance.topProducts || []).map((p: any) => ({
      productName: p.productName,
      totalEarnings: p._sum?.totalAmount || 0,
      submissionCount: p._count?.productName || 0,
    }));

    res.status(200).json({
      success: true,
      message: "Performance metrics retrieved successfully",
      data: { ...performance, topProducts },
    });
  }
);

export const getComparisonController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const comparison = await AnalyticsEarningsService.getComparisonAnalytics(
      phone
    );
    if (!comparison) {
      return next(
        new errorHandler({
          message: "Unable to compute comparison analytics",
          statusCode: 404,
        })
      );
    }

    res.status(200).json({
      success: true,
      message: "Comparison analytics retrieved successfully",
      data: comparison,
    });
  }
);

export const getPaymentHistoryController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 100)
      : 10;

    const history = await AnalyticsEarningsService.getPaymentHistory(
      phone,
      limit
    );

    res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: Array.isArray(history)
        ? { recentPayments: [], pendingAmount: 0, pendingCount: 0 }
        : history,
    });
  }
);

export const getEarningsTimeSeriesController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const rawMonths = parseInt(req.query.months as string, 10);
    const months = Number.isFinite(rawMonths)
      ? Math.min(Math.max(rawMonths, 1), 12)
      : 12;

    const series = await AnalyticsEarningsService.getEarningsTimeSeries(
      phone,
      months
    );

    res.status(200).json({
      success: true,
      message: "Earnings time series retrieved successfully",
      data: series,
    });
  }
);

export const getRecentActivityController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const phone = requirePhone(req, next);
    if (!phone) return;

    const activity = await ActivityMonitoringService.getRecentActivity(phone);

    res.status(200).json({
      success: true,
      message: "Recent activity retrieved successfully",
      data: activity.map((a: any) => ({
        id: a.id,
        successful: a.successful,
        attemptTime: a.attemptTime,
        deviceInfo: a.deviceInfo ?? null,
      })),
    });
  }
);

export const getFarmingProfileController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const farmerId = (req as any).user.id;

    const profile = await FarmingProfileService.getFarmingProfile(farmerId);
    if (!profile) {
      return next(
        new errorHandler({ message: "Farming profile not found", statusCode: 404 })
      );
    }

    res.status(200).json({
      success: true,
      message: "Farming profile retrieved successfully",
      data: profile,
    });
  }
);

export const updateFarmingProfileController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const farmerId = (req as any).user.id;
    const phone = requirePhone(req, next);
    if (!phone) return;

    const body = req.body || {};
    const farmInfo: Record<string, any> = {};
    const businessPrefs: Record<string, any> = {};

    for (const key of FARM_INFO_KEYS) {
      if (body[key] !== undefined) farmInfo[key] = body[key];
    }
    for (const key of BUSINESS_PREF_KEYS) {
      if (body[key] !== undefined) businessPrefs[key] = body[key];
    }

    if (Object.keys(farmInfo).length === 0 && Object.keys(businessPrefs).length === 0) {
      return next(
        new errorHandler({ message: "No fields provided to update", statusCode: 400 })
      );
    }

    if (farmInfo.farmSizeUnit && !FARM_SIZE_UNITS.includes(farmInfo.farmSizeUnit)) {
      return next(
        new errorHandler({
          message: `farmSizeUnit must be one of: ${FARM_SIZE_UNITS.join(", ")}`,
          statusCode: 400,
        })
      );
    }
    if (farmInfo.farmingMethod && !FARMING_METHODS.includes(farmInfo.farmingMethod)) {
      return next(
        new errorHandler({
          message: `farmingMethod must be one of: ${FARMING_METHODS.join(", ")}`,
          statusCode: 400,
        })
      );
    }
    if (
      businessPrefs.preferredPaymentMethod &&
      !PAYMENT_METHODS.includes(businessPrefs.preferredPaymentMethod)
    ) {
      return next(
        new errorHandler({
          message: `preferredPaymentMethod must be one of: ${PAYMENT_METHODS.join(", ")}`,
          statusCode: 400,
        })
      );
    }
    if (
      businessPrefs.deliveryPreference &&
      !DELIVERY_PREFERENCES.includes(businessPrefs.deliveryPreference)
    ) {
      return next(
        new errorHandler({
          message: `deliveryPreference must be one of: ${DELIVERY_PREFERENCES.join(", ")}`,
          statusCode: 400,
        })
      );
    }

    const tasks: Promise<boolean>[] = [];
    if (Object.keys(farmInfo).length > 0) {
      tasks.push(FarmingProfileService.updateFarmInformation(phone, farmInfo));
    }
    if (Object.keys(businessPrefs).length > 0) {
      tasks.push(
        FarmingProfileService.updateBusinessPreferences(phone, businessPrefs)
      );
    }

    const results = await Promise.all(tasks);
    if (results.some((ok) => !ok)) {
      return next(
        new errorHandler({
          message: "Failed to update farming profile",
          statusCode: 400,
        })
      );
    }

    const updated = await FarmingProfileService.getFarmingProfile(farmerId);

    res.status(200).json({
      success: true,
      message: "Farming profile updated successfully",
      data: updated,
    });
  }
);

export const getVoucherSummaryController = catchAsyncError(
  async (req: Request, res: Response) => {
    const farmerId = (req as any).user.id;
    const summary = await getFarmerVoucherSummary(farmerId);

    res.status(200).json({
      success: true,
      message: "Voucher summary retrieved successfully",
      data: summary,
    });
  }
);

export const getVouchersController = catchAsyncError(
  async (req: Request, res: Response) => {
    const farmerId = (req as any).user.id;
    const vouchers = await getFarmerVouchers(farmerId);

    res.status(200).json({
      success: true,
      message: "Vouchers retrieved successfully",
      data: vouchers,
    });
  }
);

export const getLoanApplicationsController = catchAsyncError(
  async (req: Request, res: Response) => {
    const farmerId = (req as any).user.id;
    const applications = await getFarmerVoucherApplications(farmerId);

    res.status(200).json({
      success: true,
      message: "Loan applications retrieved successfully",
      data: applications,
    });
  }
);

export const getVoucherEligibilityController = catchAsyncError(
  async (req: Request, res: Response) => {
    const farmerId = (req as any).user.id;
    const eligibility = await checkFarmerVoucherEligibility(farmerId);

    res.status(200).json({
      success: true,
      message: "Voucher eligibility checked successfully",
      data: eligibility,
    });
  }
);

export const getDashboardSummaryController = catchAsyncError(
  async (req: Request, res: Response) => {
    const farmerId = (req as any).user.id;
    const phone = (req as any).user.phone;

    const [earnings, vouchers, farmingProfile] = await Promise.all([
      phone ? AnalyticsEarningsService.getIncomesSummary(phone) : null,
      getFarmerVoucherSummary(farmerId),
      FarmingProfileService.getFarmingProfile(farmerId),
    ]);

    const profileComplete = !!farmingProfile?.FarmerProfile?.farmSize;

    res.status(200).json({
      success: true,
      message: "Dashboard summary retrieved successfully",
      data: { earnings, vouchers, profileComplete },
    });
  }
);
