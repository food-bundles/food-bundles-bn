import prisma from "../prisma";
import { PromoCodeType, DiscountType } from "@prisma/client";

interface CreatePromoCodeData {
  code: string;
  name: string;
  description?: string;
  type: PromoCodeType;
  discountType: DiscountType;
  discountValue: number;
  isReusable?: boolean;
  maxUsageCount?: number;
  maxUsagePerUser?: number;
  minOrderAmount?: number;
  minItemQuantity?: number;
  applyToAllProducts?: boolean;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  startDate?: Date;
  expiryDate?: Date;
  createdBy?: string;
}

interface UpdatePromoCodeData extends Partial<CreatePromoCodeData> {
  isActive?: boolean;
}

interface PromoCodeUsage {
  restaurantId: string;
  orderId: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  itemsDiscounted: number;
  usedAt: Date;
}

interface items {
  productId: string;
  quantity: number;
}

export const createPromoCodeService = async (data: CreatePromoCodeData) => {
  const existingPromo = await prisma.promoCode.findUnique({
    where: { code: data.code },
  });

  if (existingPromo) {
    throw new Error("Promo code already exists");
  }

  return await prisma.promoCode.create({
    data: {
      ...data,
      usageHistory: [],
      excludedRestaurants: [],
      restaurantUsageCount: {},
    },
    include: {
      admin: {
        select: { id: true, username: true, email: true },
      },
    },
  });
};

export const getAllPromoCodesService = async (filters?: {
  type?: PromoCodeType;
  isActive?: boolean;
  search?: string;
}) => {
  const where: any = {};

  if (filters?.type) where.type = filters.type;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { name: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return await prisma.promoCode.findMany({
    where,
    include: {
      admin: {
        select: { id: true, username: true, email: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getPromoCodeByIdService = async (id: string) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id },
    include: {
      admin: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  return promoCode;
};

export const getPromoCodeByCodeService = async (code: string) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { code },
    include: {
      admin: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  return promoCode;
};

export const updatePromoCodeService = async (
  id: string,
  data: UpdatePromoCodeData
) => {
  const existingPromo = await prisma.promoCode.findUnique({
    where: { id },
  });

  if (!existingPromo) {
    throw new Error("Promo code not found");
  }

  if (data.code && data.code !== existingPromo.code) {
    const codeExists = await prisma.promoCode.findUnique({
      where: { code: data.code },
    });
    if (codeExists) {
      throw new Error("Promo code already exists");
    }
  }

  return await prisma.promoCode.update({
    where: { id },
    data,
    include: {
      admin: {
        select: { id: true, username: true, email: true },
      },
    },
  });
};

export const deletePromoCodeService = async (id: string) => {
  const existingPromo = await prisma.promoCode.findUnique({
    where: { id },
  });

  if (!existingPromo) {
    throw new Error("Promo code not found");
  }

  return await prisma.promoCode.delete({
    where: { id },
  });
};

export const validatePromoCodeService = async (
  code: string,
  restaurantId: string,
  orderAmount: number
) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { code },
  });

  if (!promoCode) {
    throw new Error("Invalid promo code");
  }

  if (!promoCode.isActive) {
    throw new Error("Promo code is inactive");
  }

  const now = new Date();
  if (promoCode.startDate && now < promoCode.startDate) {
    throw new Error("Promo code is not yet active");
  }

  if (promoCode.expiryDate && now > promoCode.expiryDate) {
    throw new Error("Promo code has expired");
  }

  if (
    promoCode.maxUsageCount &&
    promoCode.currentUsageCount >= promoCode.maxUsageCount
  ) {
    throw new Error("Promo code usage limit reached");
  }

  if (promoCode.minOrderAmount && orderAmount < promoCode.minOrderAmount) {
    throw new Error(`Minimum order amount is ${promoCode.minOrderAmount} RWF`);
  }

  // Check restaurant-specific usage
  const restaurantUsageCount =
    (promoCode.restaurantUsageCount as any)?.[restaurantId] || 0;
  if (
    promoCode.maxUsagePerUser &&
    restaurantUsageCount >= promoCode.maxUsagePerUser
  ) {
    throw new Error("You have reached the usage limit for this promo code");
  }

  // Check if restaurant is excluded
  const excludedRestaurants = (promoCode.excludedRestaurants as any[]) || [];
  const isExcluded = excludedRestaurants.some(
    (exclusion: any) => exclusion.restaurantId === restaurantId
  );

  if (promoCode.type === "EXCEPTIONAL" && isExcluded) {
    throw new Error("You are not eligible for this promo code");
  }

  // Check subscription requirement
  if (promoCode.type === "SUBSCRIBERS") {
    const activeSubscription = await prisma.restaurantSubscription.findFirst({
      where: {
        restaurantId,
        status: "ACTIVE",
        endDate: { gte: now },
      },
    });

    if (!activeSubscription) {
      throw new Error("This promo code is only available for subscribers");
    }
  }

  return promoCode;
};

export const applyPromoCodeService = async (
  code: string,
  restaurantId: string,
  orderId: string,
  items: items[]
) => {
  // Fetch products for cart items
  const products = await prisma.product.findMany({
    where: {
      id: { in: items.map((item) => item.productId) },
    },
    include: {
      category: true,
    },
  });

  // Build enriched cart items with product data
  const enrichedItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const price = product.unitPrice * (1 - Number(product.bonus) / 100);
    return {
      id: item.productId,
      productId: item.productId,
      quantity: item.quantity,
      price,
      product: {
        id: product.id,
        categoryId: product.categoryId,
      },
    };
  });

  const originalAmount = enrichedItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const totalItemsCount = enrichedItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const promoCode = await validatePromoCodeService(
    code,
    restaurantId,
    originalAmount
  );

  if (
    promoCode.minItemQuantity &&
    totalItemsCount < promoCode.minItemQuantity
  ) {
    throw new Error(`Minimum ${promoCode.minItemQuantity} items required`);
  }

  // Filter applicable items based on promo code configuration
  let applicableItems = enrichedItems;

  if (!promoCode.applyToAllProducts) {
    const applicableProductIds =
      (promoCode.applicableProductIds as string[]) || [];
    const applicableCategoryIds =
      (promoCode.applicableCategoryIds as string[]) || [];

    applicableItems = enrichedItems.filter((item) => {
      const productMatches = applicableProductIds.includes(item.productId);
      const categoryMatches =
        item.product?.categoryId &&
        applicableCategoryIds.includes(item.product.categoryId);
      return productMatches || categoryMatches;
    });
  }

  if (applicableItems.length === 0) {
    throw new Error("No applicable items found for this promo code");
  }

  // Calculate discount for applicable items
  let totalDiscountAmount = 0;
  const discountedItems = applicableItems.map((item) => {
    const itemTotal = item.price * item.quantity;
    let itemDiscount = 0;

    if (promoCode.discountType === "PERCENTAGE") {
      itemDiscount = (itemTotal * promoCode.discountValue) / 100;
    } else {
      // For fixed amount, distribute proportionally across applicable items
      const applicableAmount = applicableItems.reduce(
        (total, appItem) => total + appItem.price * appItem.quantity,
        0
      );
      const proportion = itemTotal / applicableAmount;
      itemDiscount = Math.min(promoCode.discountValue * proportion, itemTotal);
    }

    totalDiscountAmount += itemDiscount;

    return {
      ...item,
      originalPrice: item.price,
      discountAmount: itemDiscount,
      discountedPrice: item.price - itemDiscount / item.quantity,
      finalItemTotal: itemTotal - itemDiscount,
    };
  });

  const finalAmount = originalAmount - totalDiscountAmount;

  // Update usage tracking
  const usageRecord: PromoCodeUsage = {
    restaurantId,
    orderId,
    originalAmount,
    discountAmount: totalDiscountAmount,
    finalAmount,
    itemsDiscounted: applicableItems.reduce(
      (total, item) => total + item.quantity,
      0
    ),
    usedAt: new Date(),
  };

  const currentUsageHistory = (promoCode.usageHistory as any[]) || [];
  const currentRestaurantUsageCount =
    (promoCode.restaurantUsageCount as any) || {};

  await prisma.promoCode.update({
    where: { id: promoCode.id },
    data: {
      currentUsageCount: promoCode.currentUsageCount + 1,
      usageHistory: [...currentUsageHistory, usageRecord],
      restaurantUsageCount: {
        ...currentRestaurantUsageCount,
        [restaurantId]: (currentRestaurantUsageCount[restaurantId] || 0) + 1,
      },
    },
  });

  return {
    promoCode,
    originalAmount,
    discountAmount: totalDiscountAmount,
    finalAmount,
    discountPercentage:
      promoCode.discountType === "PERCENTAGE" ? promoCode.discountValue : 0,
    discountedItems,
    applicableItemsCount: applicableItems.length,
  };
};

export const excludeRestaurantService = async (
  promoCodeId: string,
  restaurantId: string,
  reason: string,
  excludedBy: string
) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: promoCodeId },
  });

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  const currentExclusions = (promoCode.excludedRestaurants as any[]) || [];
  const isAlreadyExcluded = currentExclusions.some(
    (exclusion: any) => exclusion.restaurantId === restaurantId
  );

  if (isAlreadyExcluded) {
    throw new Error("Restaurant is already excluded");
  }

  const newExclusion = {
    restaurantId,
    reason,
    excludedBy,
    excludedAt: new Date(),
  };

  return await prisma.promoCode.update({
    where: { id: promoCodeId },
    data: {
      excludedRestaurants: [...currentExclusions, newExclusion],
    },
  });
};

export const removeRestaurantExclusionService = async (
  promoCodeId: string,
  restaurantId: string
) => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: promoCodeId },
  });

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  const currentExclusions = (promoCode.excludedRestaurants as any[]) || [];
  const updatedExclusions = currentExclusions.filter(
    (exclusion: any) => exclusion.restaurantId !== restaurantId
  );

  return await prisma.promoCode.update({
    where: { id: promoCodeId },
    data: {
      excludedRestaurants: updatedExclusions,
    },
  });
};
