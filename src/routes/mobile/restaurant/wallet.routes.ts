import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileWalletGet,
  mobileWalletTopUp,
  mobileWalletTransactions,
  mobileVerifyTopUpController,
  mobileGetVoucherTransfersController,
} from "../../../controllers/mobile/restaurant/wallet.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET  /mobile/restaurant/wallets
router.get("/", ...guard, mobileWalletGet);

// POST /mobile/restaurant/wallets/top-up
router.post("/top-up", ...guard, mobileWalletTopUp);

// GET  /mobile/restaurant/wallets/transactions
router.get("/transactions", ...guard, mobileWalletTransactions);

// GET  /mobile/restaurant/wallets/verify-top-up/:txId
router.get("/verify-top-up/:txId", ...guard, mobileVerifyTopUpController);

// GET  /mobile/restaurant/wallets/my-transfers
router.get("/my-transfers", ...guard, mobileGetVoucherTransfersController);

export default router;
