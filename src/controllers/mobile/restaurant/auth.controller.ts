import { Request, Response } from "express";
import {
  mobileRestaurantLoginService,
  mobileForgotPasswordService,
  mobileResetPasswordService,
  mobileUpdateProfileService,
  mobileRestaurantRegisterService,
} from "../../../services/mobile/restaurant/auth.service";
import prisma from "../../../prisma";
import { verifyToken } from "../../../utils/jwt";

export const mobileRegister = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, tin, password, role } = req.body;
    if (!name || !email || !tin || !password) {
      return res.status(400).json({ success: false, message: "Name, email, TIN, and password are required" });
    }
    const result = await mobileRestaurantRegisterService({ name, email, phone, tin, password, role: role ?? "RESTAURANT" });
    res.status(201).json({ success: true, message: "Account created", token: result.token, data: result.user });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const mobileLogin = async (req: Request, res: Response) => {
  try {
    const { phone, email, tin, password } = req.body;
    if (!password || (!phone && !email && !tin)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "TIN/Phone/Email and password are required",
        });
    }
    const result = await mobileRestaurantLoginService({
      phone,
      email,
      tin,
      password,
    });
    res
      .status(200)
      .json({
        success: true,
        message: "Login successful",
        token: result.token,
        data: result.user,
      });
  } catch (error: any) {
    res.status(401).json({ success: false, message: error.message });
  }
};

export const mobileMe = async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ message: "No token provided" });
    const payload = verifyToken(authHeader.substring(7));
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        tin: true,
        location: true,
        province: true,
        district: true,
        sector: true,
        cell: true,
        village: true,
        role: true,
        verified: true,
        createdAt: true,
      },
    });
    if (!restaurant)
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    res.json({ success: true, data: restaurant });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const mobileUpdateProfile = async (req: Request, res: Response) => {
  try {
    const u = (req as any).user;
    const { name, email, phone, tin } = req.body;
    const updated = await mobileUpdateProfileService(u.id, {
      name,
      email,
      phone,
      tin,
    });
    res
      .status(200)
      .json({ success: true, message: "Profile updated", data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const mobileForgotPassword = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone)
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    const result = await mobileForgotPasswordService(phone);
    res.status(result.success ? 200 : 502).json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const mobileResetPassword = async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Phone, OTP, and new password are required",
        });
    }
    const result = await mobileResetPasswordService(phone, otp, newPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

