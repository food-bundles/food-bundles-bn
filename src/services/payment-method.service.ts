import prisma from "../prisma";

export interface PaymentMethodData {
  tableTronicId?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  createdBy: string;
}

// Create PaymentMethod
export const createPaymentMethodService = async (
  methodData: PaymentMethodData
) => {
  // Validate payment method name against accepted values
  const acceptedPaymentMethods = [
    "MOBILE_MONEY",
    "CARD",
    "BANK_TRANSFER",
    "CASH",
    "VOUCHER",
  ];
  if (!acceptedPaymentMethods.includes(methodData.name.toUpperCase())) {
    throw new Error(
      `Invalid payment method. Accepted methods are: ${acceptedPaymentMethods.join(
        ", "
      )}`
    );
  }

  // Check if admin exists and has permission
  const admin = await prisma.admin.findUnique({
    where: { id: methodData.createdBy },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can create payment methods");
  }

  // Check if method name already exists (case insensitive)
  const existingMethod = await prisma.paymentMethodConfig.findFirst({
    where: {
      name: {
        equals: methodData.name,
        mode: "insensitive",
      },
    },
  });

  if (existingMethod) {
    throw new Error("Payment method name already exists");
  }

  // Create the payment method
  const paymentMethod = await prisma.paymentMethodConfig.create({
    data: {
      tableTronicId: methodData.tableTronicId,
      name: methodData.name.trim(),
      description: methodData.description?.trim(),
      isActive: methodData.isActive ?? true,
      createdBy: methodData.createdBy,
    },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return paymentMethod;
};

// Get all PaymentMethods with filtering and pagination
export const getAllPaymentMethodsService = async ({
  search,
  isActive,
  page = 1,
  limit = 10,
}: {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [methods, total] = await Promise.all([
    prisma.paymentMethodConfig.findMany({
      where,
      skip,
      take: limit,
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.paymentMethodConfig.count({ where }),
  ]);

  return {
    methods,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get PaymentMethod by ID
export const getPaymentMethodByIdService = async (methodId: string) => {
  const method = await prisma.paymentMethodConfig.findUnique({
    where: { id: methodId },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!method) {
    throw new Error("Payment method not found");
  }

  return method;
};

// Update PaymentMethod
export const updatePaymentMethodService = async (
  methodId: string,
  updateData: Partial<PaymentMethodData>,
  adminId: string
) => {
  // Check if method exists
  const existingMethod = await prisma.paymentMethodConfig.findUnique({
    where: { id: methodId },
  });

  if (!existingMethod) {
    throw new Error("Payment method not found");
  }

  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update payment methods");
  }

  // Check name uniqueness if name is being updated
  if (updateData.name && updateData.name !== existingMethod.name) {
    // Validate payment method name against accepted values
    const acceptedPaymentMethods = [
      "MOBILE_MONEY",
      "CARD",
      "BANK_TRANSFER",
      "CASH",
      "VOUCHER",
    ];
    if (!acceptedPaymentMethods.includes(updateData.name.toUpperCase())) {
      throw new Error(
        `Invalid payment method. Accepted methods are: ${acceptedPaymentMethods.join(
          ", "
        )}`
      );
    }

    const existingName = await prisma.paymentMethodConfig.findFirst({
      where: {
        name: {
          equals: updateData.name,
          mode: "insensitive",
        },
        NOT: {
          id: methodId,
        },
      },
    });

    if (existingName) {
      throw new Error("Payment method name already exists");
    }
  }

  // Update payment method
  const updatedMethod = await prisma.paymentMethodConfig.update({
    where: { id: methodId },
    data: {
      ...(updateData.tableTronicId !== undefined && {
        tableTronicId: updateData.tableTronicId,
      }),
      ...(updateData.name !== undefined && {
        name: updateData.name.trim(),
      }),
      ...(updateData.description !== undefined && {
        description: updateData.description?.trim(),
      }),
      ...(updateData.isActive !== undefined && {
        isActive: updateData.isActive,
      }),
    },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  return updatedMethod;
};

// Delete PaymentMethod
export const deletePaymentMethodService = async (methodId: string) => {
  // Check if method exists
  const method = await prisma.paymentMethodConfig.findUnique({
    where: { id: methodId },
  });

  if (!method) {
    throw new Error("Payment method not found");
  }

  // Delete method
  await prisma.paymentMethodConfig.delete({
    where: { id: methodId },
  });

  return { message: "Payment method deleted successfully" };
};

// Get active PaymentMethods for dropdowns/selection
export const getActivePaymentMethodsService = async () => {
  const methods = await prisma.paymentMethodConfig.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return methods;
};

// Bulk update method status
export const updateMethodStatusService = async (
  methodIds: string[],
  isActive: boolean,
  adminId: string
) => {
  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update payment methods");
  }

  // Update multiple methods
  const result = await prisma.paymentMethodConfig.updateMany({
    where: {
      id: {
        in: methodIds,
      },
    },
    data: {
      isActive,
    },
  });

  return {
    message: `${result.count} payment methods updated successfully`,
    updatedCount: result.count,
  };
};
