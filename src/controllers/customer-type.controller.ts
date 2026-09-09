import { Request, Response } from "express";
import {
  createCustomerTypeService,
  getAllCustomerTypesService,
  getCustomerTypeByIdService,
  updateCustomerTypeService,
  deleteCustomerTypeService,
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
