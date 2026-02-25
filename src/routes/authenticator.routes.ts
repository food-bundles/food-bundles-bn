import { Router } from "express";
import {
  enable2FA,
  verify2FASetup,
  verify2FAToken,
  disable2FA,
  get2FAStatus,
  regenerateBackupCodes,
} from "../controllers/authenticator.controller";
import { isAuthenticated } from "../middleware/authMiddleware";

const authenticatorRoutes = Router();

// Enable 2FA - generates QR code and backup codes
authenticatorRoutes.post("/enable", isAuthenticated, enable2FA);

// Verify 2FA setup - confirms setup with first token
authenticatorRoutes.post("/verify-setup", isAuthenticated, verify2FASetup);

// Verify 2FA token - validates token during sensitive operations
authenticatorRoutes.post("/verify", isAuthenticated, verify2FAToken);

// Disable 2FA - requires token verification
authenticatorRoutes.post("/disable", isAuthenticated, disable2FA);

// Get 2FA status
authenticatorRoutes.get("/status", isAuthenticated, get2FAStatus);

// Regenerate backup codes - requires token verification
authenticatorRoutes.post(
  "/regenerate-backup-codes",
  isAuthenticated,
  regenerateBackupCodes
);

export default authenticatorRoutes;
