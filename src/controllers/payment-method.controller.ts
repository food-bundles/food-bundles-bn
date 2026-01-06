import { Request, Response } from "express";
import {
  createPaymentMethodService,
  getAllPaymentMethodsService,
  getPaymentMethodByIdService,
  updatePaymentMethodService,
  deletePaymentMethodService,
  getActivePaymentMethodsService,
  updateMethodStatusService,
} from "../services/payment-method.service";

// Create PaymentMethod
export const createPaymentMethod = async (req: Request, res: Response) => {
  try {
    const { tableTronicId, name, description, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        message: "Payment method name is required",
      });
    }

    const paymentMethod = await createPaymentMethodService({
      tableTronicId,
      name,
      description,
      isActive,
      createdBy: adminId,
    });

    res.status(201).json({
      message: "Payment method created successfully",
      data: paymentMethod,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create payment method",
    });
  }
};

// Get all PaymentMethods
export const getAllPaymentMethods = async (req: Request, res: Response) => {
  try {
    const { search, isActive, page = 1, limit = 10 } = req.query;

    const result = await getAllPaymentMethodsService({
      search: search as string,
      isActive: isActive ? isActive === "true" : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Payment methods retrieved successfully",
      data: result.methods,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get payment methods",
    });
  }
};

// Get active PaymentMethods for dropdown/selection
export const getActivePaymentMethods = async (req: Request, res: Response) => {
  try {
    const methods = await getActivePaymentMethodsService();

    res.status(200).json({
      message: "Active payment methods retrieved successfully",
      data: methods,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get active payment methods",
    });
  }
};

// Get PaymentMethod by ID
export const getPaymentMethodById = async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;

    const method = await getPaymentMethodByIdService(methodId);

    res.status(200).json({
      message: "Payment method retrieved successfully",
      data: method,
    });
  } catch (error: any) {
    if (error.message === "Payment method not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get payment method",
    });
  }
};

// Update PaymentMethod
export const updatePaymentMethod = async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;
    const updateData = req.body;
    const adminId = (req as any).user.id;

    const updatedMethod = await updatePaymentMethodService(
      methodId,
      updateData,
      adminId
    );

    res.status(200).json({
      message: "Payment method updated successfully",
      data: updatedMethod,
    });
  } catch (error: any) {
    if (error.message === "Payment method not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (
      error.message === "Only ADMIN users can update payment methods" ||
      error.message === "Payment method name already exists"
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update payment method",
    });
  }
};

// Delete PaymentMethod
export const deletePaymentMethod = async (req: Request, res: Response) => {
  try {
    const { methodId } = req.params;

    const result = await deletePaymentMethodService(methodId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "Payment method not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to delete payment method",
    });
  }
};

// Bulk update method status (activate/deactivate)
export const updateMethodStatus = async (req: Request, res: Response) => {
  try {
    const { methodIds, isActive } = req.body;
    const adminId = (req as any).user.id;

    // Validate required fields
    if (!methodIds || !Array.isArray(methodIds) || methodIds.length === 0) {
      return res.status(400).json({
        message: "Method IDs array is required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "isActive boolean value is required",
      });
    }

    const result = await updateMethodStatusService(
      methodIds,
      isActive,
      adminId
    );

    res.status(200).json({
      message: result.message,
      data: {
        updatedCount: result.updatedCount,
      },
    });
  } catch (error: any) {
    if (error.message === "Only ADMIN users can update payment methods") {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update method status",
    });
  }
};
