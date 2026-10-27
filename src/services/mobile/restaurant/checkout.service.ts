import {
  createCheckoutService,
  createAdminOrderService,
} from "../../checkout.services";
import { validateVoucherForCheckoutService } from "../../voucher.service";
import {
  validateLoanSessionForCheckoutService,
  getUsableLoanSessionsForRestaurantService,
} from "../../voucher-card.service";
import { OTPService } from "../../otp.service";
import { getPaymentMethodByIdService } from "../../payment-method.service";
import { getRestaurantFromAffiliatorService } from "../../affiliator.service";
import prisma from "../../../prisma";

export const mobileResolveRestaurantId = async (userId: string, userRole: string) => {
  if (userRole === "AFFILIATOR") {
    const restaurant = await getRestaurantFromAffiliatorService(userId);
    return { restaurantId: restaurant.id, affiliatorId: userId };
  }
  return { restaurantId: userId, affiliatorId: undefined };
};

export const mobileInitiateCheckout = async (body: any, userId: string, userRole: string) => {
  const { restaurantId, affiliatorId } = await mobileResolveRestaurantId(userId, userRole);
  const { cartId, paymentMethodId } = body;

  if (!cartId || !paymentMethodId) throw new Error("Cart ID and payment method ID are required");

  const pmConfig = await getPaymentMethodByIdService(paymentMethodId);
  const pmName = pmConfig.name.toUpperCase();

  if (pmName === "VOUCHER") {
    const { voucherCode, loanSessionRrn, promoCode, verificationType } = body;
    if (!voucherCode && !loanSessionRrn) throw new Error("Voucher code or loan session RRN is required");

    const cart = await prisma.cart.findUnique({ where: { id: cartId }, include: { cartItems: true } });
    if (!cart) throw new Error("Cart not found");
    const cartTotal = cart.cartItems.reduce((s, i) => s + i.subtotal, 0);

    if (loanSessionRrn) {
      const v = await validateLoanSessionForCheckoutService(loanSessionRrn, cartTotal, restaurantId);
      if (!v.valid) throw new Error(v.error);
    } else {
      const v = await validateVoucherForCheckoutService(voucherCode!, cartTotal, restaurantId, affiliatorId, promoCode);
      if (!v.valid) throw new Error(v.error);
    }

    const verifyType = verificationType || "OTP";
    let otpDelivery;
    if (verifyType === "OTP") {
      const otpResult = await OTPService.sendOTPToRestaurant(restaurantId);
      if (!otpResult.success) throw new Error(otpResult.message);
      otpDelivery = otpResult.channels;
    }

    const checkoutData = { ...body, restaurantId, affiliatorId, clientIp: undefined };
    return {
      requiresVerification: true,
      verificationType: verifyType,
      otpDelivery,
      checkoutSessionId: Buffer.from(JSON.stringify(checkoutData)).toString("base64"),
    };
  }

  return createCheckoutService({ ...body, restaurantId, affiliatorId });
};

export const mobileGetLoanSessions = (restaurantId: string) =>
  getUsableLoanSessionsForRestaurantService(restaurantId);

export { createAdminOrderService as mobileCreateAdminOrder };
