import prisma from "../prisma";
import { getRestaurantFromAffiliatorService } from "./affiliator.service";

/** Restaurant the wishlist belongs to: the restaurant/hotel itself, or an affiliator's restaurant. */
export const resolveWishlistOwner = async (user: { id: string; role: string }) => {
  if (user.role === "AFFILIATOR") {
    const restaurant = await getRestaurantFromAffiliatorService(user.id);
    return restaurant.id as string;
  }
  return user.id;
};

// Same product fields the shop list uses, so saved products render identically
const PRODUCT_SELECT = {
  id: true,
  productName: true,
  unitPrice: true,
  category: true,
  bonus: true,
  quantity: true,
  images: true,
  unit: true,
  status: true,
  createdAt: true,
  customerTypePrices: {
    select: {
      id: true,
      price: true,
      customerType: { select: { id: true, name: true } },
    },
  },
} as const;

/** Saved products (newest first). Products no longer active are left out. */
export const getWishlistService = async (restaurantId: string) => {
  const items = await prisma.wishlistItem.findMany({
    where: { restaurantId, product: { status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, product: { select: PRODUCT_SELECT } },
  });
  return {
    productIds: items.map((item) => item.product.id),
    products: items.map((item) => ({ ...item.product, savedAt: item.createdAt })),
  };
};

/** Save a product. Saving one that is already saved is fine (no duplicate). */
export const addToWishlistService = async (restaurantId: string, productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, status: true },
  });
  if (!product || product.status !== "ACTIVE") {
    throw new Error("Product not found or not available");
  }
  await prisma.wishlistItem.upsert({
    where: { restaurantId_productId: { restaurantId, productId } },
    update: {},
    create: { restaurantId, productId },
  });
  return { productId, saved: true };
};

/** Remove a product. Removing one that is not saved is fine. */
export const removeFromWishlistService = async (restaurantId: string, productId: string) => {
  await prisma.wishlistItem.deleteMany({ where: { restaurantId, productId } });
  return { productId, saved: false };
};
