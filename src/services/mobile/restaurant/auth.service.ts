import { loginService, requestPasswordResetViaPhoneService, resetPasswordViaPhoneService, updateRestaurantService } from "../../userServices";
import { generateToken } from "../../../utils/jwt";

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
