import { Request, Response } from "express";
import {
  mobileInitiateCheckout,
  mobileGetLoanSessions,
  mobileCreateAdminOrder,
} from "../../../services/mobile/restaurant/checkout.service";
import { createCheckoutService } from "../../../services/checkout.services";
import { OTPService } from "../../../services/otp.service";
import { AuthenticatorService } from "../../../services/authenticator.service";
import { getRestaurantFromAffiliatorService } from "../../../services/affiliator.service";
import prisma from "../../../prisma";

const user = (req: Request) => (req as any).user;

export const mobileCheckoutCreate = async (req: Request, res: Response) => {
  try {
    const result = await mobileInitiateCheckout(
      req.body,
      user(req).id,
      user(req).role,
    );
    res.status(200).json({ message: "Checkout initiated", data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ message: error.message || "Failed to initiate checkout" });
  }
};

export const mobileCheckoutVerifyOtp = async (req: Request, res: Response) => {
  try {
    const { otp, checkoutSessionId } = req.body;
    if (!otp || !checkoutSessionId)
      return res
        .status(400)
        .json({ message: "OTP and checkout session ID are required" });

    let checkoutData: any;
    try {
      checkoutData = JSON.parse(
        Buffer.from(checkoutSessionId, "base64").toString(),
      );
    } catch {
      return res.status(400).json({ message: "Invalid checkout session" });
    }

    const verifyType = checkoutData.verificationType || "OTP";
    const userId = user(req).id;
    const userRole = user(req).role;

    let restaurantId = userId;
    if (userRole === "AFFILIATOR") {
      const r = await getRestaurantFromAffiliatorService(userId);
      restaurantId = r.id;
    }

    if (verifyType === "2FA") {
      const verified = await AuthenticatorService.verify2FAToken(
        userId,
        userRole,
        otp,
      );
      if (!verified)
        return res.status(400).json({ message: "Invalid authenticator code" });
    } else {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { phone: true },
      });
      if (!restaurant?.phone)
        return res.status(400).json({ message: "Restaurant phone not found" });
      const otpResult = await OTPService.verifyOTP(
        restaurant.phone,
        otp,
        "VOUCHER_CHECKOUT",
      );
      if (!otpResult.success)
        return res.status(400).json({ message: otpResult.message });
    }

    const paymentResult = await createCheckoutService(checkoutData);
    if (paymentResult.success) {
      res
        .status(200)
        .json({
          message: paymentResult.message || "Payment processed",
          data: paymentResult,
        });
    } else {
      res
        .status(400)
        .json({ message: paymentResult.error || "Payment failed" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to verify OTP" });
  }
};

export const mobileCheckoutStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        status: true,
        paymentMethod: true,
        totalAmount: true,
        txRef: true,
        paymentReference: true,
        flwRef: true,
        updatedAt: true,
        restaurantId: true,
      },
    });
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.restaurantId !== user(req).id)
      return res.status(403).json({ message: "Access denied" });
    res
      .status(200)
      .json({
        success: true,
        data: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.status,
          totalAmount: order.totalAmount,
          updatedAt: order.updatedAt,
        },
      });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get checkout status" });
  }
};

export const mobileAdminOrderCreate = async (req: Request, res: Response) => {
  try {
    const u = (req as any).user;
    const result = await mobileCreateAdminOrder({
      ...req.body,
      restaurantId: u.id,
    });
    res.status(201).json({ message: "Admin order created", data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ message: error.message || "Failed to create admin order" });
  }
};

export const mobileGetLoanSessionsCtrl = async (
  req: Request,
  res: Response,
) => {
  try {
    const restaurantId = user(req).id;
    const sessions = await mobileGetLoanSessions(restaurantId);
    res
      .status(200)
      .json({ message: "Loan sessions retrieved", data: sessions });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get loan sessions" });
  }
};
