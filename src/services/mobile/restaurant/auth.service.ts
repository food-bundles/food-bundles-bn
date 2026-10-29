import { loginService, createRestaurantService, requestPasswordResetViaPhoneService, resetPasswordViaPhoneService, updateRestaurantService } from "../../userServices";
import { generateToken } from "../../../utils/jwt";
import { OTPService } from "../../otp.service";
import prisma from "../../../prisma";

export const mobileRestaurantRegisterService = async (data: {
  name: string;
  email: string;
  phone?: string;
  tin: string;
  password: string;
  role: string;
}) => {
  const restaurant = await createRestaurantService({
    name: data.name,
    email: data.email,
    phone: data.phone,
    tin: data.tin,
    password: data.password,
    role: data.role as any,
    agreed: true,
    verified: false, // stays unverified until OTP confirmed
  });

  // Send OTP to phone (and email as fallback) for phone verification
  if (data.phone) {
    await OTPService.sendRestaurantSignupOTP(data.phone, data.email);
  }

  const { password: _, ...user } = restaurant as any;
  return { user };
};

export const mobileVerifyOTPService = async (phone: string, otp: string) => {
  const result = await OTPService.verifyOTP(phone, otp, "RESTAURANT_SIGNUP");
  if (!result.success) throw new Error(result.message);

  // Mark restaurant as verified
  const restaurant = await prisma.restaurant.update({
    where: { phone },
    data: { verified: true },
  });

  const token = generateToken({ id: restaurant.id });
  const { password: _, ...user } = restaurant as any;
  return { token, user };
};

export const mobileResendOTPService = async (phone: string) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { phone },
    select: { email: true, verified: true },
  });
  if (!restaurant) throw new Error("No account found for this phone number");
  if (restaurant.verified) throw new Error("Account is already verified");
  return OTPService.sendRestaurantSignupOTP(phone, restaurant.email);
};

export const mobileRestaurantLoginService = async (credentials: {
  phone?: string;
  email?: string;
  tin?: string;
  password: string;
}) => {
  const result = await loginService(credentials);
  const user = result.user;

  if (!["RESTAURANT", "HOTEL"].includes(user.role)) {
    throw new Error("Access denied: only restaurant accounts can use this app");
  }

  const token = generateToken({ id: user.id });
  return { token, user: result };
};

export const mobileForgotPasswordService = requestPasswordResetViaPhoneService;
export const mobileResetPasswordService = resetPasswordViaPhoneService;

export const mobileUpdateProfileService = async (
  restaurantId: string,
  data: { name?: string; email?: string; phone?: string; tin?: string },
) => updateRestaurantService(restaurantId, data);
