import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  getMyVoucherCardController,
  submitKycController,
  requestVoucherCardController,
  getLoanTermsController,
  acceptLoanTermsController,
  getLoanSessionsController,
  requestLoanSessionController,
  initiateUnlockFeeController,
} from "../../../controllers/mobile/restaurant/voucher-card.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.get("/", ...guard, getMyVoucherCardController);
router.post("/kyc", ...guard, submitKycController);
router.post("/request", ...guard, requestVoucherCardController);
router.get("/loan-terms", ...guard, getLoanTermsController);
router.post("/loan-terms/accept", ...guard, acceptLoanTermsController);
router.get("/loan-sessions", ...guard, getLoanSessionsController);
router.post("/loan-sessions", ...guard, requestLoanSessionController);
router.post("/loan-sessions/:id/unlock-fee", ...guard, initiateUnlockFeeController);

export default router;
