import prisma from "../prisma";

export interface ProductUnitData {
  tableTronicId?: number;
  name: string;
  description?: string;
  isActive?: boolean;
  createdBy: string;
}

// Create ProductUnit
export const createProductUnitService = async (unitData: ProductUnitData) => {
  // Check if admin exists and has permission
  const admin = await prisma.admin.findUnique({
    where: { id: unitData.createdBy },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can create product units");
  }

  // Check if unit name already exists (case insensitive)
  const existingUnit = await prisma.productUnit.findFirst({
    where: {
      name: {
        equals: unitData.name,
        mode: "insensitive",
      },
    },
  });

  if (existingUnit) {
    throw new Error("Product unit name already exists");
  }

  // Create the product unit
  const productUnit = await prisma.productUnit.create({
    data: {
      tableTronicId: unitData.tableTronicId,
      name: unitData.name.trim(),
      description: unitData.description?.trim(),
      isActive: unitData.isActive ?? true,
      createdBy: unitData.createdBy,
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

  return productUnit;
};

// Get all ProductUnits with filtering and pagination
export const getAllProductUnitsService = async ({
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

  const [units, total] = await Promise.all([
    prisma.productUnit.findMany({
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
    prisma.productUnit.count({ where }),
  ]);

  return {
    units,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get ProductUnit by ID
export const getProductUnitByIdService = async (unitId: string) => {
  const unit = await prisma.productUnit.findUnique({
    where: { id: unitId },
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

  if (!unit) {
    throw new Error("Product unit not found");
  }

  return unit;
};

// Update ProductUnit
export const updateProductUnitService = async (
  unitId: string,
  updateData: Partial<ProductUnitData>,
  adminId: string
) => {
  // Check if unit exists
  const existingUnit = await prisma.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!existingUnit) {
    throw new Error("Product unit not found");
  }

  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update product units");
  }

  // Check name uniqueness if name is being updated
  if (updateData.name && updateData.name !== existingUnit.name) {
    const existingName = await prisma.productUnit.findFirst({
      where: {
        name: {
          equals: updateData.name,
          mode: "insensitive",
        },
        NOT: {
          id: unitId,
        },
      },
    });

    if (existingName) {
      throw new Error("Product unit name already exists");
    }
  }

  // Update product unit
  const updatedUnit = await prisma.productUnit.update({
    where: { id: unitId },
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

  return updatedUnit;
};

// Delete ProductUnit
export const deleteProductUnitService = async (unitId: string) => {
  // Check if unit exists
  const unit = await prisma.productUnit.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new Error("Product unit not found");
  }

  // Delete unit
  await prisma.productUnit.delete({
    where: { id: unitId },
  });

  return { message: "Product unit deleted successfully" };
};

// Get active ProductUnits for dropdowns/selection
export const getActiveProductUnitsService = async () => {
  const units = await prisma.productUnit.findMany({
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

  return units;
};

// Bulk update unit status
export const updateUnitStatusService = async (
  unitIds: string[],
  isActive: boolean,
  adminId: string
) => {
  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update product units");
  }

  // Update multiple units
  const result = await prisma.productUnit.updateMany({
    where: {
      id: {
        in: unitIds,
      },
    },
    data: {
      isActive,
    },
  });

  return {
    message: `${result.count} units updated successfully`,
    updatedCount: result.count,
  };
};