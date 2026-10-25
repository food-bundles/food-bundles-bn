import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileWalletGet,
  mobileWalletTopUp,
  mobileWalletTransactions,
} from "../../../controllers/mobile/restaurant/wallet.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET  /mobile/restaurant/wallets
router.get("/", ...guard, mobileWalletGet);

// POST /mobile/restaurant/wallets/top-up
router.post("/top-up", ...guard, mobileWalletTopUp);

// GET  /mobile/restaurant/wallets/transactions
router.get("/transactions", ...guard, mobileWalletTransactions);

export default router;
