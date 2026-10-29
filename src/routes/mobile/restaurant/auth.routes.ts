import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import { mobileRegister, mobileLogin, mobileMe, mobileForgotPassword, mobileResetPassword, mobileUpdateProfile, mobileVerifyOTP, mobileResendOTP } from "../../../controllers/mobile/restaurant/auth.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// POST /mobile/restaurant/register
router.post("/register", mobileRegister);

// POST /mobile/restaurant/login
router.post("/login", mobileLogin);

// GET  /mobile/restaurant/me
router.get("/me", ...guard, mobileMe);

// PATCH /mobile/restaurant/me
router.patch("/me", ...guard, mobileUpdateProfile);

// POST /mobile/restaurant/verify-otp
router.post("/verify-otp", mobileVerifyOTP);

// POST /mobile/restaurant/resend-otp
router.post("/resend-otp", mobileResendOTP);

// POST /mobile/restaurant/forgot-password
router.post("/forgot-password", mobileForgotPassword);

// POST /mobile/restaurant/reset-password
router.post("/reset-password", mobileResetPassword);

export default router;
