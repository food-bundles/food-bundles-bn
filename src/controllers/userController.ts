import { Request, Response } from "express";
import {
  createFarmerService,
  createRestaurantService,
  createAdminService,
  getAllFarmersService,
  getAllRestaurantsService,
  getAllAdminsService,
  getFarmerByIdService,
  getRestaurantByIdService,
  getAdminByIdService,
  updateFarmerService,
  updateRestaurantService,
  updateAdminService,
  deleteFarmerService,
  deleteRestaurantService,
  deleteAdminService,
  loginService,
} from "../services/userServices";
import { PaginationService } from "../services/paginationService";
import { JwtPayload } from "../types/userTypes";
import { Role } from "@prisma/client";
import { generateToken, verifyToken } from "../utils/jwt";
import prisma from "../prisma";

export class UserController {
  static createFarmer = async (req: Request, res: Response) => {
    try {
      const farmerData = req.body;
      const result = await createFarmerService(farmerData);

      res.status(201).json({
        success: true,
        message: "Farmer created successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static createRestaurant = async (req: Request, res: Response) => {
    try {
      const restaurantData = req.body;
      const result = await createRestaurantService(restaurantData);

      res.status(201).json({
        success: true,
        message: "Restaurant created successfully",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static createAdmin = async (req: Request, res: Response) => {
    try {
      const adminData = req.body;
      const result = await createAdminService(adminData);
      const isAdmin = result.role === Role.ADMIN;
      let sms;

      if (isAdmin) {
        sms = "Admin created successfully";
      } else {
        sms = "AGGREGATOR created successfully";
      }

      res.status(201).json({
        success: true,
        message: sms,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getAllFarmers = async (req: Request, res: Response) => {
    try {
      const { page, limit } = req.query;
      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );
      const farmers = await getAllFarmersService(paginationQuery);

      res.status(200).json({
        success: true,
        data: farmers,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getAllRestaurants = async (req: Request, res: Response) => {
    try {
      const { page, limit } = req.query;
      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );
      const restaurants = await getAllRestaurantsService(paginationQuery);

      res.status(200).json({
        success: true,
        data: restaurants,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getAllAdmins = async (req: Request, res: Response) => {
    try {
      const { page, limit } = req.query;
      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string
      );
      const admins = await getAllAdminsService(paginationQuery);

      res.status(200).json({
        success: true,
        data: admins,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getFarmerById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const farmer = await getFarmerByIdService(id);

      if (!farmer) {
        return res.status(404).json({
          success: false,
          message: "Farmer not found",
        });
      }

      res.status(200).json({
        success: true,
        data: farmer,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getRestaurantById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const restaurant = await getRestaurantByIdService(id);

      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found",
        });
      }

      res.status(200).json({
        success: true,
        data: restaurant,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getAdminById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const admin = await getAdminByIdService(id);

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      res.status(200).json({
        success: true,
        data: admin,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static updateFarmer = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedFarmer = await updateFarmerService(id, updateData);

      res.status(200).json({
        success: true,
        message: "Farmer updated successfully",
        data: updatedFarmer,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static updateRestaurant = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedRestaurant = await updateRestaurantService(id, updateData);

      res.status(200).json({
        success: true,
        message: "Restaurant updated successfully",
        data: updatedRestaurant,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static updateAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedAdmin = await updateAdminService(id, updateData);

      res.status(200).json({
        success: true,
        message: "Admin updated successfully",
        data: updatedAdmin,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static deleteFarmer = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteFarmerService(id);

      res.status(200).json({
        success: true,
        message: "Farmer deleted successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static deleteRestaurant = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteRestaurantService(id);

      res.status(200).json({
        success: true,
        message: "Restaurant deleted successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static deleteAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteAdminService(id);

      res.status(200).json({
        success: true,
        message: "Admin deleted successfully",
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static login = async (req: Request, res: Response) => {
    try {
      const { phone, email, password } = req.body;

      if (!password || (!phone && !email)) {
        return res.status(400).json({
          success: false,
          message: "Phone/Email and password are required",
        });
      }

      const result = await loginService({ phone, email, password });
      const user = result.user;
      const payload: JwtPayload = {
        id: user.id,
      };

const token = generateToken(payload);
const isProduction = process.env.NODE_ENV === "production";

res.cookie("auth_token", token, {
  httpOnly: true,
  secure: isProduction, // true in production, false in development
  sameSite: isProduction ? "none" : "lax", // "none" for production, "lax" for development
  maxAge: 24 * 60 * 60 * 1000,
  // DO NOT set domain property for cross-origin cookies
});
      res.status(200).json({
        success: true,
        message: "Login successful",
        token,
        data: result,
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message,
      });
    }
  };

  static me = async (req: Request, res: Response) => {
    try {
      const token = req.cookies["auth_token"];
      if (!token) {
        return res.status(401).json({ message: "No token provided" });
      }

      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: "Invalid token" });
      }

      let user: any = null;
      let userRole = "";

      user = await prisma.farmer.findUnique({ where: { id: payload.id } });
      if (user) userRole = "farmer";

      if (!user) {
        user = await prisma.restaurant.findUnique({
          where: { id: payload.id },
        });
        if (user) userRole = "restaurant";
      }

      if (!user) {
        user = await prisma.admin.findUnique({ where: { id: payload.id } });
        if (user) userRole = "admin";
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;

      return res.json({
        success: true,
        user: userWithoutPassword,
        userRole,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static logout = async (req: Request, res: Response) => {
    try {
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Logout failed",
      });
    }
  };
}
