import { Request, Response } from "express";
import { inviteServices } from "../services/invite.services";
import { sendInvitationEmail } from "../utils/emailTemplates";
import { Role } from "@prisma/client";

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

      const result = await inviteServices.createInvite({
        email,
        role,
      });

      // Send invitation email
      await sendInvitationEmail(email, "User", result.inviteUrl);

      res.status(201).json({
        success: true,
        message: "Invitation sent successfully",
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
      const result = await inviteServices.resendInvite(id);

      // Send invitation email
      await sendInvitationEmail(
        result.invitation.email,
        "User",
        result.inviteUrl
      );

      res.status(200).json({
        success: true,
        message: "Invitation resent successfully",
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
