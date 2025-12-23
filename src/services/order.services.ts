import prisma from "../prisma";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { ProductData } from "./productService";
import { processPaymentService } from "./checkout.services";
import { decryptSecretData, encryptSecretData } from "../utils/password";
import { wsManager } from "../index";
import { createNotificationService } from "./notification.services";
import { applyPromoCodeService } from "./promo.service";

// Interface for creating an order from cart
interface CreateOrderFromCartData {
  cartId: string;
  restaurantId: string;
  status: OrderStatus;
  notes?: string;
  clientIp?: string;
  requestedDelivery?: Date;
  paymentMethod?: PaymentMethod;
  promoCode?: string;
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
  otherServices?: boolean;
  affiliatorId?: string;
}

interface CreateDirectOrderData {
  restaurantId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod?: PaymentMethod;
  promoCode?: string;
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
  logisticsId?: string;

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
    promoCode,
    billingName,
    billingEmail,
    billingPhone,
    billingAddress,
    cardDetails,
    otherServices,
    affiliatorId,
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

  // Validate product availability and quantities
  for (const cartItem of cart.cartItems) {
    const product = await prisma.product.findUnique({
      where: { id: cartItem.productId },
    });

    if (!product) {
      throw new Error(`Product ${cartItem.productId} not found`);
    }

    if (product.status !== "ACTIVE") {
      throw new Error(`Product ${product.productName} is not available`);
    }

    if (product.quantity < cartItem.quantity) {
      if (product.quantity <= 10) {
        await createNotificationService({
          title: "Low Stock Alert",
          message: `Product "${product.productName}" is running low (${product.quantity} ${product.unit} remaining)`,
          eventType: "LOW_STOCK_ALERT",
          targetType: "ROLE_BASED",
          targetRole: "ADMIN",
          metadata: {
            productId: product.id,
            productName: product.productName,
            currentQuantity: product.quantity,
            unit: product.unit,
          },
        });
      }

      throw new Error(
        `Insufficient stock for ${product.productName}. Available: ${product.quantity}, Required: ${cartItem.quantity}`
      );
    }
  }

  // Prepare cart items for promo code processing
  const items = cart.cartItems.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  }));

  // Apply promo code if provided
  let originalAmount = cart.totalAmount;
  let finalAmount = originalAmount;
  let promoDiscount = 0;
  let promoDetails = null;

  if (promoCode) {
    try {
      const promoResult = await applyPromoCodeService(
        promoCode,
        restaurantId,
        "temp_order_id", // Will be updated after order creation
        items
      );

      finalAmount = promoResult.finalAmount;
      promoDiscount = promoResult.discountAmount;
      promoDetails = {
        code: promoResult.promoCode.code,
        discountAmount: promoResult.discountAmount,
        discountPercentage: promoResult.discountPercentage,
      };
    } catch (error: any) {
      throw new Error(`Promo code error: ${error.message}`);
    }
  }

  // Generate unique order number
  const orderNumber = await generateOrderNumber();

  // Generate transaction reference with timestamp to ensure uniqueness
  const timestamp = Date.now();
  const txRef = `${restaurantId}_${cartId}_${timestamp}`;
  const txOrderId = `ORDER_${timestamp}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Create NEW order with extended transaction timeout and optimized operations
  const order = await prisma.$transaction(
    async (tx) => {
      // Create order with final amount after promo discount
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          cartId,
          restaurantId,
          orderedBy: affiliatorId,
          totalAmount: finalAmount, // Use discounted amount
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

      // Update promo code usage with actual order ID if promo was applied
      if (promoCode && promoDetails) {
        await applyPromoCodeService(
          promoCode,
          restaurantId,
          newOrder.id,
          items
        );
      }

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

      return { ...newOrder, promoDetails, originalAmount, promoDiscount };
    },
    {
      timeout: 15000,
    }
  );

  setTimeout(async () => {}, 1000); // Small delay to ensure order is fully created

  // Calculate delivery fee and packaging fee
  let deliveryFee = 0;
  let packagingFee = 0;

  // Check restaurant subscription plan
  const activeSubscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
      status: SubscriptionStatus.ACTIVE,
      endDate: {
        gte: new Date(),
      },
    },
    include: {
      plan: {
        select: {
          id: true,
          otherServices: true,
          freeDelivery: true,
        },
      },
    },
  });

  if (!activeSubscription?.plan?.freeDelivery) {
    // Time-based delivery fee: 0 between 4:00 AM to 9:00 AM, 5000 RWF otherwise
    const currentHour = new Date().getHours();
    const isOffPeakHours = currentHour >= 4 && currentHour < 9;

    if (!isOffPeakHours) {
      deliveryFee = 5000; // Outside 4:00 AM to 9:00 AM
    } else {
      deliveryFee = 0; // Inside 4:00 AM to 9:00 AM (free delivery)
    }
  }

  if (
    otherServices &&
    (!activeSubscription || !activeSubscription.plan.otherServices)
  ) {
    packagingFee = 15000;
  }

  // Add delivery fee and packaging fee to final amount (after promo discount)
  const totalAmount = order.totalAmount + deliveryFee + packagingFee;

  // Update order with delivery fee and packaging fee
  await prisma.order.update({
    where: { id: order.id },
    data: {
      totalAmount: totalAmount,
      deliveryFee,
      packagingFee,
    },
  });

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

    const subtotal =
      product.unitPrice * (1 - Number(product.bonus) / 100) * item.quantity;
    totalAmount += subtotal;

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: product.unitPrice * (1 - Number(product.bonus) / 100),
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

  // Broadcast WebSocket update for status or payment status changes
  if (data.status || data.paymentStatus) {
    try {
      wsManager.broadcastOrderUpdate({
        orderId: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus || undefined,
        timestamp: new Date().toISOString(),
        restaurantId: updatedOrder.restaurantId,
        data: {
          orderNumber: updatedOrder.orderNumber,
          totalAmount: updatedOrder.totalAmount,
          currency: updatedOrder.currency || "RWF",
          paymentMethod: updatedOrder.paymentMethod || undefined,
          transactionId: updatedOrder.txRef || undefined,
        },
      });
    } catch (error) {
      console.error("Failed to broadcast order update:", error);
    }
  }

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

  // Broadcast WebSocket update for order cancellation
  try {
    wsManager.broadcastOrderUpdate({
      orderId: order.id,
      status: "CANCELLED",
      timestamp: new Date().toISOString(),
      restaurantId: order.restaurantId,
      data: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        currency: order.currency || "RWF",
      },
    });
  } catch (error) {
    console.error("Failed to broadcast order cancellation:", error);
  }

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

  // Verify the order belongs to the restaurant
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

  // IMPROVED: Find or create active cart, then clear it to start fresh
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
        totalAmount: 0,
      },
    });
    console.log("Created new cart:", cart.id);
  } else {
    // Clear existing cart items to start fresh
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // Reset cart total
    await prisma.cart.update({
      where: { id: cart.id },
      data: { totalAmount: 0 },
    });
    console.log("Cleared existing cart:", cart.id);
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

    // FIXED: Use current product price, calculate fresh subtotal
    const subtotal =
      orderItem.quantity *
      (product.unitPrice * (1 - Number(product.bonus) / 100));
    totalAmount += subtotal;

    validatedItems.push({
      productId: orderItem.productId,
      quantity: orderItem.quantity,
      unitPrice: product.unitPrice * (1 - Number(product.bonus) / 100), // Use current price
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

  // Add items to the existing cart using transaction
  await prisma.$transaction(async (tx) => {
    // Create all cart items fresh
    for (const item of validatedItems) {
      await tx.cartItem.create({
        data: {
          cartId: cart!.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        },
      });
    }

    // Update cart total amount with the freshly calculated total
    await tx.cart.update({
      where: { id: cart!.id },
      data: { totalAmount: totalAmount },
    });
  });

  console.log(`Cart updated with total amount: ${totalAmount}`);

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

  // Prepare card details if they exist
  let cardDetailsDecrypted = undefined;
  if (existingOrder.cardNumber && existingOrder.cardCVV) {
    cardDetailsDecrypted = {
      cardNumber: decryptSecretData(existingOrder.cardNumber),
      cvv: decryptSecretData(existingOrder.cardCVV),
      expiryMonth: existingOrder.cardExpiryMonth
        ? decryptSecretData(existingOrder.cardExpiryMonth)
        : "",
      expiryYear: existingOrder.cardExpiryYear
        ? decryptSecretData(existingOrder.cardExpiryYear)
        : "",
      pin: existingOrder.cardPIN
        ? decryptSecretData(existingOrder.cardPIN)
        : "",
    };
  }

  // Create order data from existing cart (now cleared and updated)
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
    cardDetails: cardDetailsDecrypted,
    clientIp: existingOrder.clientIp || "",
  };

  // Create NEW order from the cleared and updated cart
  const orderCreated = await createOrderFromCartService(orderData);

  console.log(
    "New order created:",
    orderCreated.id,
    "Amount:",
    orderCreated.totalAmount
  );

  // Process payment
  const paymentResult = await processPaymentService(orderCreated.id!, {
    paymentMethod: existingOrder.paymentMethod!,
    phoneNumber: existingOrder.billingPhone!,
    cardDetails: cardDetailsDecrypted,
    bankDetails: {
      clientIp: existingOrder.clientIp || "",
    },
    processDirectly: true,
  });

  console.log("Payment Result:", paymentResult);

  // Include warnings in the response if any
  if (warnings.length > 0) {
    return {
      ...paymentResult,
      warnings,
    };
  }

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
  const datePrefix = `ORD${year}${month}${day}`;

  // Find the highest existing order number for today
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: datePrefix,
      },
    },
    orderBy: {
      orderNumber: "desc",
    },
  });

  let nextSequence = 1;
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.slice(-4));
    nextSequence = lastSequence + 1;
  }

  const orderSequence = nextSequence.toString().padStart(4, "0");
  return `${datePrefix}${orderSequence}`;
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
