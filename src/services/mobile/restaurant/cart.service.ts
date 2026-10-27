import {
  addToCartService,
  getCartByRestaurantIdService,
  updateCartItemService,
  removeCartItemService,
  clearCartService,
} from "../../cart.service";

export const mobileAddToCart = (params: { userId: string; userRole: string; productId: string; quantity: number }) =>
  addToCartService(params);

export const mobileGetMyCart = (userId: string, userRole: string) =>
  getCartByRestaurantIdService(userId, userRole);

export const mobileUpdateCartItem = (
  cartItemId: string,
  quantity: number,
  userId: string,
  userRole: string,
) => updateCartItemService(cartItemId, { quantity }, userId, userRole);

export const mobileRemoveCartItem = (cartItemId: string, userId: string, userRole: string) =>
  removeCartItemService(cartItemId, userId, userRole);

export const mobileClearCart = (userId: string, userRole: string) =>
  clearCartService(userId, userRole);
