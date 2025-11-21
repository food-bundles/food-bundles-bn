import { Request, Response } from "express";
import {
  getRevenueService,
  getExpenseService,
  getSalesSummaryService,
  getSalesAnalyticsService,
} from "../services/sales.services";

// Get Revenue Data
export const getRevenue = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const revenue = await getRevenueService(filters);

    res.status(200).json({
      message: "Revenue data retrieved successfully",
      data: revenue,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get revenue data",
    });
  }
};

// Get Expense Data
export const getExpense = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const expense = await getExpenseService(filters);

    res.status(200).json({
      message: "Expense data retrieved successfully",
      data: expense,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get expense data",
    });
  }
};

// Get Sales Summary
export const getSalesSummary = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    };

    const summary = await getSalesSummaryService(filters);

    res.status(200).json({
      message: "Sales summary retrieved successfully",
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get sales summary",
    });
  }
};

// Get Sales Analytics
export const getSalesAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const filters = {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    };

    const analytics = await getSalesAnalyticsService(filters);

    res.status(200).json({
      message: "Sales analytics retrieved successfully",
      data: analytics,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get sales analytics",
    });
  }
};