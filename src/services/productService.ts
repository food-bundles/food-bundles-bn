import prisma from "../prisma";

export interface ProductData {
  productName: string;
  unitPrice: number;
  purchasePrice: number;
  categoryId: string;
  category?: Category;
  bonus?: number;
  sku: string;
  quantity: number;
  images: string[];
  expiryDate: Date | null;
  unit: string;
  createdBy: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export const createProductService = async (productData: ProductData) => {
  // Check if admin exists
  const admin = await prisma.admin.findUnique({
    where: { id: productData.createdBy },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can create products");
  }

  // Check if SKU already exists
  const existingSku = await prisma.product.findUnique({
    where: { sku: productData.sku },
  });

  if (existingSku) {
    throw new Error("SKU already exists");
  }

  // Create the product with proper admin connection
  const product = await prisma.product.create({
    data: {
      productName: productData.productName,
      unitPrice: Number(productData.unitPrice),
      purchasePrice: Number(productData.purchasePrice),
      categoryId: productData.categoryId,
      bonus: Number(productData.bonus) || 0, // Use || instead of ?? for NaN handling
      sku: productData.sku,
      quantity: Number(productData.quantity),
      images: productData.images,
      expiryDate: productData.expiryDate,
      unit: productData.unit,
      createdBy: productData.createdBy,
    },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },

      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  return product;
};

// Update product quantity from submission
export const updateProductQuantityFromSubmissionService = async ({
  submissionId,
  productId,
}: {
  submissionId: string;
  productId: string;
}) => {
  // Check if submission exists and is VERIFIED
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Farmer submission not found");
  }

  if (submission.status !== "VERIFIED") {
    throw new Error("Only VERIFIED submissions can be approved");
  }

  // Check if product exists
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  // Update product quantity and submission status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update product quantity
    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: {
        quantity: {
          increment: submission.acceptedQty || 0,
        },
      },
    });

    // Update submission status to APPROVED and link to product
    const updatedSubmission = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedProductId: product.id,
      },
      include: {
        farmer: {
          select: {
            id: true,
            phone: true,
          },
        },
        aggregator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        approvedProduct: {
          select: {
            id: true,
            productName: true,
            sku: true,
            unitPrice: true,
          },
        },
      },
    });

    return {
      product: updatedProduct,
      submission: updatedSubmission,
    };
  });

  return result;
};

// Update existing product
export const updateProductService = async (
  productId: string,
  updateData: Partial<ProductData>,
  adminId: string
) => {
  // Check if product exists
  const existingProduct = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!existingProduct) {
    throw new Error("Product not found");
  }

  // Check if admin has permission
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can update products");
  }

  // Check SKU uniqueness if SKU is being updated
  if (updateData.sku && updateData.sku !== existingProduct.sku) {
    const existingSku = await prisma.product.findUnique({
      where: { sku: updateData.sku },
    });

    if (existingSku) {
      throw new Error("SKU already exists");
    }
  }

  // Update product
  const updatedProduct = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(updateData.productName !== undefined && {
        productName: updateData.productName,
      }),
      ...(updateData.unitPrice !== undefined && {
        unitPrice: Number(updateData.unitPrice),
      }),
      ...(updateData.categoryId !== undefined && {
        categoryId: updateData.categoryId,
      }),
      ...(updateData.bonus !== undefined && {
        bonus: Number(updateData.bonus),
      }),
      ...(updateData.sku !== undefined && { sku: updateData.sku }),
      ...(updateData.quantity !== undefined && {
        quantity: Number(updateData.quantity),
      }),
      ...(updateData.images !== undefined && { images: updateData.images }),
      ...(updateData.expiryDate !== undefined && {
        expiryDate: updateData.expiryDate,
      }),
      ...(updateData.unit !== undefined && { unit: updateData.unit }),
    },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });

  return updatedProduct;
};

// Create product from verified farmer submission and approve it
export const createProductFromSubmissionService = async ({
  submissionId,
  productData,
}: {
  submissionId: string;
  productData: ProductData;
}) => {
  // Check if submission exists and is VERIFIED
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!submission) {
    throw new Error("Farmer submission not found");
  }

  if (submission.status !== "VERIFIED") {
    throw new Error("Only VERIFIED submissions can be approved");
  }

  // Check if admin exists
  const admin = await prisma.admin.findUnique({
    where: { id: productData.createdBy },
  });

  if (!admin || admin.role !== "ADMIN") {
    throw new Error("Only ADMIN users can create products");
  }

  // Check if SKU already exists
  const existingSku = await prisma.product.findUnique({
    where: { sku: productData.sku },
  });

  if (existingSku) {
    throw new Error("SKU already exists");
  }

  // Create product and update submission status in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the product
    const product = await tx.product.create({
      data: {
        productName: productData.productName,
        unitPrice: productData.unitPrice,
        purchasePrice: productData.purchasePrice,
        categoryId: productData.categoryId,
        bonus: productData.bonus ?? 0,
        sku: productData.sku,
        quantity: productData.quantity,
        images: productData.images,
        expiryDate: productData.expiryDate,
        unit: productData.unit,
        createdBy: productData.createdBy,
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

    // Update submission status to APPROVED and link to product
    const updatedSubmission = await tx.farmerSubmission.update({
      where: { id: submissionId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedProductId: product.id,
      },
      include: {
        farmer: {
          select: {
            id: true,
            phone: true,
          },
        },
        aggregator: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        approvedProduct: {
          select: {
            id: true,
            productName: true,
            sku: true,
            unitPrice: true,
          },
        },
      },
    });

    return {
      product,
      submission: updatedSubmission,
    };
  });

  return result;
};

// Update existing product
// export const updateProductService = async (
//   productId: string,
//   updateData: Partial<ProductData>,
//   adminId: string
// ) => {
//   // Check if product exists
//   const existingProduct = await prisma.product.findUnique({
//     where: { id: productId },
//   });

//   if (!existingProduct) {
//     throw new Error("Product not found");
//   }

//   // Check if admin has permission
//   const admin = await prisma.admin.findUnique({
//     where: { id: adminId },
//   });

//   if (!admin || admin.role !== "ADMIN") {
//     throw new Error("Only ADMIN users can update products");
//   }

//   // Check SKU uniqueness if SKU is being updated
//   if (updateData.sku && updateData.sku !== existingProduct.sku) {
//     const existingSku = await prisma.product.findUnique({
//       where: { sku: updateData.sku },
//     });

//     if (existingSku) {
//       throw new Error("SKU already exists");
//     }
//   }

//   // Update product
//   const updatedProduct = await prisma.product.update({
//     where: { id: productId },
//     data: updateData,
//     include: {
//       admin: {
//         select: {
//           id: true,
//           username: true,
//           email: true,
//         },
//       },
//     },
//   });

//   return updatedProduct;
// };

// Delete product

export const deleteProductService = async (productId: string) => {
  // Check if product has any orders
  const productWithOrders = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      orderItems: true,
    },
  });

  if (!productWithOrders) {
    throw new Error("Product not found");
  }

  if (productWithOrders.orderItems.length > 0) {
    throw new Error("Cannot delete product that has been ordered");
  }

  // Delete product
  await prisma.product.delete({
    where: { id: productId },
  });
};

// Get all products with filtering and pagination
export const getAllProductsService = async ({
  categoryId,
  search,
  page = 1,
  limit = 10,
}: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {
    status: "ACTIVE", // Only active products
    quantity: { gt: 0 }, // Only products with quantity > 0
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { productName: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        productName: true,
        unitPrice: true,
        category: true,
        bonus: true,
        sku: true,
        quantity: true,
        images: true,
        unit: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.product.count({ where }),
  ]);

  // Calculate discounted price for products with bonus
  const productsWithDiscount = products.map((product) => ({
    ...product,
    discountedPrice:
      Number(product.bonus) > 0
        ? product.unitPrice * (1 - Number(product.bonus) / 100)
        : null,
  }));

  return {
    products: productsWithDiscount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get products by user role with appropriate filters and data
export const getProductsByRoleService = async ({
  role,
  category,
  search,
  page = 1,
  limit = 10,
}: {
  role: "ADMIN" | "AGGREGATOR" | "LOGISTICS";
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const skip = (page - 1) * limit;

  const baseWhere: any = {
    status: "ACTIVE",
  };

  if (category) {
    baseWhere.category = category;
  }

  if (search) {
    baseWhere.OR = [
      { productName: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
    ];
  }

  // Role-specific filters and data selection
  let selectFields: any;
  let additionalWhere: any = {};

  switch (role) {
    case "ADMIN":
      selectFields = {
        id: true,
        productName: true,
        unitPrice: true,
        purchasePrice: true,
        category: true,
        bonus: true,
        sku: true,
        quantity: true,
        images: true,
        unit: true,
        status: true,
        expiryDate: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        admin: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      };
      break;

    case "AGGREGATOR":
      selectFields = {
        id: true,
        productName: true,
        unitPrice: true,
        purchasePrice: true,
        category: true,
        bonus: true,
        sku: true,
        quantity: true,
        images: true,
        unit: true,
        expiryDate: true,
      };
      additionalWhere.quantity = { gt: 0 }; // Only products with quantity
      break;

    case "LOGISTICS":
      selectFields = {
        id: true,
        productName: true,
        unitPrice: true,
        category: true,
        bonus: true,
        sku: true,
        quantity: true,
        images: true,
        unit: true,
      };
      additionalWhere.quantity = { gt: 0 }; // Only products with quantity
      break;

    default:
      selectFields = {
        id: true,
        productName: true,
        unitPrice: true,
        category: true,
        bonus: true,
        sku: true,
        quantity: true,
        images: true,
        unit: true,
      };
      additionalWhere.quantity = { gt: 0 }; // Only products with quantity
  }

  const where = { ...baseWhere, ...additionalWhere };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      select: selectFields,
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.product.count({ where }),
  ]);

  // Calculate discounted price for products with bonus
  const productsWithDiscount = products.map((product) => ({
    ...product,
    discountedPrice:
      Number(product.bonus) > 0
        ? Number(product.unitPrice) * (1 - Number(product.bonus) / 100)
        : null,
  }));

  return {
    products: productsWithDiscount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get product by ID
export const getProductByIdService = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
      farmerSubmissions: {
        include: {
          farmer: {
            select: {
              id: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  return product;
};

// Get verified submissions ready for approval
export const getVerifiedSubmissionsService = async () => {
  const submissions = await prisma.farmerSubmission.findMany({
    where: {
      status: "VERIFIED",
      approvedProductId: null, // Not yet converted to product
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: {
      verifiedAt: "asc",
    },
  });

  return submissions;
};

// Approve submission without creating product
export const approveSubmissionService = async (submissionId: string) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error("Submission not found");
  }

  if (submission.status !== "VERIFIED") {
    throw new Error("Only VERIFIED submissions can be approved");
  }

  if (submission.farmerFeedbackStatus !== "ACCEPTED") {
    throw new Error(
      "Only submissions with ACCEPTED feedback from farmer can be approved"
    );
  }

  const updatedSubmission = await prisma.farmerSubmission.update({
    where: { id: submissionId },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
        },
      },
      aggregator: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!updatedSubmission) {
    throw new Error("Submission not found");
  }

  // Update product quantity of same name of farmer submission
  await prisma.product.update({
    where: {
      productName: submission.productName,
    },
    data: {
      quantity: {
        increment: submission.acceptedQty ?? 0,
      },
    },
  });

  return updatedSubmission;
};
