import {
  calculateCartWithPromoService,
  getMyPromoCodesService,
} from "../../promo.service";

export const mobileCalculatePromo = (
  cartId: string,
  promoCode: string,
  restaurantId: string
) => calculateCartWithPromoService(cartId, promoCode, restaurantId);

export const mobileGetMyPromoCodes = (restaurantId: string) =>
  getMyPromoCodesService(restaurantId);
