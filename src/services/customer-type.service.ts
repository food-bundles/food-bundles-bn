import prisma from "../prisma";

export interface CustomerTypeData {
  name: string;
  description?: string;
  createdBy: string;
}

export const createCustomerTypeService = async (data: CustomerTypeData) => {
  const admin = await prisma.admin.findUnique({ where: { id: data.createdBy } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can create customer types");

  const existing = await prisma.customerType.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new Error("Customer type name already exists");

  return prisma.customerType.create({
    data: { name: data.name.trim(), description: data.description?.trim(), createdBy: data.createdBy },
  });
};

export const getAllCustomerTypesService = async () => {
  return prisma.customerType.findMany({
    select: { id: true, name: true, description: true, isActive: true, createdAt: true },
    orderBy: { name: "asc" },
  });
};

export const toggleCustomerTypeStatusService = async (id: string, adminId: string) => {
  const existing = await prisma.customerType.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer type not found");

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can toggle customer type status");

  return prisma.customerType.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
};

export const getCustomerTypeByIdService = async (id: string) => {
  const customerType = await prisma.customerType.findUnique({ where: { id } });
  if (!customerType) throw new Error("Customer type not found");
  return customerType;
};

export const updateCustomerTypeService = async (
  id: string,
  data: Partial<CustomerTypeData>,
  adminId: string
) => {
  const existing = await prisma.customerType.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer type not found");

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can update customer types");

  if (data.name && data.name !== existing.name) {
    const nameTaken = await prisma.customerType.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id } },
    });
    if (nameTaken) throw new Error("Customer type name already exists");
  }

  return prisma.customerType.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
    },
  });
};

export const deleteCustomerTypeService = async (id: string) => {
  const existing = await prisma.customerType.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer type not found");
  await prisma.customerType.delete({ where: { id } });
  return { message: "Customer type deleted successfully" };
};

export const getCustomerTypeUsageService = async () => {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      productName: true,
      unitPrice: true,
      purchasePrice: true,
      customerTypePrices: {
        select: {
          id: true,
          price: true,
          purchasePrice: true,
          customerType: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { productName: "asc" },
  });

  const customerTypes = await prisma.customerType.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });

  return { products, customerTypes };
};

export const getPriceUsageService = async () => {
  const [restaurants, customerTypes] = await Promise.all([
    prisma.restaurant.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        location: true,
        customerType: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.customerType.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const usage = restaurants.map(({ customerType, ...restaurant }) => {
    // An explicit assignment wins; otherwise fall back to the customer type named after the buyer's role
    const roleDefault = customerTypes.find(
      (ct) => ct.name.toUpperCase() === restaurant.role.toUpperCase()
    );
    const assignedCustomerType = customerType ?? roleDefault ?? null;
    return {
      ...restaurant,
      assignedCustomerType,
      isExplicitAssignment: !!customerType,
      isUsingOwnPricing: !!assignedCustomerType,
    };
  });

  return { restaurants: usage, customerTypes };
};

/**
 * Assign the customer type whose prices a buyer pays. Pass null to clear the assignment
 * and fall back to the customer type named after the buyer's role. The buyer's role is untouched.
 */
export const assignCustomerTypeService = async (
  restaurantId: string,
  customerTypeId: string | null,
  adminId: string
) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can assign customer types");

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error("Restaurant not found");

  let customerType: { id: string; name: string; isActive: boolean } | null = null;
  if (customerTypeId) {
    customerType = await prisma.customerType.findUnique({
      where: { id: customerTypeId },
      select: { id: true, name: true, isActive: true },
    });
    if (!customerType) throw new Error("Customer type not found");
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { customerTypeId },
    select: { id: true, name: true },
  });

  if (!customerType) {
    customerType = await prisma.customerType.findFirst({
      where: { name: { equals: restaurant.role, mode: "insensitive" } },
      select: { id: true, name: true, isActive: true },
    });
  }

  return {
    message: customerTypeId
      ? `${updated.name} now uses ${customerType!.name} pricing`
      : `${updated.name} reset to default pricing`,
    restaurant: {
      id: updated.id,
      assignedCustomerType: customerType,
      isExplicitAssignment: !!customerTypeId,
      isUsingOwnPricing: !!customerType,
    },
  };
};

export const swapCustomerTypePricingService = async (
  sourceCustomerTypeId: string,
  targetCustomerTypeId: string,
  productIds: string[],
  adminId: string
) => {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can swap customer type pricing");

  if (sourceCustomerTypeId === targetCustomerTypeId) {
    throw new Error("Source and target customer types must be different");
  }

  const source = await prisma.customerType.findUnique({ where: { id: sourceCustomerTypeId } });
  if (!source) throw new Error("Source customer type not found");

  const target = await prisma.customerType.findUnique({ where: { id: targetCustomerTypeId } });
  if (!target) throw new Error("Target customer type not found");

  // Get source pricing records for the selected products
  const sourceRecords = await prisma.productCustomerPrice.findMany({
    where: {
      customerTypeId: sourceCustomerTypeId,
      productId: { in: productIds },
    },
  });

  if (sourceRecords.length === 0) {
    throw new Error("No pricing found for the source customer type on selected products");
  }

  const updatedProducts: { productId: string; productName: string; newPrice: number; newPurchasePrice: number }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const sourceRecord of sourceRecords) {
      // Check if target already has a record for this product
      const existingTarget = await tx.productCustomerPrice.findUnique({
        where: {
          productId_customerTypeId: {
            productId: sourceRecord.productId,
            customerTypeId: targetCustomerTypeId,
          },
        },
      });

      if (existingTarget) {
        // Update existing target record
        await tx.productCustomerPrice.update({
          where: { id: existingTarget.id },
          data: {
            price: sourceRecord.price,
            purchasePrice: sourceRecord.purchasePrice,
          },
        });
      } else {
        // Create new target record
        await tx.productCustomerPrice.create({
          data: {
            productId: sourceRecord.productId,
            customerTypeId: targetCustomerTypeId,
            price: sourceRecord.price,
            purchasePrice: sourceRecord.purchasePrice,
          },
        });
      }

      // Get product name for response
      const product = await tx.product.findUnique({
        where: { id: sourceRecord.productId },
        select: { productName: true },
      });

      updatedProducts.push({
        productId: sourceRecord.productId,
        productName: product?.productName || "Unknown",
        newPrice: sourceRecord.price,
        newPurchasePrice: sourceRecord.purchasePrice,
      });
    }
  });

  return {
    message: `Pricing copied successfully from ${source.name} to ${target.name}`,
    updatedCount: updatedProducts.length,
    products: updatedProducts,
  };
};
