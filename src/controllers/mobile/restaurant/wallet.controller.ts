import { Request, Response } from "express";
import {
  mobileGetWallet,
  mobileTopUpWallet,
  mobileGetWalletTransactions,
} from "../../../services/mobile/restaurant/wallet.service";

const user = (req: Request) => (req as any).user;

export const mobileWalletGet = async (req: Request, res: Response) => {
  try {
    const wallet = await mobileGetWallet(user(req).id);
    res.status(200).json({ message: "Wallet retrieved", data: wallet });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get wallet" });
  }
};

export const mobileWalletTopUp = async (req: Request, res: Response) => {
  try {
    const { walletId, amount, paymentMethod, phoneNumber, description } =
      req.body;
    if (!walletId || !amount || !paymentMethod) {
      return res
        .status(400)
        .json({
          message: "Wallet ID, amount, and payment method are required",
        });
    }
    const result = await mobileTopUpWallet({
      walletId,
      restaurantId: user(req).id,
      amount: Number(amount),
      paymentMethod,
      phoneNumber,
      description,
    });
    res
      .status(200)
      .json({ message: result.message || "Top-up initiated", data: result });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to top up wallet" });
  }
};

export const mobileWalletTransactions = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      startDate,
      endDate,
    } = req.query;
    const result = await mobileGetWalletTransactions(user(req).id, {
      page: Number(page),
      limit: Number(limit),
      type: type as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res
      .status(200)
      .json({
        message: "Transactions retrieved",
        data: result.transactions,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get transactions" });
  }
};
