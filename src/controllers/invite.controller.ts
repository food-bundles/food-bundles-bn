import { Request, Response } from "express";
import { inviteServices } from "../services/invite.services";
import { sendInvitationEmail, sendAdminUserCreatedEmail } from "../utils/emailTemplates";
import { sendMessage } from "../utils/sms.utility";
import { createNotificationService } from "../services/notification.services";
import { Role } from "@prisma/client";
import prisma from "../prisma";

export const inviteController = {
  // Create invitation
  async createInvite(req: Request, res: Response) {
    try {
      const { email, role } = req.body;

      // Validate required fields
      if (!email || !role) {
        return res.status(400).json({
          success: false,
          message: "Email and role are required",
        });
      }

      // Validate role
      if (!Object.values(Role).includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role specified",
        });
      }

      // Check env vars BEFORE creating invitation
      if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
        return res.status(500).json({
          success: false,
          message: "GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables are not configured",
        });
      }

      const result = await inviteServices.createInvite({
        email,
        role,
      });

      // Send invitation email and track result
      const emailResult = await sendInvitationEmail(email, "User", result.inviteUrl, role);

      res.status(201).json({
        success: true,
        message: emailResult.success
          ? "Invitation sent successfully"
          : "Invitation created but email not sent",
        emailNotSent: !emailResult.success,
        data: {
          id: result.invitation.id,
          email: result.invitation.email,
          role: result.invitation.role,
          inviteUrl: result.inviteUrl,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to create invitation",
      });
    }
  },

  // Get all invitations
  async getAllInvites(req: Request, res: Response) {
    try {
      const invites = await inviteServices.getAllInvites();

      res.status(200).json({
        success: true,
        message: "Invitations retrieved successfully",
        data: invites,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve invitations",
      });
    }
  },

  // Get invitation by ID
  async getInviteById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const invite = await inviteServices.getInviteById(id);

      if (!invite) {
        return res.status(404).json({
          success: false,
          message: "Invitation not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Invitation retrieved successfully",
        data: invite,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve invitation",
      });
    }
  },

  // Verify invitation token
  async verifyInviteToken(req: Request, res: Response) {
    try {
      const { token } = req.params;
      const invitation = await inviteServices.verifyInviteToken(token);

      res.status(200).json({
        success: true,
        message: "Token verified successfully",
        data: {
          email: invitation.email,
          role: invitation.role,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Invalid token",
      });
    }
  },

  // Accept invitation
  async acceptInvite(req: Request, res: Response) {
    try {
      const { token, username, phone, password } = req.body;

      if (!token || !username || !password) {
        return res.status(400).json({
          success: false,
          message: "Token, username, and password are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      const user = await inviteServices.acceptInvite({
        token,
        username,
        phone,
        password,
      });

      // Notify admin: SMS, email, and system notification (fire-and-forget)
      const adminNotificationErrors: string[] = [];

      // 1. SMS to admin private number
      const privateReceiver = process.env.PRIVATE_RECEIVER;
      if (privateReceiver) {
        sendMessage(
          `invitation accepted so account created. New user: ${user.username} (${user.email}) with role: ${user.role}`,
          privateReceiver,
        ).catch((err) => {
          console.error("Failed to send admin SMS for invitation accepted:", err);
          adminNotificationErrors.push("SMS");
        });
      }

      // 2. Email to all ADMIN role users
      prisma.admin
        .findMany({
          where: { role: "ADMIN" },
          select: { email: true, username: true },
        })
        .then((admins) => {
          admins.forEach((admin) => {
            sendAdminUserCreatedEmail({
              userType: user.role,
              userName: user.username,
              userEmail: user.email || "",
            }).catch((err) => {
              console.error(`Failed to send admin email to ${admin.email}:`, err);
              adminNotificationErrors.push(`Email:${admin.email}`);
            });
          });
        })
        .catch((err) => {
          console.error("Failed to fetch admins for notification:", err);
        });

      // 3. System notification for ADMIN role
      createNotificationService({
        title: "Invitation Accepted",
        message: `invitation accepted so account created. New user: ${user.username} (${user.email}) with role: ${user.role}`,
        eventType: "USER_SIGNUP",
        targetType: "ROLE_BASED",
        targetRole: "ADMIN",
        metadata: {
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      }).catch((err) => {
        console.error("Failed to create system notification for invitation accepted:", err);
      });

      res.status(200).json({
        success: true,
        message: "Invitation accepted successfully",
        data: user,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to accept invitation",
      });
    }
  },

  // Resend invitation
  async resendInvite(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check env vars BEFORE resending
      if (!process.env.GOOGLE_EMAIL || !process.env.GOOGLE_PASSWORD) {
        return res.status(500).json({
          success: false,
          message: "GOOGLE_EMAIL and GOOGLE_PASSWORD environment variables are not configured",
        });
      }

      const result = await inviteServices.resendInvite(id);

      // Send invitation email and track result
      const emailResult = await sendInvitationEmail(
        result.invitation.email,
        result.invitation.role,
        result.inviteUrl,
        result.invitation.role,
      );

      res.status(200).json({
        success: true,
        message: emailResult.success
          ? "Invitation resent successfully"
          : "Invitation resent but email not sent",
        emailNotSent: !emailResult.success,
        data: {
          email: result.invitation.email,
          inviteUrl: result.inviteUrl,
        },
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to resend invitation",
      });
    }
  },

  // Cancel invitation
  async cancelInvite(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await inviteServices.cancelInvite(id);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || "Failed to cancel invitation",
      });
    }
  },
};
