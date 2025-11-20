import prisma from "../prisma";
import { DeliveryStatus, OrderStatus, PaymentStatus } from "@prisma/client";
import { sendMessage } from "../utils/sms.utility";
import { createNotificationService } from "./notification.services";

export class DeliveryService {
  /**
   * Generate OTP for order delivery
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create delivery OTP for an order
   */
  static async createDeliveryOTP(
    orderId: string
  ): Promise<{ success: boolean; message: string; otp?: string }> {
    try {
      // Validate order exists and is eligible for delivery
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          restaurant: true,
        },
      });

      if (!order) {
        return { success: false, message: "Order not found" };
      }

      // Generate OTP
      const otp = this.generateOTP();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create or update delivery OTP
      await prisma.deliveryOTP.upsert({
        where: { orderId },
        update: {
          otp,
          expiresAt,
          attempts: 0,
          isUsed: false,
          updatedAt: new Date(),
        },
        create: {
          orderId,
          otp,
          expiresAt,
        },
      });

      // Send OTP to restaurant
      await sendMessage(
        `Your delivery OTP for order ${order.orderNumber} is: ${otp}. Valid for 24 hours.`,
        order.restaurant.phone || ""
      );

      return {
        success: true,
        message: "Delivery OTP sent successfully",
        otp, // Only returned for testing/debugging, not sent to client
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Resend delivery OTP
   */
  static async resendDeliveryOTP(
    orderId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.createDeliveryOTP(orderId);
      return result;
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Verify delivery OTP
   */
  static async verifyDeliveryOTP(
    orderId: string,
    otp: string,
    logisticsId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find delivery OTP
      const deliveryOTP = await prisma.deliveryOTP.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              restaurant: true,
            },
          },
        },
      });

      if (!deliveryOTP) {
        return {
          success: false,
          message: "Delivery OTP not found for this order",
        };
      }

      if (deliveryOTP.isUsed) {
        return { success: false, message: "OTP has already been used" };
      }

      if (deliveryOTP.expiresAt < new Date()) {
        return { success: false, message: "OTP has expired" };
      }

      if (deliveryOTP.attempts >= 3) {
        return {
          success: false,
          message: "Too many failed attempts. Please request a new OTP.",
        };
      }

      // Verify OTP
      if (deliveryOTP.otp !== otp) {
        // Increment attempts
        await prisma.deliveryOTP.update({
          where: { orderId },
          data: {
            attempts: { increment: 1 },
          },
        });

        const remainingAttempts = 3 - (deliveryOTP.attempts + 1);
        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
        };
      }

      // Mark OTP as used and update delivery status
      await prisma.$transaction(async (tx) => {
        // Mark OTP as used
        await tx.deliveryOTP.update({
          where: { orderId },
          data: {
            isUsed: true,
            updatedAt: new Date(),
          },
        });

        // Update order status to DELIVERED
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.DELIVERED,
            actualDelivery: new Date(),
            updatedAt: new Date(),
          },
        });

        // Create or update delivery record
        await tx.orderDelivery.upsert({
          where: { orderId },
          update: {
            status: DeliveryStatus.DELIVERED,
            otpVerified: true,
            deliveryDate: new Date(),
            updatedAt: new Date(),
          },
          create: {
            orderId,
            logisticsId,
            status: DeliveryStatus.DELIVERED,
            otpVerified: true,
            deliveryDate: new Date(),
          },
        });
      });

      // Send confirmation to restaurant
      await createNotificationService({
        title: "Order Delivered",
        message: `Order #${deliveryOTP.order.orderNumber} has been successfully delivered`,
        eventType: "ORDER_DELIVERED",
        targetType: "SPECIFIC_USER",
        targetId: deliveryOTP.order.restaurant.id,
        metadata: {
          orderId: deliveryOTP.order.id,
          orderNumber: deliveryOTP.order.orderNumber,
          deliveredAt: new Date().toISOString(),
        },
      });

      return {
        success: true,
        message: "OTP verified successfully. Order marked as delivered.",
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get orders available for logistics (CONFIRMED with COMPLETED payment)
   */
  static async getLogisticsOrders({
    page = 1,
    limit = 10,
    status,
    logisticsId,
  }: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    logisticsId?: string;
  } = {}) {
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        {
          AND: [
            { status: status || OrderStatus.CONFIRMED },
            { paymentStatus: PaymentStatus.COMPLETED },
          ],
        },
        ...(logisticsId
          ? [
              {
                logisticsId: logisticsId,
              },
            ]
          : []),
      ],
    };

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
              location: true,
              province: true,
              district: true,
              sector: true,
              cell: true,
              village: true,
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
                },
              },
            },
          },
          OrderDelivery: {
            include: {
              logistics: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  phone: true,
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
  }

  /**
   * Update order delivery status (for logistics)
   */
  static async updateDeliveryStatus(
    orderId: string,
    status: DeliveryStatus,
    logisticsId: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate order exists and is eligible
      const order = await prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        return { success: false, message: "Order not found" };
      }

      if (order.paymentStatus !== PaymentStatus.COMPLETED) {
        return { success: false, message: "Order payment is not completed" };
      }

      // Map DeliveryStatus to OrderStatus
      let orderStatus: OrderStatus;
      switch (status) {
        case DeliveryStatus.PREPARING:
          orderStatus = OrderStatus.PREPARING;
          break;
        case DeliveryStatus.READY:
          orderStatus = OrderStatus.READY;
          break;
        case DeliveryStatus.IN_TRANSIT:
          orderStatus = OrderStatus.IN_TRANSIT;
          break;
        case DeliveryStatus.DELIVERED:
          orderStatus = OrderStatus.DELIVERED;
          break;
        case DeliveryStatus.CANCELLED:
          orderStatus = OrderStatus.CANCELLED;
          break;
        default:
          orderStatus = OrderStatus.CONFIRMED;
      }

      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: orderStatus,
            updatedAt: new Date(),
            logisticsId: logisticsId,
          },
        });

        // Create or update delivery record
        await tx.orderDelivery.upsert({
          where: { orderId },
          update: {
            status,
            logisticsId,
            notes,
            updatedAt: new Date(),
          },
          create: {
            orderId,
            logisticsId,
            status,
            notes,
          },
        });

        // If status is DELIVERED, send delivery OTP
        if (status === DeliveryStatus.DELIVERED) {
          const result = await DeliveryService.createDeliveryOTP(orderId);

          if (!result.success) {
            return {
              success: false,
              message: result.message,
            };
          }

          return {
            success: true,
            message: "Delivery OTP created successfully",
          };
        }
      });

      return {
        success: true,
        message: `Order status updated to ${status.toLowerCase()} successfully`,
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get delivery details for an order
   */
  static async getOrderDeliveryDetails(orderId: string) {
    const delivery = await prisma.orderDelivery.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                location: true,
                province: true,
                district: true,
                sector: true,
                cell: true,
                village: true,
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
                  },
                },
              },
            },
          },
        },
        logistics: {
          select: {
            id: true,
            username: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new Error("Delivery details not found for this order");
    }

    return delivery;
  }

  /**
   * Get delivery OTP status for an order
   */
  static async getDeliveryOTPStatus(orderId: string) {
    const deliveryOTP = await prisma.deliveryOTP.findUnique({
      where: { orderId },
      select: {
        id: true,
        expiresAt: true,
        attempts: true,
        isUsed: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!deliveryOTP) {
      throw new Error("Delivery OTP not found for this order");
    }

    return deliveryOTP;
  }
}
