import { Request, Response } from "express";
import {
  mobileGetAffiliators,
  mobileCreateAffiliator,
  mobileDeleteAffiliator,
  mobileUpdateAffiliator,
  mobileGetAffiliatorById,
} from "../../../services/mobile/restaurant/affiliator.service";

const user = (req: Request) => (req as any).user;

export const mobileAffiliatorsList = async (req: Request, res: Response) => {
  try {
    const affiliators = await mobileGetAffiliators(user(req).id);
    res.status(200).json({ message: "Affiliators retrieved", data: affiliators });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get affiliators" });
  }
};

export const mobileAffiliatorCreate = async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    if (!email && !phone)
      return res.status(400).json({ message: "Email or phone is required" });
    const affiliator = await mobileCreateAffiliator({
      name,
      email,
      phone,
      restaurantId: user(req).id,
    });
    res.status(201).json({ message: "Affiliator created", data: affiliator });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to create affiliator" });
  }
};

export const mobileAffiliatorDelete = async (req: Request, res: Response) => {
  try {
    const result = await mobileDeleteAffiliator(req.params.affiliatorId);
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to delete affiliator" });
  }
};

export const mobileAffiliatorGet = async (req: Request, res: Response) => {
  try {
    const affiliator = await mobileGetAffiliatorById(req.params.affiliatorId);
    res.status(200).json({ message: "Affiliator retrieved", data: affiliator });
  } catch (error: any) {
    res.status(404).json({ message: error.message || "Affiliator not found" });
  }
};

export const mobileAffiliatorUpdate = async (req: Request, res: Response) => {
  try {
    const { name, phone } = req.body;
    const affiliator = await mobileUpdateAffiliator(req.params.affiliatorId, { name, phone });
    res.status(200).json({ message: "Affiliator updated", data: affiliator });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to update affiliator" });
  }
};
