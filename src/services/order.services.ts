import prisma from "../prisma";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { ProductData } from "./productService";
import { processPaymentService } from "./checkout.services";
import { decryptSecretData, encryptSecretData } from "../utils/password";

// Interface for creating an order from cart
interface CreateOrderFromCartData {
  cartId: string;
  restaurantId: string;
  status: OrderStatus;
  notes?: string;
  clientIp?: string;
  requestedDelivery?: Date;
  paymentMethod?: PaymentMethod;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  cardDetails?: {
    cardNumber: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    pin?: string;
  };
}

interface CreateDirectOrderData {
  restaurantId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod?: PaymentMethod;
  notes?: string;
  requestedDelivery?: Date;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
}

export interface UpdateOrderData {
  status?: OrderStatus;
  notes?: string;
  requestedDelivery?: Date;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  txRef?: string;
  flwRef?: string;
  transactionId?: string;
  flwStatus?: string;
  chargedAmount?: number;
  appFee?: number;
  merchantFee?: number;

  processorResponse?: string;
}

interface validatedItemsData {
  productId: string;
  quantity: number;
  unitPrice: number;
  product: ProductData;
}

/**
 * Service to create order directly from cart
 */
export const createOrderFromCartService = async (
  data: CreateOrderFromCartData
) => {
  const {
    cartId,
    restaurantId,
    notes,
    clientIp,
    requestedDelivery,
    paymentMethod,
    billingName,
    billingEmail,
    billingPhone,
    billingAddress,
    cardDetails,
  } = data;

  // Get cart and validate
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      cartItems: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
      restaurant: true,
    },
  });

  console.log("Cart retrieved", cart);

  if (!cart) {
    throw new Error("Cart not found");
  }

  if (cart.restaurantId !== restaurantId) {
    throw new Error("Unauthorized: Cart does not belong to this restaurant");
  }

  if (cart.status !== "ACTIVE") {
    throw new Error("Cart is not active");
  }

  if (cart.cartItems.length === 0) {
    throw new Error("Cart is empty");
  }

  // Check if order already exists for this cart
  const existingOrder = await prisma.order.findFirst({
    where: { cartId },
  });

  if (existingOrder) {
    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    if (requestedDelivery !== undefined)
      updateData.requestedDelivery = requestedDelivery;
    if (data.status !== undefined) updateData.status = data.status;
    if (billingName !== undefined) updateData.billingName = billingName;
    if (billingEmail !== undefined) updateData.billingEmail = billingEmail;
    if (billingPhone !== undefined) updateData.billingPhone = billingPhone;
    if (billingAddress !== undefined)
      updateData.billingAddress = billingAddress;

    if (cart.totalAmount !== existingOrder.totalAmount) {
      updateData.totalAmount = cart.totalAmount;
    }

    if (Object.keys(updateData).length > 0) {
      const updatedOrder = await prisma.order.update({
        where: { id: existingOrder.id },
        data: updateData,
      });

      return await getOrderByIdService(updatedOrder.id);
    }

    return await getOrderByIdService(existingOrder.id);
  }

  // Generate unique order number
  const orderNumber = await generateOrderNumber();

  // Generate transaction reference
  const txRef = `${restaurantId}_${cartId}_${Date.now()}`;
  const txOrderId = `ORDER_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Create order with extended transaction timeout and optimized operations
  const order = await prisma.$transaction(
    async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          cartId,
          restaurantId,
          totalAmount: cart.totalAmount,
          status: data.status || "PENDING",
          paymentMethod: paymentMethod || "CASH",
          paymentStatus: PaymentStatus.PENDING,
          notes: notes,
          requestedDelivery: requestedDelivery,
          billingName: billingName || cart.restaurant.name,
          billingEmail: billingEmail || cart.restaurant.email,
          billingPhone: billingPhone || cart.restaurant.phone,
          billingAddress: billingAddress || cart.restaurant.location,

          cardNumber: cardDetails?.cardNumber
            ? encryptSecretData(cardDetails.cardNumber)
            : null,
          cardCVV: cardDetails?.cvv ? encryptSecretData(cardDetails.cvv) : null,
          cardExpiryMonth: cardDetails?.expiryMonth
            ? encryptSecretData(cardDetails.expiryMonth)
            : null,
          cardExpiryYear: cardDetails?.expiryYear
            ? encryptSecretData(cardDetails.expiryYear)
            : null,
          cardPIN: cardDetails?.pin ? encryptSecretData(cardDetails.pin) : null,
          clientIp,
          txRef,
          txOrderId,
          currency: "RWF",
        },
      });

      // Prepare order items data
      const orderItemsData = cart.cartItems.map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        productName: item.product.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        unit: item.product.unit,
        images: item.product.images,
        category: item.product.category?.name || null,
      }));

      // Batch create order items
      await tx.orderItem.createMany({
        data: orderItemsData,
      });

      // Batch update product quantities
      const productUpdates = cart.cartItems.map((item) =>
        tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: item.quantity,
            },
          },
        })
      );

      // Execute all product updates in parallel
      await Promise.all(productUpdates);

      return newOrder;
    },
    {
      timeout: 15000,
    }
  );

  // Return complete order with relations
  return await getOrderByIdService(order.id);
};

/**
 * Service to create direct order
 */
export const createDirectOrderService = async (data: CreateDirectOrderData) => {
  const {
    restaurantId,
    items,
    paymentMethod,
    notes,
    requestedDelivery,
    billingName,
    billingEmail,
    billingPhone,
    billingAddress,
  } = data;

  if (!items || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Validate products and calculate total
  let totalAmount = 0;
  const validatedItems: validatedItemsData[] = [];

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new Error(`Product with ID ${item.productId} not found`);
    }

    if (product.status !== "ACTIVE") {
      throw new Error(`Product ${product.productName} is not available`);
    }

    if (product.quantity < item.quantity) {
      throw new Error(
        `Insufficient stock for ${product.productName}. Available: ${product.quantity}, Required: ${item.quantity}`
      );
    }

    const subtotal = product.unitPrice * item.quantity;
    totalAmount += subtotal;

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.unitPrice,
      product,
    });
  }

  // Generate order number and transaction references
  const orderNumber = await generateOrderNumber();
  const txRef = `${restaurantId}_DIRECT_${Date.now()}`;
  const txOrderId = `ORDER_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Create order with transaction
  const order = await prisma.$transaction(async (tx) => {
    // Create order
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        restaurantId,
        totalAmount,
        status: "PENDING",
        paymentMethod: paymentMethod || "CASH",
        paymentStatus: "PENDING",
        notes,
        requestedDelivery,
        billingName,
        billingEmail,
        billingPhone,
        billingAddress,
        txRef,
        txOrderId,
        currency: "RWF",
      },
    });

    // Create order items
    const orderItemsData = validatedItems.map((item) => ({
      orderId: newOrder.id,
      productId: item.productId,
      productName: item.product.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
      unit: item.product.unit,
      images: item.product.images,
      category: item.product.category?.name || null,
    }));

    await tx.orderItem.createMany({
      data: orderItemsData,
    });

    // Update product quantities
    for (const item of validatedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          quantity: {
            decrement: item.quantity,
          },
        },
      });
    }

    return newOrder;
  });

  return await getOrderByIdService(order.id);
};

/**
 * Enhanced service to get order by ID
 */
export const getOrderByIdService = async (
  orderId: string,
  restaurantId?: string
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      orderItems: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              unitPrice: true,
              unit: true,
              images: true,
              category: true,
              status: true,
            },
          },
        },
      },
      cart: {
        include: {
          cartItems: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // Check restaurant ownership if restaurantId provided
  if (restaurantId && order.restaurantId !== restaurantId) {
    throw new Error("Unauthorized: Order does not belong to this restaurant");
  }

  return order;
};

/**
 * Service to get all orders with filtering and pagination
 */
export const getAllOrdersService = async ({
  page = 1,
  limit = 10,
  status,
  paymentStatus,
  restaurantId,
  dateFrom,
  dateTo,
}: {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  restaurantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) => {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (restaurantId) where.restaurantId = restaurantId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
                unit: true,
              },
            },
          },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Service to get restaurant's orders
 */
export const getRestaurantOrdersService = async (
  restaurantId: string,
  filters: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }
) => {
  return getAllOrdersService({
    ...filters,
    restaurantId,
  });
};

/**
 * Service to update order
 */
export const updateOrderService = async (
  orderId: string,
  data: UpdateOrderData,
  restaurantId?: string
) => {
  // Get existing order to validate
  const existingOrder = await getOrderByIdService(orderId, restaurantId);

  // Validate status transitions
  if (data.status) {
    validateStatusTransition(existingOrder.status, data.status);
  }

  // Set actual delivery date when status changes to DELIVERED
  const updateData = { ...data };
  if (data.status === "DELIVERED" && !existingOrder.actualDelivery) {
    updateData.actualDelivery = new Date();
  }

  // Update order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...updateData,
      updatedAt: new Date(),
    },
  });

  // Return complete order details
  return await getOrderByIdService(updatedOrder.id);
};

/**
 * Service to cancel order
 * Restores product quantities and updates status
 */
export const cancelOrderService = async (
  orderId: string,
  restaurantId?: string,
  reason?: string
) => {
  const order = await getOrderByIdService(orderId, restaurantId);

  // Check if order can be cancelled
  if (["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status)) {
    throw new Error(`Cannot cancel order with status: ${order.status}`);
  }

  // Restore product quantities and cancel order
  await prisma.$transaction(async (tx) => {
    // Restore product quantities
    for (const item of order.orderItems) {
      await tx.product.update({
        where: { id: item.productId! },
        data: {
          quantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        notes: reason
          ? `${order.notes ? order.notes + " | " : ""}CANCELLED: ${reason}`
          : order.notes,
        updatedAt: new Date(),
      },
    });
  });

  return { message: "Order cancelled successfully" };
};

/**
 * Service to re-order from an existing order
 * Creates a new checkout from any existing order (successful or failed)
 */
export const reOrderFromExistingOrderService = async (
  orderId: string,
  restaurantId: string
) => {
  console.log(
    "Re-ordering from order ID:",
    orderId,
    "for restaurant ID:",
    restaurantId
  );
  // Get the existing order
  const existingOrder = await getOrderByIdService(orderId, restaurantId);

  console.log("Existing order:", existingOrder);

  if (!existingOrder) {
    throw new Error("Order not found");
  }

  // Verify the order belongs to the restaurant (unless admin)
  if (existingOrder.restaurantId !== restaurantId) {
    throw new Error("Unauthorized: Order does not belong to this restaurant");
  }

  // Check if order has items
  if (!existingOrder.orderItems || existingOrder.orderItems.length === 0) {
    throw new Error("Order has no items to re-order");
  }

  // Validate restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Find or create active cart for the restaurant
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

  // Validate products availability and prepare cart items
  const validatedItems: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: any;
  }> = [];

  let totalAmount = 0;
  const unavailableProducts: string[] = [];
  const insufficientStockProducts: Array<{
    name: string;
    available: number;
    required: number;
  }> = [];

  for (const orderItem of existingOrder.orderItems) {
    // Skip if no productId
    if (!orderItem.productId) {
      unavailableProducts.push(orderItem.productName);
      continue;
    }

    // Check if product still exists and is active
    const product = await prisma.product.findUnique({
      where: { id: orderItem.productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      unavailableProducts.push(orderItem.productName);
      continue;
    }

    if (product.status !== "ACTIVE") {
      unavailableProducts.push(orderItem.productName);
      continue;
    }

    // Check if product has sufficient quantity
    if (product.quantity < orderItem.quantity) {
      insufficientStockProducts.push({
        name: product.productName,
        available: product.quantity,
        required: orderItem.quantity,
      });
      continue;
    }

    const subtotal = orderItem.quantity * product.unitPrice;
    totalAmount += subtotal;

    validatedItems.push({
      productId: orderItem.productId,
      quantity: orderItem.quantity,
      unitPrice: product.unitPrice,
      subtotal,
      product,
    });
  }

  // Check if we have any valid items
  if (validatedItems.length === 0) {
    throw new Error(
      "None of the products from this order are currently available"
    );
  }

  // Provide warnings about unavailable items
  const warnings: string[] = [];
  if (unavailableProducts.length > 0) {
    warnings.push(
      `The following products are no longer available: ${unavailableProducts.join(
        ", "
      )}`
    );
  }
  if (insufficientStockProducts.length > 0) {
    const stockWarnings = insufficientStockProducts.map(
      (p) => `${p.name} (Available: ${p.available}, Required: ${p.required})`
    );
    warnings.push(`Insufficient stock for: ${stockWarnings.join(", ")}`);
  }

  // Add items to cart using transaction
  const cartItems = await prisma.$transaction(async (tx) => {
    const items = [];

    for (const item of validatedItems) {
      // Check if item already exists in cart
      const existingCartItem = await tx.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart!.id,
            productId: item.productId,
          },
        },
      });

      if (existingCartItem) {
        // Update existing cart item
        const newQuantity = existingCartItem.quantity + item.quantity;

        // Check total quantity doesn't exceed available stock
        if (item.product.quantity < newQuantity) {
          throw new Error(
            `Insufficient stock for total quantity of ${item.product.productName}. Available: ${item.product.quantity}`
          );
        }

        const updatedItem = await tx.cartItem.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: newQuantity,
            subtotal: newQuantity * item.unitPrice,
          },
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
                images: true,
                unit: true,
                category: true,
              },
            },
          },
        });
        items.push(updatedItem);
      } else {
        // Create new cart item
        const newItem = await tx.cartItem.create({
          data: {
            cartId: cart!.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          },
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
                images: true,
                unit: true,
                category: true,
              },
            },
          },
        });
        items.push(newItem);
      }
    }

    // Update cart total amount
    const cartItemsTotal = await tx.cartItem.aggregate({
      where: { cartId: cart!.id },
      _sum: {
        subtotal: true,
      },
    });

    const cartTotalAmount = cartItemsTotal._sum.subtotal || 0;

    await tx.cart.update({
      where: { id: cart!.id },
      data: { totalAmount: cartTotalAmount },
    });

    return items;
  });

  // Get updated cart with all details
  const updatedCart = await prisma.cart.findUnique({
    where: { id: cart.id },
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

  const orderData = {
    cartId: cart.id,
    restaurantId: restaurantId,
    status: OrderStatus.PENDING,
    notes: existingOrder.notes!,
    requestedDelivery: existingOrder.requestedDelivery!,
    paymentMethod: existingOrder.paymentMethod!,
    billingName: existingOrder.billingName!,
    billingEmail: existingOrder.billingEmail!,
    billingPhone: existingOrder.billingPhone!,
    billingAddress: existingOrder.billingAddress!,

    cardDetails: {
      cardNumber: existingOrder.cardNumber
        ? decryptSecretData(existingOrder.cardNumber)
        : "",
      cvv: existingOrder.cardCVV
        ? decryptSecretData(existingOrder.cardCVV)
        : "",
      expiryMonth: existingOrder.cardExpiryMonth
        ? decryptSecretData(existingOrder.cardExpiryMonth)
        : "",
      expiryYear: existingOrder.cardExpiryYear
        ? decryptSecretData(existingOrder.cardExpiryYear)
        : "",
      pin: existingOrder.cardPIN
        ? decryptSecretData(existingOrder.cardPIN)
        : "",
    },
    clientIp: existingOrder.clientIp || "",
  };

  const orderCreated = await createOrderFromCartService(orderData);

  // Process immediate payment
  const paymentResult = await processPaymentService(orderCreated.id!, {
    paymentMethod: existingOrder.paymentMethod!,
    phoneNumber: existingOrder.billingPhone!,
    cardDetails: {
      cardNumber: existingOrder.cardNumber
        ? decryptSecretData(existingOrder.cardNumber)
        : "",
      cvv: existingOrder.cardCVV
        ? decryptSecretData(existingOrder.cardCVV)
        : "",
      expiryMonth: existingOrder.cardExpiryMonth
        ? decryptSecretData(existingOrder.cardExpiryMonth)
        : "",
      expiryYear: existingOrder.cardExpiryYear
        ? decryptSecretData(existingOrder.cardExpiryYear)
        : "",
      pin: existingOrder.cardPIN
        ? decryptSecretData(existingOrder.cardPIN)
        : "",
    },
    bankDetails: {
      clientIp: existingOrder.clientIp || "",
    },
    processDirectly: true,
  });

  console.log("Payment Result:", paymentResult);

  return paymentResult;
};

/**
 * Service to delete order (Admin only)
 * Should be used carefully as it removes order history
 */
export const deleteOrderService = async (orderId: string) => {
  const order = await getOrderByIdService(orderId);

  // Only allow deletion of CANCELLED orders
  if (order.status !== "CANCELLED") {
    throw new Error("Only cancelled orders can be deleted");
  }

  // Delete order and related items
  await prisma.$transaction([
    prisma.orderItem.deleteMany({
      where: { orderId },
    }),
    prisma.order.delete({
      where: { id: orderId },
    }),
  ]);

  return { message: "Order deleted successfully" };
};

/**
 * Helper function to generate unique order number
 */
export async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  // Get today's order count
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const todayOrderCount = await prisma.order.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const orderSequence = (todayOrderCount + 1).toString().padStart(4, "0");
  return `ORD${year}${month}${day}${orderSequence}`;
}

/**
 * Helper function to validate order status transitions
 */
function validateStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
) {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["IN_TRANSIT", "DELIVERED", "CANCELLED"],
    IN_TRANSIT: ["DELIVERED", "CANCELLED"],
    DELIVERED: ["REFUNDED"], // Only admin can refund
    CANCELLED: [], // Cannot change from cancelled
    REFUNDED: [], // Cannot change from refunded
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }
}

/**
 * Service to get order statistics (Admin)
 */
export const getOrderStatisticsService = async ({
  restaurantId,
  dateFrom,
  dateTo,
}: {
  restaurantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
} = {}) => {
  const where: any = {};
  if (restaurantId) where.restaurantId = restaurantId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  const [
    totalOrders,
    pendingOrders,
    confirmedOrders,
    preparingOrders,
    readyOrders,
    inTransitOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue,
    averageOrderValue,
  ] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: "PENDING" } }),
    prisma.order.count({ where: { ...where, status: "CONFIRMED" } }),
    prisma.order.count({ where: { ...where, status: "PREPARING" } }),
    prisma.order.count({ where: { ...where, status: "READY" } }),
    prisma.order.count({ where: { ...where, status: "IN_TRANSIT" } }),
    prisma.order.count({ where: { ...where, status: "DELIVERED" } }),
    prisma.order.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.order.aggregate({
      where: { ...where, status: "DELIVERED" },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { ...where, status: "DELIVERED" },
      _avg: { totalAmount: true },
    }),
  ]);

  return {
    totalOrders,
    ordersByStatus: {
      pending: pendingOrders,
      confirmed: confirmedOrders,
      preparing: preparingOrders,
      ready: readyOrders,
      inTransit: inTransitOrders,
      delivered: deliveredOrders,
      cancelled: cancelledOrders,
    },
    revenue: {
      total: totalRevenue._sum.totalAmount || 0,
      average: averageOrderValue._avg.totalAmount || 0,
    },
  };
};
