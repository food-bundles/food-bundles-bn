import prisma from "../prisma";

export interface ProductCategoryData {
  name: string;
  description?: string;
  isActive?: boolean;
  createdBy: string;
}

// Create ProductCategory
export const createProductCategoryService = async (
  categoryData: ProductCategoryData
) => {
  // Check if admin exists and has permission
  const admin = await prisma.admin.findUnique({
    where: { id: categoryData.createdBy },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can create product categories");
  }

  // Check if category name already exists (case insensitive)
  const existingCategory = await prisma.productCategory.findFirst({
    where: {
      name: {
        equals: categoryData.name,
        mode: "insensitive",
      },
    },
  });

  if (existingCategory) {
    throw new Error("Product category name already exists");
  }

  // Create the product category
  const productCategory = await prisma.productCategory.create({
    data: {
      name: categoryData.name.trim(),
      description: categoryData.description?.trim(),
      isActive: categoryData.isActive ?? true,
      createdBy: categoryData.createdBy,
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

  return productCategory;
};

// Get all ProductCategories with filtering and pagination
export const getAllProductCategoriesService = async ({
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

  const [categories, total] = await Promise.all([
    prisma.productCategory.findMany({
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
        _count: {
          select: {
            products: true,
            farmerSubmissions: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.productCategory.count({ where }),
  ]);

  return {
    categories,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get ProductCategory by ID
export const getProductCategoryByIdService = async (categoryId: string) => {
  const category = await prisma.productCategory.findUnique({
    where: { id: categoryId },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      _count: {
        select: {
          products: true,
          farmerSubmissions: true,
        },
      },
      products: {
        select: {
          id: true,
          productName: true,
          sku: true,
          quantity: true,
          status: true,
        },
        where: {
          status: "ACTIVE",
        },
        take: 10, // Limit to prevent large responses
      },
    },
  });

  if (!category) {
    throw new Error("Product category not found");
  }

  return category;
};

// Update ProductCategory
export const updateProductCategoryService = async (
  categoryId: string,
  updateData: Partial<ProductCategoryData>,
  adminId: string
) => {
  // Check if category exists
  const existingCategory = await prisma.productCategory.findUnique({
    where: { id: categoryId },
  });

  if (!existingCategory) {
    throw new Error("Product category not found");
  }

  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update product categories");
  }

  // Check name uniqueness if name is being updated
  if (updateData.name && updateData.name !== existingCategory.name) {
    const existingName = await prisma.productCategory.findFirst({
      where: {
        name: {
          equals: updateData.name,
          mode: "insensitive",
        },
        NOT: {
          id: categoryId,
        },
      },
    });

    if (existingName) {
      throw new Error("Product category name already exists");
    }
  }

  // Update product category
  const updatedCategory = await prisma.productCategory.update({
    where: { id: categoryId },
    data: {
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
      _count: {
        select: {
          products: true,
          farmerSubmissions: true,
        },
      },
    },
  });

  return updatedCategory;
};

// Delete ProductCategory
export const deleteProductCategoryService = async (categoryId: string) => {
  // Check if category exists
  const category = await prisma.productCategory.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: {
          products: true,
          farmerSubmissions: true,
        },
      },
    },
  });

  if (!category) {
    throw new Error("Product category not found");
  }

  // Check if category has associated products or submissions
  if (category._count.products > 0) {
    throw new Error(
      "Cannot delete category that has associated products. Please reassign or delete products first."
    );
  }

  if (category._count.farmerSubmissions > 0) {
    throw new Error(
      "Cannot delete category that has associated farmer submissions. Please reassign or delete submissions first."
    );
  }

  // Delete category
  await prisma.productCategory.delete({
    where: { id: categoryId },
  });

  return { message: "Product category deleted successfully" };
};

// Get active ProductCategories for dropdowns/selection
export const getActiveProductCategoriesService = async () => {
  const categories = await prisma.productCategory.findMany({
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

  return categories;
};

// Bulk update category status
export const updateCategoryStatusService = async (
  categoryIds: string[],
  isActive: boolean,
  adminId: string
) => {
  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update product categories");
  }

  // Update multiple categories
  const result = await prisma.productCategory.updateMany({
    where: {
      id: {
        in: categoryIds,
      },
    },
    data: {
      isActive,
    },
  });

  return {
    message: `${result.count} categories updated successfully`,
    updatedCount: result.count,
  };
};
