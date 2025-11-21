import { PrismaClient, Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import { generateToken, verifyToken } from "../utils/jwt";
import { hashPassword } from "../utils/password";

const prisma = new PrismaClient();

interface CreateInviteData {
  email: string;
  role: Role;
  username: string;
  phone?: string;
}

interface InviteToken {
  email: string;
  role: Role;
  username: string;
  phone?: string;
  iat: number;
  exp: number;
}

export const inviteServices = {
  // Create invitation
  async createInvite(data: CreateInviteData) {
    const { email, role, username, phone } = data;

    // Check if user already exists
    const existingUser = await prisma.admin.findFirst({
      where: { OR: [{ email }, { phone }] },
    });

    if (existingUser) {
      throw new Error("User with this email/phone already exists");
    }

    // Generate random password
    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await hashPassword(randomPassword);

    // Create invitation token (expires in 24 hours)
    const token = generateToken({
      id: email,
      email,
      role,
      username,
      phone,
    } as any);

    // Create user with temporary password
    const user = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        username,
        phone,
        role,
      },
    });

    return {
      user,
      token,
      inviteUrl: `${process.env.CLIENT_PRODUCTION_URL}/signup?token=${token}`,
    };
  },

  // Get all invitations (pending users)
  async getAllInvites() {
    return await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // Get invitation by ID
  async getInviteById(id: string) {
    return await prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  },

  // Verify invitation token
  async verifyInviteToken(token: string) {
    try {
      const decoded = verifyToken(token) as any;

      // Check if user exists
      const user = await prisma.admin.findUnique({
        where: { email: decoded.email },
      });

      if (!user) {
        throw new Error("Invalid or expired invitation");
      }

      return { user, decoded };
    } catch (error) {
      throw new Error("Invalid or expired invitation token");
    }
  },

  // Accept invitation (activate user)
  async acceptInvite(token: string, newPassword: string) {
    const { user } = await this.verifyInviteToken(token);

    const hashedPassword = await hashPassword(newPassword);

    return await prisma.admin.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });
  },

  // Resend invitation
  async resendInvite(id: string) {
    const user = await prisma.admin.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("Invitation not found");
    }

    // Generate new token
    const token = generateToken({
      id: user.email,
      email: user.email,
      role: user.role,
      username: user.username,
      phone: user.phone,
    } as any);

    return {
      user,
      token,
      inviteUrl: `${process.env.CLIENT_PRODUCTION_URL}/signup?token=${token}`,
    };
  },

  // Cancel invitation
  async cancelInvite(id: string) {
    const user = await prisma.admin.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("Invitation not found");
    }

    await prisma.admin.delete({
      where: { id },
    });

    return { message: "Invitation cancelled successfully" };
  },
};
