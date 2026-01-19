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
  acceptTermsService,
  requestPasswordResetService,
  resetPasswordService,
  createFarmerByAdminService,
  createRestaurantByAdminService,
} from "../services/userServices";
import { PaginationService } from "../services/paginationService";
import { Role } from "@prisma/client";
import { generateToken, verifyToken } from "../utils/jwt";
import prisma from "../prisma";
import { OTPService } from "../services/otp.service";

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
      const result = await createRestaurantService({
        ...restaurantData,
        verified: false,
      });

      if (result.phone) {
        await OTPService.sendRestaurantSignupOTP(result.phone);
      }

      res.status(201).json({
        success: true,
        message:
          "Restaurant created successfully. OTP sent to your phone for verification.",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static verifyRestaurant = async (req: Request, res: Response) => {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message: "Phone number and OTP are required",
        });
      }

      const otpResult = await OTPService.verifyOTP(
        phone,
        otp,
        "RESTAURANT_SIGNUP"
      );

      if (!otpResult.success) {
        return res.status(400).json({
          success: false,
          message: otpResult.message,
        });
      }

      const restaurant = await prisma.restaurant.update({
        where: { phone },
        data: { verified: true },
        select: { phone: true, verified: true },
      });

      res.status(200).json({
        success: true,
        message: "Restaurant verified successfully",
        data: restaurant,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static resendOTP = async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const result = await OTPService.sendRestaurantSignupOTP(phone);

      res.status(result.success ? 200 : 400).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  // TERMS AND CONDITIONS SERVICES

  static acceptTerms = async (req: Request, res: Response) => {
    try {
      const { identifier } = req.body; // email or phone

      if (!identifier) {
        return res.status(400).json({
          message: "Email or phone is required",
        });
      }

      const restaurant = await acceptTermsService(identifier);

      res.status(200).json({
        message: "Terms and conditions accepted successfully",
        data: restaurant,
      });
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Failed to accept terms",
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
      } else if (result.role === Role.TRADER) {
        sms = "TRADER created successfully";
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
      const { phone, email, tin, password } = req.body;

      if (!password || (!phone && !email && !tin)) {
        return res.status(400).json({
          success: false,
          message: "TIN/Phone/Email and password are required",
        });
      }

      const result = await loginService({ phone, email, tin, password });
      const user = result.user;

      const token = generateToken({ id: user.id });

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
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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

  // PASSWORD RESET CONTROLLERS
  static requestPasswordReset = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const result = await requestPasswordResetService(email);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static resetPassword = async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Token and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      const result = await resetPasswordService(token, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  // ADMIN-ONLY CONTROLLERS WITH AUTO-GENERATED PASSWORDS
  static createFarmerByAdmin = async (req: Request, res: Response) => {
    try {
      const farmerData = req.body;
      const result = await createFarmerByAdminService(farmerData);

      res.status(201).json({
        success: true,
        message: "Farmer created successfully. PIN sent via SMS.",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

  static createRestaurantByAdmin = async (req: Request, res: Response) => {
    try {
      const restaurantData = req.body;
      const result = await createRestaurantByAdminService(restaurantData);

      if (result.phone) {
        await OTPService.sendRestaurantSignupOTP(result.phone);
      }

      res.status(201).json({
        success: true,
        message: "Restaurant created successfully. Password sent via SMS.",
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };
}
