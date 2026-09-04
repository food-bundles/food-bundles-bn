import { Request, Response } from "express";
import {
  createMarketService,
  getAllMarketsService,
  getMarketByIdService,
  updateMarketService,
  deleteMarketService,
  recordMarketPriceService,
  getPriceHistoryService,
  analyzePriceService,
  getMarketPricesByProductService,
  updateMarketPriceHistoryService,
  deleteMarketPriceHistoryService,
  exportMarketsService,
  exportPriceHistoryService,
  exportComparisonService,
  bulkUpdateMarketStatusService,
  bulkDeleteMarketsService,
  bulkDeletePriceHistoryService,
} from "../services/market.service";

// Create market
export const createMarket = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;

    const { name, location, province, district } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Market name is required",
      });
    }

    const market = await createMarketService({
      name,
      createdBy: adminId,
      location,
      province,
      district,
    });

    res.status(201).json({
      success: true,
      message: "Market created successfully",
      data: market,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all markets
export const getAllMarkets = async (req: Request, res: Response) => {
  try {
    const { page, limit, province, district, isActive } = req.query;

    const result = await getAllMarketsService({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      province: province as string,
      district: district as string,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
    });

    res.status(200).json({
      success: true,
      data: result.markets,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get market by ID
export const getMarketById = async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    const market = await getMarketByIdService(marketId);

    res.status(200).json({
      success: true,
      data: market,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// Update market
export const updateMarket = async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const { name, location, province, district, isActive } = req.body;

    const market = await updateMarketService(marketId, {
      name,
      location,
      province,
      district,
      isActive,
    });

    res.status(200).json({
      success: true,
      message: "Market updated successfully",
      data: market,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete market
export const deleteMarket = async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    await deleteMarketService(marketId);

    res.status(200).json({
      success: true,
      message: "Market deleted successfully",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Record market price
export const recordMarketPrice = async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;

    const { productId, marketId, marketPrice, recordedDate } = req.body;

    if (!productId || !marketId || !marketPrice) {
      return res.status(400).json({
        success: false,
        message: "Product ID, market ID, and market price are required",
      });
    }

    const priceRecord = await recordMarketPriceService({
      productId,
      marketId,
      marketPrice: parseFloat(marketPrice),
      recordedBy: adminId,
      recordedDate: recordedDate ? new Date(recordedDate) : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Market price recorded successfully",
      data: priceRecord,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get price history
export const getPriceHistory = async (req: Request, res: Response) => {
  try {
    const { productId, marketId, startDate, endDate, page, limit } = req.query;

    const result = await getPriceHistoryService({
      productId: productId as string,
      marketId: marketId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result.history,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Analyze price
export const analyzePrice = async (req: Request, res: Response) => {
  try {
    const { productId, marketIds, startDate, endDate } = req.body;

    if (!productId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Product ID, start date, and end date are required",
      });
    }

    const analysis = await analyzePriceService({
      productId,
      marketIds: marketIds || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    res.status(200).json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get market prices by product
export const getMarketPricesByProduct = async (req: Request, res: Response) => {
  try {
    const { productId, startDate, endDate, page, limit } = req.query;

    const result = await getMarketPricesByProductService({
      productId: productId as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Update market price history
export const updateMarketPriceHistory = async (req: Request, res: Response) => {
  try {
    const { historyId } = req.params;
    const { marketPrice, recordedDate } = req.body;

    const history = await updateMarketPriceHistoryService(historyId, {
      marketPrice: marketPrice ? parseFloat(marketPrice) : undefined,
      recordedDate: recordedDate ? new Date(recordedDate) : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Price history updated successfully",
      data: history,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete market price history
export const deleteMarketPriceHistory = async (req: Request, res: Response) => {
  try {
    const { historyId } = req.params;

    await deleteMarketPriceHistoryService(historyId);

    res.status(200).json({
      success: true,
      message: "Price history deleted successfully",
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk update market status (activate/deactivate)
export const bulkUpdateMarketStatus = async (req: Request, res: Response) => {
  try {
    const { marketIds, isActive } = req.body;

    if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Market IDs array is required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive boolean value is required",
      });
    }

    const result = await bulkUpdateMarketStatusService(marketIds, isActive);

    res.status(200).json({
      success: true,
      message: result.message,
      data: { updatedCount: result.updatedCount },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk delete markets
export const bulkDeleteMarkets = async (req: Request, res: Response) => {
  try {
    const { marketIds } = req.body;

    if (!marketIds || !Array.isArray(marketIds) || marketIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Market IDs array is required",
      });
    }

    const result = await bulkDeleteMarketsService(marketIds);

    res.status(200).json({
      success: true,
      message: result.message,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk delete price history
export const bulkDeletePriceHistory = async (req: Request, res: Response) => {
  try {
    const { historyIds } = req.body;

    if (!historyIds || !Array.isArray(historyIds) || historyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "History IDs array is required",
      });
    }

    const result = await bulkDeletePriceHistoryService(historyIds);

    res.status(200).json({
      success: true,
      message: result.message,
      data: { deletedCount: result.deletedCount },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Export markets
export const exportMarkets = async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const result = await exportMarketsService(format as string);
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Export price history
export const exportPriceHistory = async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const result = await exportPriceHistoryService(format as string);
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Export comparison
export const exportComparison = async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const result = await exportComparisonService(format as string);
    
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get lowest price comparison (PUBLIC - no auth required)
export const getLowestPriceComparison = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const result = await getPriceHistoryService({
      limit: limit ? parseInt(limit as string) : 50,
    });

    // Get the limited number of most recent prices
    const lowestPrices = result.history.slice(0, limit ? parseInt(limit as string) : 5);

    res.status(200).json({
      success: true,
      data: lowestPrices,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
