import { loginService, createRestaurantService, requestPasswordResetViaPhoneService, resetPasswordViaPhoneService, updateRestaurantService } from "../../userServices";
import { generateToken } from "../../../utils/jwt";

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
  });

  const token = generateToken({ id: restaurant.id });
  const { password: _, ...user } = restaurant as any;
  return { token, user };
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
