import {
  getWalletByRestaurantIdService,
  topUpWalletService,
  getRestaurantWalletTransactionService,
  verifyWalletTopUpService,
} from "../../wallet.service";
import { getRestaurantWalletTransfersService } from "../../wallet-transfer.service";

export const mobileGetWallet = (restaurantId: string) =>
  getWalletByRestaurantIdService(restaurantId);

export const mobileTopUpWallet = (data: any) => topUpWalletService(data);

export const mobileGetWalletTransactions = (restaurantId: string, filters: any) =>
  getRestaurantWalletTransactionService(restaurantId, filters);

export const mobileVerifyTopUp = (transactionId: string) =>
  verifyWalletTopUpService(transactionId);

export const mobileGetVoucherTransfers = (restaurantId: string) =>
  getRestaurantWalletTransfersService(restaurantId);
