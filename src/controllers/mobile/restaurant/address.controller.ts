import { Request, Response } from "express";
import {
  mobileGetAddresses,
  mobileCreateAddress,
  mobileUpdateAddress,
  mobileDeleteAddress,
} from "../../../services/mobile/restaurant/address.service";

const user = (req: Request) => (req as any).user;

export const mobileAddressList = async (req: Request, res: Response) => {
  try {
    const addresses = await mobileGetAddresses(user(req).id);
    res.status(200).json({ message: "Addresses retrieved", data: addresses });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get addresses" });
  }
};

export const mobileAddressCreate = async (req: Request, res: Response) => {
  try {
    const { label, street, landmark, phone, isDefault } = req.body;
    if (!label || !street || !phone)
      return res.status(400).json({ message: "Label, street, and phone are required" });
    const address = await mobileCreateAddress(user(req).id, { label, street, landmark, phone, isDefault });
    res.status(201).json({ message: "Address created", data: address });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create address" });
  }
};

export const mobileAddressUpdate = async (req: Request, res: Response) => {
  try {
    const address = await mobileUpdateAddress(req.params.addressId, user(req).id, req.body);
    res.status(200).json({ message: "Address updated", data: address });
  } catch (error: any) {
    const status = error.message === "Address not found" ? 404 : 400;
    res.status(status).json({ message: error.message || "Failed to update address" });
  }
};

export const mobileAddressDelete = async (req: Request, res: Response) => {
  try {
    const result = await mobileDeleteAddress(req.params.addressId, user(req).id);
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    const status = error.message === "Address not found" ? 404 : 400;
    res.status(status).json({ message: error.message || "Failed to delete address" });
  }
};
