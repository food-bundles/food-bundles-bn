import { Request, Response } from "express";
import {
  exportUsersService,
  exportOrdersService,
  exportRestaurantsService,
  exportPaymentsService,
  exportProductsService,
  exportFarmersService,
  exportLogisticsService,
  exportAggregatorsService,
  exportSubscriptionsService,
  exportWalletsService,
  ExportFormat,
  ExportType,
} from "../services/export.services";

// Generic export controller
export const exportData = async (req: Request, res: Response) => {
  try {
    const { type, format } = req.params;

    if (!["pdf", "csv", "excel", "html"].includes(format)) {
      return res.status(400).json({
        message: "Invalid format. Supported formats: pdf, csv, excel, html",
      });
    }

    if (
      ![
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
      ].includes(type)
    ) {
      return res.status(400).json({
        message: "Invalid export type",
      });
    }

    let exportData;
    let filename;

    switch (type as ExportType) {
      case "users":
        exportData = await exportUsersService(format as ExportFormat);
        filename = `users_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "orders":
        exportData = await exportOrdersService(format as ExportFormat);
        filename = `orders_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "restaurants":
        exportData = await exportRestaurantsService(format as ExportFormat);
        filename = `restaurants_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "payments":
        exportData = await exportPaymentsService(format as ExportFormat);
        filename = `payments_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "products":
        exportData = await exportProductsService(format as ExportFormat);
        filename = `products_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "farmers":
        exportData = await exportFarmersService(format as ExportFormat);
        filename = `farmers_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "logistics":
        exportData = await exportLogisticsService(format as ExportFormat);
        filename = `logistics_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "aggregators":
        exportData = await exportAggregatorsService(format as ExportFormat);
        filename = `aggregators_export.${format === "excel" ? "xlsx" : format}`;
        break;
      case "subscriptions":
        exportData = await exportSubscriptionsService(format as ExportFormat);
        filename = `subscriptions_export.${
          format === "excel" ? "xlsx" : format
        }`;
        break;
      case "wallets":
        exportData = await exportWalletsService(format as ExportFormat);
        filename = `wallets_export.${format === "excel" ? "xlsx" : format}`;
        break;
      default:
        return res.status(400).json({
          message: "Invalid export type",
        });
    }

    // Set appropriate headers based on format
    switch (format) {
      case "csv":
        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(exportData);
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
        res.send(exportData);
        break;
      case "pdf":
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        );
        res.send(await exportData);
        break;
      case "html":
        res.setHeader("Content-Type", "text/html");
        res.send(exportData);
        break;
      default:
        res.status(400).json({
          message: "Unsupported format",
        });
    }
  } catch (error: any) {
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
    ];

    const formats = [
      { format: "csv", description: "Comma-separated values" },
      { format: "excel", description: "Microsoft Excel format" },
      { format: "pdf", description: "Portable Document Format" },
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
