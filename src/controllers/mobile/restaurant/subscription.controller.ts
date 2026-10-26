import { Request, Response } from "express";
import {
  mobileGetPlans,
  mobileGetCurrentSubscription,
  mobileSubscribe,
  mobileCancelSubscription,
} from "../../../services/mobile/restaurant/subscription.service";

const user = (req: Request) => (req as any).user;

export const mobileSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    const result = await mobileGetPlans();
    res.status(200).json({ message: "Plans retrieved", data: result.plans });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get plans" });
  }
};

export const mobileSubscriptionCurrent = async (req: Request, res: Response) => {
  try {
    const subscription = await mobileGetCurrentSubscription(user(req).id);
    res.status(200).json({ message: "Subscription retrieved", data: subscription });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get subscription" });
  }
};

export const mobileSubscriptionCreate = async (req: Request, res: Response) => {
  try {
    const { planId, paymentMethod, phoneNumber } = req.body;
    if (!planId) return res.status(400).json({ message: "Plan ID is required" });
    const result = await mobileSubscribe({
      restaurantId: user(req).id,
      planId,
      paymentMethod,
      phoneNumber,
    });
    res.status(200).json({ message: "Subscription initiated", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to subscribe" });
  }
};

export const mobileSubscriptionCancel = async (req: Request, res: Response) => {
  try {
    const result = await mobileCancelSubscription(user(req).id, req.body.reason);
    res.status(200).json({ message: "Subscription cancelled", data: result });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to cancel subscription" });
  }
};
