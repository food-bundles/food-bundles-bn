import prisma from "../prisma";
import { hashPassword } from "../utils/password";
import { sendAffiliatorWelcomeEmail } from "../utils/emailTemplates";
import { sendMessage } from "../utils/sms.utility";
import crypto from "crypto";
import { checkExistingUser } from "./userServices";

interface CreateAffiliatorData {
  name: string;
  email?: string;
  phone?: string;
  restaurantId: string;
}

/**
 * Create a new affiliator
 */
export const createAffiliatorService = async (data: CreateAffiliatorData) => {
  const { name, email, phone, restaurantId } = data;

  // Validate that at least email or phone is provided
  if (!email && !phone) {
    throw new Error("Either email or phone number must be provided");
  }

  // Check if restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Check if affiliator already exists
  const existingAffiliator = await checkExistingUser(
    phone || undefined,
    email || undefined
  );

  if (existingAffiliator) {
    throw new Error("Affiliator with this email or phone already exists");
  }

  // Generate random password
  const password = crypto.randomBytes(8).toString("hex");
  const hashedPassword = await hashPassword(password);

  // Create affiliator
  const affiliator = await prisma.affiliator.create({
    data: {
      name,
      email,
      phone,
      restaurantId,
      password: hashedPassword,
      role: "AFFILIATOR",
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Send welcome email or SMS
  if (email) {
    await sendAffiliatorWelcomeEmail(email, name, restaurant.name, password);
  }

  if (phone) {
    await sendMessage(
      `Welcome ${name}! You've been added as an affiliator for ${restaurant.name} restaurant. Visit our website and login with phone: ${phone} and password: ${password}`,
      phone
    );
  }

  return affiliator;
};

/**
 * Get all affiliators for a restaurant
 */
export const getRestaurantAffiliatorsService = async (restaurantId: string) => {
  const affiliators = await prisma.affiliator.findMany({
    where: { restaurantId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
        },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return affiliators;
};

/**
 * Get affiliator by ID
 */
export const getAffiliatorByIdService = async (id: string) => {
  const affiliator = await prisma.affiliator.findUnique({
    where: { id },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      orders: {
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!affiliator) {
    throw new Error("Affiliator not found");
  }

  return affiliator;
};

/**
 * Update affiliator
 */
export const updateAffiliatorService = async (
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
  }
) => {
  const { name, email, phone } = data;

  // Check if affiliator exists
  const existingAffiliator = await prisma.affiliator.findUnique({
    where: { id },
  });

  if (!existingAffiliator) {
    throw new Error("Affiliator not found");
  }

  // Check for conflicts if email or phone is being updated
  if (email || phone) {
    const conflictingAffiliator = await prisma.affiliator.findFirst({
      where: {
        AND: [
          { id: { not: id } },
          {
            OR: [email ? { email } : {}, phone ? { phone } : {}].filter(
              Boolean
            ),
          },
        ],
      },
    });

    if (conflictingAffiliator) {
      throw new Error(
        "Another affiliator with this email or phone already exists"
      );
    }
  }

  const updatedAffiliator = await prisma.affiliator.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(email && { email }),
      ...(phone && { phone }),
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return updatedAffiliator;
};

/**
 * Delete affiliator
 */
export const deleteAffiliatorService = async (id: string) => {
  const affiliator = await prisma.affiliator.findUnique({
    where: { id },
    include: {
      orders: {
        select: { id: true },
      },
    },
  });

  if (!affiliator) {
    throw new Error("Affiliator not found");
  }

  // Check if affiliator has orders
  if (affiliator.orders.length > 0) {
    throw new Error("Cannot delete affiliator with existing orders");
  }

  await prisma.affiliator.delete({
    where: { id },
  });

  return { message: "Affiliator deleted successfully" };
};

/**
 * Get all affiliators (Admin only)
 */
export const getAllAffiliatorsService = async (filters?: {
  restaurantId?: string;
  page?: number;
  limit?: number;
}) => {
  const { restaurantId, page = 1, limit = 10 } = filters || {};
  const skip = (page - 1) * limit;

  const where: any = {};
  if (restaurantId) {
    where.restaurantId = restaurantId;
  }

  const [affiliators, totalCount] = await Promise.all([
    prisma.affiliator.findMany({
      where,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
        orders: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.affiliator.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    affiliators,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};
