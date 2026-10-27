import {
  getWalletByRestaurantIdService,
  topUpWalletService,
  getRestaurantWalletTransactionService,
} from "../../wallet.service";

export const mobileGetWallet = (restaurantId: string) =>
  getWalletByRestaurantIdService(restaurantId);

export const mobileTopUpWallet = (data: any) => topUpWalletService(data);

export const mobileGetWalletTransactions = (restaurantId: string, filters: any) =>
  getRestaurantWalletTransactionService(restaurantId, filters);
