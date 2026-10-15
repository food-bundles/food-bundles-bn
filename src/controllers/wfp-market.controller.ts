import { Request, Response } from "express";
import {
  importWfpCsvService,
  getWfpPricesService,
  getWfpAnalyticsService,
  getWfpFilterOptionsService,
  clearWfpPricesService,
} from "../services/wfp-market.service";
import prisma from "../prisma";
import fs from "fs";

// Upload and ingest WFP CSV
export const uploadWfpCsv = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded. Please upload a .csv file.",
      });
    }

    // Once-per-day guard: block if data was already uploaded today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await prisma.wfpMarketPrice.count({
      where: { createdAt: { gte: todayStart, lte: todayEnd } },
    });

    if (todayCount > 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(409).json({
        success: false,
        message: `WFP data has already been uploaded today (${todayCount.toLocaleString()} records). Upload is allowed once per day.`,
      });
    }

    const filePath = req.file.path;
    const result = await importWfpCsvService(filePath, adminId);

    // Clean up temporary uploaded file if uploaded via multer
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // ignore unlink error
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${result.totalRows.toLocaleString()} rows. Inserted ${result.insertedCount.toLocaleString()} price records across ${result.marketsDiscovered} markets in ${result.durationSeconds}s.`,
      data: result,
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // ignore
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to import CSV",
    });
  }
};

// Get paginated price records
export const getWfpPrices = async (req: Request, res: Response) => {
  try {
    const {
      page,
      limit,
      search,
      category,
      commodity,
      market,
      province,
      district,
      priceType,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await getWfpPricesService({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      search: search as string,
      category: category as string,
      commodity: commodity as string,
      market: market as string,
      province: province as string,
      district: district as string,
      priceType: priceType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    });

    res.status(200).json({
      success: true,
      data: result.prices,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch prices",
    });
  }
};

// Get Analytics & Time Series Trends
export const getWfpAnalytics = async (req: Request, res: Response) => {
  try {
    const {
      commodity,
      category,
      market,
      province,
      priceType,
      startDate,
      endDate,
    } = req.query;

    const result = await getWfpAnalyticsService({
      commodity: (commodity as string) || undefined,
      category: (category as string) || undefined,
      market: (market as string) || undefined,
      province: (province as string) || undefined,
      priceType: (priceType as string) || undefined,
      startDate: (startDate as string) || undefined,
      endDate: (endDate as string) || undefined,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics",
    });
  }
};

// Get Dropdown Filter Options
export const getWfpFilterOptions = async (req: Request, res: Response) => {
  try {
    const options = await getWfpFilterOptionsService();
    res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch filter options",
    });
  }
};

// Clear WFP data
export const clearWfpPrices = async (req: Request, res: Response) => {
  try {
    const result = await clearWfpPricesService();
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to clear prices",
    });
  }
};
