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
  requestPasswordResetViaPhoneService,
  resetPasswordViaPhoneService,
  createFarmerByAdminService,
  createRestaurantByAdminService,
  googleLoginService,
  googleSignupService,
} from "../services/userServices";
import {
  getUserById,
  getUserByEmail,
  getUserByPhone,
} from "../services/userGets";
import { PaginationService } from "../services/paginationService";
import { Role } from "@prisma/client";
import { generateToken, verifyToken } from "../utils/jwt";
import prisma from "../prisma";
import { OTPService } from "../services/otp.service";
import {
  AccessError,
  getEffectivePermissions,
  resolveRoleAssignment,
  canSeeCustomerType,
  getCustomerTypeScope,
} from "../services/access.service";
import { hasDashboardAccess, isDashboardRole, Permission } from "../config/permissions";
import { userCan } from "../middleware/authMiddleware";
import {
  ManagedUserType,
  moveUserToTrash,
  updateManagedUser,
  UserManagementError,
} from "../services/user-management.service";
import { createNotificationService } from "../services/notification.services";
import { sendRoleChangedEmail } from "../utils/emails";

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
          "Account created successfully. OTP sent to your phone for verification.",
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
        "RESTAURANT_SIGNUP",
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
      // Validates the role and blocks privilege escalation
      const assignment = await resolveRoleAssignment((req as any).user, {
        role: req.body.role,
        adminRoleId: req.body.adminRoleId,
      });
      const adminData = { ...req.body, ...assignment };
      const result = await createAdminService(adminData);
      const isAdmin = result.role === Role.ADMIN;
      let sms;

      if (isAdmin) {
        sms = "Admin created successfully";
      } else if (result.role === Role.SUPERUSER) {
        sms = "SUPERUSER created successfully";
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
      res.status(error instanceof AccessError ? error.status : 400).json({
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
        limit as string,
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
      const { page, limit, search, customerTypeId } = req.query;
      const paginationQuery = PaginationService.validatePaginationParams(
        page as string,
        limit as string,
      );
      // Dashboard users only see the customer types their role works with
      const restaurants = await getAllRestaurantsService(
        paginationQuery,
        typeof search === "string" ? search : undefined,
        {
          customerTypeId: typeof customerTypeId === "string" && customerTypeId ? customerTypeId : undefined,
          customerTypeScope: (req as any).user?.customerTypeScope ?? null,
        },
      );

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
        limit as string,
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

      // Outside the viewer's customer types → treat as not found
      if (restaurant && !canSeeCustomerType((req as any).user, (restaurant as any).customerTypeId)) {
        return res.status(404).json({ success: false, message: "Restaurant not found" });
      }

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

  // Farmers and restaurants: the user themselves, or a dashboard user with the
  // "Edit" permission. A new password only from the user or a super admin.
  static updateFarmer = async (req: Request, res: Response) =>
    UserController.updateAccount(req, res, "farmer", "farmers.edit", "Farmer updated successfully");

  static updateRestaurant = async (req: Request, res: Response) =>
    UserController.updateAccount(
      req,
      res,
      "restaurant",
      "restaurants.edit",
      "Restaurant updated successfully",
    );

  private static updateAccount = async (
    req: Request,
    res: Response,
    type: ManagedUserType,
    permission: Permission,
    message: string,
  ) => {
    try {
      const id = req.params.id as string;
      const actor = (req as any).user;
      const isSelf = actor?.id === id;
      if (!isSelf && !userCan(actor, permission)) {
        throw new UserManagementError("You don't have permission to edit this user", 403);
      }
      // Customers outside the editor's customer types are off limits
      if (type === "restaurant" && !isSelf) {
        const customer = await prisma.restaurant.findUnique({ where: { id }, select: { customerTypeId: true } });
        if (customer && !canSeeCustomerType(actor, customer.customerTypeId)) {
          throw new UserManagementError("You can only edit customers of your customer types", 403);
        }
      }

      const data = await updateManagedUser(type, id, req.body || {}, {
        allowPassword: isSelf || actor?.role === Role.SUPERUSER,
      });

      res.status(200).json({ success: true, message, data });
    } catch (error: any) {
      UserController.sendManagementError(res, error);
    }
  };

  private static sendManagementError = (res: Response, error: any) => {
    const status =
      error instanceof UserManagementError || error instanceof AccessError ? error.status : 400;
    res.status(status).json({ success: false, message: error.message });
  };

  static updateAdmin = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const actor = (req as any).user;
      const { role, adminRoleId, ...updateData } = req.body;

      const target = await prisma.admin.findUnique({ where: { id }, select: { role: true } });
      if (!target) throw new AccessError("Admin not found", 404);
      if (target.role === Role.SUPERUSER && actor.role !== Role.SUPERUSER) {
        throw new AccessError("Only a super admin can edit a super admin");
      }

      // Role changes go through the same escalation checks as creation
      let roleChanged = false;
      if (role !== undefined || adminRoleId !== undefined) {
        if (id === actor.id) throw new AccessError("You cannot change your own role", 400);
        Object.assign(
          updateData,
          await resolveRoleAssignment(actor, { role, adminRoleId }, target.role),
        );
        roleChanged = true;
      }

      // Details (whitelisted fields, email/phone duplicate checks); a new
      // password only from a super admin or the admin themselves
      let updatedAdmin: any = await updateManagedUser("admin", id, updateData, {
        allowPassword: actor.role === Role.SUPERUSER || id === actor.id,
      });
      if (roleChanged) {
        const { role: newRole, adminRoleId: newAdminRoleId } = updateData;
        updatedAdmin = await prisma.admin.update({
          where: { id },
          data: { role: newRole, adminRoleId: newAdminRoleId },
          select: { id: true, username: true, email: true, role: true, adminRoleId: true },
        });
      }

      if (roleChanged) {
        const roleName = updateData.adminRoleId
          ? (await prisma.adminRole.findUnique({ where: { id: updateData.adminRoleId } }))?.name || updateData.role
          : updateData.role;

        try {
          await createNotificationService({
            title: "Your Role Was Updated",
            message: `Your role has been changed to ${roleName}.`,
            eventType: "ADMIN_ROLE_CHANGED",
            targetType: "SPECIFIC_USER",
            targetId: id,
            metadata: { roleName, changedBy: actor.id },
          });
        } catch (notifError) {
          console.error("Failed to create role-change notification:", notifError);
        }

        try {
          await sendRoleChangedEmail({
            email: updatedAdmin.email,
            username: updatedAdmin.username,
            roleName,
            changedBy: actor.username,
          });
        } catch (emailError) {
          console.error("Failed to send role-change email:", emailError);
        }
      }

      res.status(200).json({
        success: true,
        message: "Admin updated successfully",
        data: updatedAdmin,
      });
    } catch (error: any) {
      res.status(error instanceof AccessError ? error.status : 400).json({
        success: false,
        message: error.message,
      });
    }
  };

  // Delete = move to the trash (soft delete), super admin only (also enforced
  // by the routes). Restore / permanent delete live in the trash routes.
  static deleteFarmer = async (req: Request, res: Response) =>
    UserController.trashAccount(req, res, "farmer", "Farmer moved to the trash");

  static deleteRestaurant = async (req: Request, res: Response) =>
    UserController.trashAccount(req, res, "restaurant", "Restaurant moved to the trash");

  static deleteAdmin = async (req: Request, res: Response) =>
    UserController.trashAccount(req, res, "admin", "User moved to the trash");

  private static trashAccount = async (
    req: Request,
    res: Response,
    type: ManagedUserType,
    message: string,
  ) => {
    try {
      const actor = (req as any).user;
      if (actor?.role !== Role.SUPERUSER) {
        throw new UserManagementError("Only a super admin can delete users", 403);
      }
      await moveUserToTrash(type, req.params.id as string, actor.id);
      res.status(200).json({ success: true, message });
    } catch (error: any) {
      UserController.sendManagementError(res, error);
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

  static googleLogin = async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({
          success: false,
          message: "Google credential is required",
        });
      }

      // Verify the Google ID token
      const { OAuth2Client } = require("google-auth-library");
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        return res.status(400).json({
          success: false,
          message: "Invalid Google credential",
        });
      }

      const { email, name, sub: googleId } = payload;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email not provided by Google",
        });
      }

      const result = await googleLoginService({
        email,
        name: name || "",
        googleId,
      });

      // If user not found, return for frontend registration flow
      if (result.userNotFound) {
        return res.status(200).json({
          success: true,
          userNotFound: true,
          email: result.email,
          name: result.name,
          message: result.message,
        });
      }

      // If user has not accepted the terms yet, return for frontend to
      // redirect them to the terms agreement page instead of logging in
      if (result.needsTermsAgreement) {
        return res.status(200).json({
          success: true,
          needsTermsAgreement: true,
          email: result.email,
          name: result.name,
          message: result.message,
        });
      }

      // User found, generate JWT
      const user = result.user;
      const token = generateToken({ id: user.id });

      res.status(200).json({
        success: true,
        message: "Google login successful",
        token,
        data: {
          user,
          userType: result.userType,
        },
      });
    } catch (error: any) {
      console.error("Google login error:", error);
      res.status(401).json({
        success: false,
        message: error.message || "Google login failed",
      });
    }
  };

  static googleSignup = async (req: Request, res: Response) => {
    try {
      const { email, name, role, phone, tin, location } = req.body;

      if (!email || !role) {
        return res.status(400).json({
          success: false,
          message: "Email and role are required",
        });
      }

      const result = await googleSignupService({
        email,
        name,
        role,
        phone,
        tin,
        location,
      });

      const user = result.user;
      const token = generateToken({ id: user.id });

      res.status(201).json({
        success: true,
        message: result.message,
        token,
        data: {
          user,
          userType: result.userType,
        },
      });
    } catch (error: any) {
      console.error("Google signup error:", error);
      res.status(400).json({
        success: false,
        message: error.message || "Google signup failed",
      });
    }
  };


  static myProfile = async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) {
        return res.status(401).json({ message: "Invalid token" });
      }

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
          KycConsent: {
            select: {
              ownerName: true,
              ownerNationalId: true,
              yearsInOperation: true,
              businessType: true,
              consentVubaBuba: true,
              consentKayko: true,
              consentRRA: true,
              submittedAt: true,
            },
          },
        },
      });

      if (!restaurant) {
        return res.status(404).json({ success: false, message: "Restaurant not found" });
      }

      return res.json({ success: true, data: restaurant });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
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
        user = await prisma.admin.findUnique({
          where: { id: payload.id },
          include: { AdminRole: { select: { id: true, name: true } } },
        });
        if (user) userRole = "admin";
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Never send secrets to the browser
      const {
        password,
        twoFactorSecret,
        twoFactorBackupCodes,
        ...userWithoutPassword
      } = user;

      // Dashboard users (office and field) get their effective permissions (drives the sidebar)
      if (hasDashboardAccess(user.role)) {
        userWithoutPassword.permissions = await getEffectivePermissions(user);
        // Customer types they work with (null = all) for the Customers tabs
        userWithoutPassword.customerTypeScope = await getCustomerTypeScope(user);
      }
      // The dashboard reads the role as "adminRole" (the relation is named AdminRole)
      if (userRole === "admin") {
        userWithoutPassword.adminRole = user.AdminRole ?? null;
      }

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

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
        });
      }

      if (!/(?=.*[a-z])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one lowercase letter",
        });
      }

      if (!/(?=.*[A-Z])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one uppercase letter",
        });
      }

      if (!/(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one number",
        });
      }

      if (!/(?=.*[@$!%*?&])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one special character (@$!%*?&)",
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

  static requestPasswordResetViaPhone = async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      const result = await requestPasswordResetViaPhoneService(phone);

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

  static resetPasswordViaPhone = async (req: Request, res: Response) => {
    try {
      const { phone, otp, newPassword } = req.body;

      if (!phone || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Phone number, OTP, and new password are required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
        });
      }

      if (!/(?=.*[a-z])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one lowercase letter",
        });
      }

      if (!/(?=.*[A-Z])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one uppercase letter",
        });
      }

      if (!/(?=.*\d)/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one number",
        });
      }

      if (!/(?=.*[@$!%*?&])/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least one special character (@$!%*?&)",
        });
      }

      const result = await resetPasswordViaPhoneService(phone, otp, newPassword);

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

  static getUserById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await getUserById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getUserByEmail = async (req: Request, res: Response) => {
    try {
      const { email } = req.params;
      const user = await getUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

  static getUserByPhone = async (req: Request, res: Response) => {
    try {
      const { phone } = req.params;
      const user = await getUserByPhone(phone);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}
