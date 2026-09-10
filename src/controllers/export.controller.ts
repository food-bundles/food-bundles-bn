import { Request, Response } from "express";
import {
  exportDataService,
  ExportFormat,
  ExportType,
  ExportFilterOptions,
} from "../services/export.services";

// Generic export controller
export const exportData = async (req: Request, res: Response) => {
  try {
    const { type, format } = req.params;

    console.log(`[EXPORT] Received request for type=${type}, format=${format}, options=`, req.query);

    if (!["pdf", "csv", "excel", "html"].includes(format)) {
      return res.status(400).json({
        message: "Invalid format. Supported formats: pdf, csv, excel, html",
      });
    }

    const validTypes = [
      "users",
      "orders",
      "restaurants",
      "payments",
      "products",
      "farmers",
      "logistics",
      "aggregators",
      "subscriptions",
      "wallets",
      "loans",
      "deposits",
      "transactions",
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        message: "Invalid export type",
      });
    }

    // Extract options and filters from req.query
    const orientation =
      req.query.orientation === "portrait" ? "portrait" : "landscape";
    const dateFormat = req.query.dateFormat === "local" ? "local" : "iso";

    const options: ExportFilterOptions = {
      orientation,
      dateFormat,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      category: req.query.category as string,
      role: req.query.role as string,
      search: req.query.search as string,
      restaurantId: req.query.restaurantId as string,
      farmerId: req.query.farmerId as string,
      province: req.query.province as string,
      district: req.query.district as string,
      type: req.query.type as string,
      columns: req.query.columns as string,
      ids: req.query.ids as string,
    };

    // Dynamic filename generation
    const todayStr = new Date().toISOString().split("T")[0];
    const ext = format === "excel" ? "xlsx" : format;
    let dateSuffix = todayStr;
    if (options.startDate) {
      const startStr = options.startDate.split("T")[0];
      if (options.endDate) {
        const endStr = options.endDate.split("T")[0];
        dateSuffix = `${startStr}_to_${endStr}`;
      } else {
        dateSuffix = `from_${startStr}`;
      }
    }
    const filename = `${type}_${dateSuffix}.${ext}`;

    const exportDataResult = await exportDataService(
      type as ExportType,
      format as ExportFormat,
      options
    );

    // Set appropriate headers based on format
    switch (format) {
      case "csv":
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(exportDataResult);
        break;
      case "excel":
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(exportDataResult);
        break;
      case "pdf":
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(await exportDataResult);
        break;
      case "html":
        res.setHeader("Content-Type", "text/html");
        res.send(exportDataResult);
        break;
      default:
        res.status(400).json({
          message: "Unsupported format",
        });
    }
  } catch (error: any) {
    require("fs").writeFileSync("export-error.log", error.stack || error.message);
    res.status(500).json({
      message: error.message || "Failed to export data",
    });
  }
};

// Get available export types
export const getExportTypes = async (req: Request, res: Response) => {
  try {
    const exportTypes = [
      { type: "users", description: "Export all restaurant users" },
      { type: "orders", description: "Export all orders with details" },
      { type: "restaurants", description: "Export restaurant information" },
      { type: "payments", description: "Export completed payments" },
      { type: "products", description: "Export product catalog" },
      { type: "farmers", description: "Export farmer information" },
      { type: "logistics", description: "Export logistics personnel" },
      { type: "aggregators", description: "Export aggregator information" },
      { type: "subscriptions", description: "Export subscription records" },
      { type: "wallets", description: "Export wallets and balances" },
      { type: "loans", description: "Export loan applications and credit" },
      { type: "deposits", description: "Export wallet deposit transactions" },
      { type: "transactions", description: "Export detailed financial transactions" },
    ];

    const formats = [
      { format: "excel", description: "Microsoft Excel format (.xlsx)" },
      { format: "csv", description: "Comma-separated values (.csv)" },
      { format: "pdf", description: "Portable Document Format (.pdf)" },
      { format: "html", description: "HTML table format" },
    ];

    res.status(200).json({
      message: "Export options retrieved successfully",
      data: {
        types: exportTypes,
        formats: formats,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get export types",
    });
  }
};
