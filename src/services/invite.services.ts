import { PrismaClient, Role } from "@prisma/client";

import { hashPassword } from "../utils/password";
import crypto from "crypto";
import { checkExistingUser } from "./userServices";

const prisma = new PrismaClient();

interface CreateInviteData {
  email: string;
  role: Role;
}

interface AcceptInviteData {
  token: string;
  username: string;
  phone?: string;
  password: string;
}

export const inviteServices = {
  // Create invitation
  async createInvite(data: CreateInviteData) {
    const { email, role } = data;

    // Check if user already exists
    const existingUser = await checkExistingUser(undefined, email || undefined);

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Check if invitation already exists
    const existingInvite = await prisma.invitation.findFirst({
      where: { email, isUsed: false },
    });

    if (existingInvite) {
      throw new Error("Invitation already sent to this email");
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create invitation
    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
      },
    });

    return {
      invitation,
      token,
      inviteUrl: `${process.env.CLIENT_PRODUCTION_URL}/signup?token=${token}`,
    };
  },

  // Get all invitations
  async getAllInvites() {
    return await prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
    });
  },

  // Get invitation by ID
  async getInviteById(id: string) {
    return await prisma.invitation.findUnique({
      where: { id },
    });
  },

  // Verify invitation token
  async verifyInviteToken(token: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new Error("Invalid invitation token");
    }

    if (invitation.isUsed) {
      throw new Error("Invitation has already been used");
    }

    if (new Date() > invitation.expiresAt) {
      throw new Error("Invitation has expired");
    }

    return invitation;
  },

  // Accept invitation (create user)
  async acceptInvite(data: AcceptInviteData) {
    const { token, username, phone, password } = data;

    const invitation = await this.verifyInviteToken(token);

    // Check if user already exists
    const existingUser = await prisma.admin.findFirst({
      where: { OR: [{ email: invitation.email }, { phone }] },
    });

    if (existingUser) {
      throw new Error("User with this email/phone already exists");
    }

    const hashedPassword = await hashPassword(password);

    // Create user and mark invitation as used
    const [user] = await prisma.$transaction([
      prisma.admin.create({
        data: {
          email: invitation.email,
          username,
          phone,
          password: hashedPassword,
          role: invitation.role,
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      }),
      prisma.invitation.delete({
        where: { id: invitation.id },
      }),
    ]);

    return user;
  },

  // Resend invitation
  async resendInvite(id: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.isUsed) {
      throw new Error("Invitation has already been used");
    }

    // Generate new token and extend expiry
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const updatedInvitation = await prisma.invitation.update({
      where: { id },
      data: { token, expiresAt },
    });

    return {
      invitation: updatedInvitation,
      token,
      inviteUrl: `${process.env.CLIENT_PRODUCTION_URL}/signup?token=${token}`,
    };
  },

  // Cancel invitation
  async cancelInvite(id: string) {
    const invitation = await prisma.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await prisma.invitation.delete({
      where: { id },
    });

    return { message: "Invitation cancelled successfully" };
  },
};
