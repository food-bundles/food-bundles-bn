import prisma from "../prisma";

// Interface for adding items to cart
interface AddToCartData {
  restaurantId: string;
  productId: string;
  quantity: number;
}

// Interface for updating cart item
interface UpdateCartItemData {
  quantity: number;
}

/**
 * Service to add item to cart or update existing item
 * If product already exists in cart, update the quantity
 */
export const addToCartService = async (data: AddToCartData) => {
  const { restaurantId, productId, quantity } = data;

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Validate product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  if (product.status !== "ACTIVE") {
    throw new Error("Product is not available");
  }

  // Check if product has sufficient quantity
  if (product.quantity < quantity) {
    throw new Error(`Insufficient stock. Available: ${product.quantity}`);
  }

  // Find or create the single active cart for this restaurant
  let cart = await prisma.cart.findFirst({
    where: {
      restaurantId,
      status: "ACTIVE",
    },
  });

  if (!cart) {
    // Create new cart if none exists
    cart = await prisma.cart.create({
      data: {
        restaurantId,
        status: "ACTIVE",
      },
    });
  }

  // Check if item already exists in cart
  const existingCartItem = await prisma.cartItem.findUnique({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
  });

  const subtotal = quantity * product.unitPrice;

  let cartItem;
  if (existingCartItem) {
    // Update existing cart item
    const newQuantity = existingCartItem.quantity + quantity;

    // Check total quantity doesn't exceed available stock
    if (product.quantity < newQuantity) {
      throw new Error(
        `Insufficient stock for total quantity. Available: ${product.quantity}`
      );
    }

    cartItem = await prisma.cartItem.update({
      where: { id: existingCartItem.id },
      data: {
        quantity: newQuantity,
        subtotal: newQuantity * product.unitPrice,
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            unitPrice: true,
            images: true,
            unit: true,
          },
        },
      },
    });
  } else {
    // Create new cart item
    cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        unitPrice: product.unitPrice,
        subtotal,
      },
      include: {
        product: {
          select: {
            id: true,
            productName: true,
            unitPrice: true,
            images: true,
            unit: true,
          },
        },
      },
    });
  }

  // Update cart total amount
  await updateCartTotalService(cart.id);

  const totalItems = await prisma.cartItem.count({
    where: { cartId: cart.id },
  });

  const cartItemWithTotalItems = {
    ...cartItem,
    totalItems,
  };

  return cartItemWithTotalItems;
};

/**
 * Service to get cart by restaurant ID
 */
export const getCartByRestaurantIdService = async (restaurantId: string) => {
  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Get active cart with items
  const cart = await prisma.cart.findFirst({
    where: {
      restaurantId,
      status: "ACTIVE",
    },
    include: {
      cartItems: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              unitPrice: true,
              images: true,
              unit: true,
              category: true,
              status: true,
              quantity: true, // Available stock
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!cart) {
    return null;
  }
  const totalItems = cart.cartItems.length;
  const totalQuantity = cart.cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartWithStats = {
    totalItems,
    totalQuantity,
    ...cart,
  };

  return cartWithStats;
};

/**
 * Service to get cart by cart ID
 */
export const getCartByIdService = async (cartId: string) => {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      cartItems: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              unitPrice: true,
              images: true,
              unit: true,
              category: true,
              status: true,
              quantity: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!cart) {
    throw new Error("Cart not found");
  }

  return cart;
};

/**
 * Service to update cart item quantity
 */
export const updateCartItemService = async (
  cartItemId: string,
  data: UpdateCartItemData,
  restaurantId: string
) => {
  const { quantity } = data;

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  // Find cart item and verify ownership
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: true,
      product: true,
    },
  });

  if (!cartItem) {
    throw new Error("Cart item not found");
  }

  if (cartItem.cart.restaurantId !== restaurantId) {
    throw new Error(
      "Unauthorized: Cart item does not belong to this restaurant"
    );
  }

  // Check product availability
  if (cartItem.product.quantity < quantity) {
    throw new Error(
      `Insufficient stock. Available: ${cartItem.product.quantity}`
    );
  }

  // Update cart item
  const updatedCartItem = await prisma.cartItem.update({
    where: { id: cartItemId },
    data: {
      quantity,
      subtotal: quantity * cartItem.unitPrice,
    },
    include: {
      product: {
        select: {
          id: true,
          productName: true,
          unitPrice: true,
          images: true,
          unit: true,
        },
      },
    },
  });

  // Update cart total
  await updateCartTotalService(cartItem.cartId);

  return updatedCartItem;
};

/**
 * Service to remove item from cart
 */
export const removeCartItemService = async (
  cartItemId: string,
  restaurantId: string
) => {
  // Find cart item and verify ownership
  const cartItem = await prisma.cartItem.findUnique({
    where: { id: cartItemId },
    include: {
      cart: {
        include: {
          cartItems: true,
        },
      },
    },
  });

  if (!cartItem) {
    throw new Error("Cart item not found");
  }

  if (cartItem.cart.restaurantId !== restaurantId) {
    throw new Error(
      "Unauthorized: Cart item does not belong to this restaurant"
    );
  }

  // Delete cart item
  await prisma.cartItem.delete({
    where: { id: cartItemId },
  });

  // Update cart total
  await updateCartTotalService(cartItem.cartId);

  return { message: "Item removed from cart successfully" };
};

/**
 * Service to clear entire cart
 */
export const clearCartService = async (restaurantId: string) => {
  // Find active cart
  const cart = await prisma.cart.findFirst({
    where: {
      restaurantId,
      status: "ACTIVE",
    },
  });

  if (!cart) {
    throw new Error("No active cart found");
  }

  // Use transaction to ensure complete cleanup
  await prisma.$transaction(async (tx) => {
    // Recursively delete all cart items first
    await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // Update cart total to 0 and keep active for future use
    await tx.cart.update({
      where: { id: cart.id },
      data: { totalAmount: 0, status: "ACTIVE" },
    });
  });

  return { message: "Cart cleared successfully" };
};

/**
 * Service to get all carts (Admin only)
 */
export const getAllCartsService = async ({
  page = 1,
  limit = 10,
  status,
}: {
  page?: number;
  limit?: number;
  status?: string;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const [carts, total] = await Promise.all([
    prisma.cart.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        cartItems: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
              },
            },
          },
        },
        _count: {
          select: {
            cartItems: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.cart.count({ where }),
  ]);

  return {
    carts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Helper service to update cart total amount
 */
export const updateCartTotalService = async (cartId: string) => {
  // Calculate total from all cart items
  const cartItemsTotal = await prisma.cartItem.aggregate({
    where: { cartId },
    _sum: {
      subtotal: true,
    },
  });

  const totalAmount = cartItemsTotal._sum.subtotal || 0;

  // Update cart total
  await prisma.cart.update({
    where: { id: cartId },
    data: { totalAmount },
  });

  return totalAmount;
};
