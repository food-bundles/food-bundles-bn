import { Request, Response } from "express";
import {
  createCustomerTypeService,
  getAllCustomerTypesService,
  getCustomerTypeByIdService,
  updateCustomerTypeService,
  deleteCustomerTypeService,
  toggleCustomerTypeStatusService,
  getCustomerTypeUsageService,
  getPriceUsageService,
  assignCustomerTypeService,
  swapCustomerTypePricingService,
} from "../services/customer-type.service";

export const createCustomerType = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Customer type name is required" });

    const data = await createCustomerTypeService({ name, description, createdBy: (req as any).user.id });
    res.status(201).json({ message: "Customer type created successfully", data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to create customer type" });
  }
};

export const getAllCustomerTypes = async (_req: Request, res: Response) => {
  try {
    const data = await getAllCustomerTypesService();
    res.status(200).json({ message: "Customer types retrieved successfully", data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get customer types" });
  }
};

export const getCustomerTypeById = async (req: Request, res: Response) => {
  try {
    const data = await getCustomerTypeByIdService(req.params.customerTypeId);
    res.status(200).json({ message: "Customer type retrieved successfully", data });
  } catch (error: any) {
    if (error.message === "Customer type not found") return res.status(404).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to get customer type" });
  }
};

export const updateCustomerType = async (req: Request, res: Response) => {
  try {
    const data = await updateCustomerTypeService(req.params.customerTypeId, req.body, (req as any).user.id);
    res.status(200).json({ message: "Customer type updated successfully", data });
  } catch (error: any) {
    if (error.message === "Customer type not found") return res.status(404).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to update customer type" });
  }
};

export const deleteCustomerType = async (req: Request, res: Response) => {
  try {
    const result = await deleteCustomerTypeService(req.params.customerTypeId);
    res.status(200).json(result);
  } catch (error: any) {
    if (error.message === "Customer type not found") return res.status(404).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to delete customer type" });
  }
};

export const toggleCustomerTypeStatus = async (req: Request, res: Response) => {
  try {
    const data = await toggleCustomerTypeStatusService(req.params.customerTypeId, (req as any).user.id);
    const status = data.isActive ? "activated" : "deactivated";
    res.status(200).json({ message: `Customer type ${status} successfully`, data });
  } catch (error: any) {
    if (error.message === "Customer type not found") return res.status(404).json({ message: error.message });
    if (error.message === "Only ADMIN users can toggle customer type status") return res.status(403).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to toggle customer type status" });
  }
};

export const getCustomerTypeUsage = async (_req: Request, res: Response) => {
  try {
    const data = await getCustomerTypeUsageService();
    res.status(200).json({ message: "Customer type usage retrieved successfully", data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get customer type usage" });
  }
};

export const getPriceUsage = async (_req: Request, res: Response) => {
  try {
    const data = await getPriceUsageService();
    res.status(200).json({ message: "Price usage retrieved successfully", data });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get price usage" });
  }
};

export const assignCustomerType = async (req: Request, res: Response) => {
  try {
    const { restaurantId, customerTypeId } = req.body;
    if (!restaurantId) {
      return res.status(400).json({ message: "restaurantId is required" });
    }

    const data = await assignCustomerTypeService(restaurantId, customerTypeId || null, (req as any).user.id);
    res.status(200).json(data);
  } catch (error: any) {
    if (error.message === "Restaurant not found" || error.message === "Customer type not found") return res.status(404).json({ message: error.message });
    if (error.message === "Only ADMIN users can assign customer types") return res.status(403).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to assign customer type" });
  }
};

export const swapCustomerTypePricing = async (req: Request, res: Response) => {
  try {
    const { sourceCustomerTypeId, targetCustomerTypeId, productIds } = req.body;
    if (!sourceCustomerTypeId || !targetCustomerTypeId || !productIds || !Array.isArray(productIds)) {
      return res.status(400).json({ message: "sourceCustomerTypeId, targetCustomerTypeId, and productIds array are required" });
    }

    const data = await swapCustomerTypePricingService(
      sourceCustomerTypeId,
      targetCustomerTypeId,
      productIds,
      (req as any).user.id
    );
    res.status(200).json(data);
  } catch (error: any) {
    if (error.message === "Source and target customer types must be different") return res.status(400).json({ message: error.message });
    if (error.message === "Source customer type not found" || error.message === "Target customer type not found") return res.status(404).json({ message: error.message });
    if (error.message === "No pricing found for the source customer type on selected products") return res.status(404).json({ message: error.message });
    if (error.message === "Only ADMIN users can swap customer type pricing") return res.status(403).json({ message: error.message });
    res.status(500).json({ message: error.message || "Failed to swap customer type pricing" });
  }
};
