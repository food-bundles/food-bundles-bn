import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileTwoFactorEnable,
  mobileTwoFactorVerifySetup,
  mobileTwoFactorDisable,
  mobileTwoFactorStatus,
  mobileTwoFactorRegenerateBackupCodes,
} from "../../../controllers/mobile/restaurant/twoFactor.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

router.get("/status", ...guard, mobileTwoFactorStatus);
router.post("/enable", ...guard, mobileTwoFactorEnable);
router.post("/verify-setup", ...guard, mobileTwoFactorVerifySetup);
router.post("/disable", ...guard, mobileTwoFactorDisable);
router.post("/regenerate-backup-codes", ...guard, mobileTwoFactorRegenerateBackupCodes);

export default router;
