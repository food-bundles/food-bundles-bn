import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import { mobileLogin, mobileMe, mobileForgotPassword, mobileResetPassword, mobileUpdateProfile } from "../../../controllers/mobile/restaurant/auth.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// POST /mobile/restaurant/login
router.post("/login", mobileLogin);

// GET  /mobile/restaurant/me
router.get("/me", ...guard, mobileMe);

// PATCH /mobile/restaurant/me
router.patch("/me", ...guard, mobileUpdateProfile);

// POST /mobile/restaurant/forgot-password
router.post("/forgot-password", mobileForgotPassword);

// POST /mobile/restaurant/reset-password
router.post("/reset-password", mobileResetPassword);

export default router;
