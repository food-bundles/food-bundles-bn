import prisma from "../prisma";
import {
  ICreateAdminData,
  ICreateFarmerData,
  ICreateRestaurantData,
  ILoginData,
  IPaginationQuery,
  IUpdateAdminData,
  IUpdateFarmerData,
  IUpdateRestaurantData,
} from "../types/userTypes";
import { comparePassword, hashPassword } from "../utils/password";
import { getUserByEmail } from "./userGets";
import {
  sendEmail,
  sendPasswordResetTemplate,
  generateResetToken,
  verifyResetToken,
} from "../utils/passwordReset";
import { PaginationService } from "./paginationService";
import { LocationValidationService } from "./location.service";
import { validateTIN } from "../utils/validateTin";
import { createNotificationService } from "./notification.services";
import {
  generateFarmerPIN,
  generateRestaurantPassword,
  sendPasswordSMS,
} from "../utils/passwordGenerator";
import { sendAdminUserCreatedEmail } from "../utils/emailTemplates";

// Helper function to check for existing phone/email across all user types
export const checkExistingUser = async (phone?: string, email?: string) => {
  if (!phone && !email) return null;

  const conditions = [];

  if (phone) {
    conditions.push(
      prisma.farmer.findFirst({ where: { phone } }),
      prisma.restaurant.findFirst({ where: { phone } }),
      prisma.affiliator.findFirst({ where: { phone } }),
      prisma.admin.findFirst({ where: { phone } }),
    );
  }

  if (email) {
    conditions.push(
      prisma.farmer.findFirst({ where: { email } }),
      prisma.restaurant.findFirst({ where: { email } }),
      prisma.affiliator.findFirst({ where: { email } }),
      prisma.admin.findFirst({ where: { email } }),
    );
  }

  const results = await Promise.all(conditions);
  const existingUser = results.find((result) => result !== null);

  if (existingUser) {
    // Add the matching field info for better error messages
    return {
      ...existingUser,
      phone: existingUser.phone === phone ? phone : undefined,
      email: existingUser.email === email ? email : undefined,
    };
  }

  return null;
};
// FARMER SERVICES
export const createFarmerService = async (farmerData: ICreateFarmerData) => {
  const {
    phone,
    email,
    name,
    password,
    location,
    province,
    district,
    sector,
    cell,
    village,
  } = farmerData;

  console.log("Received farmer data:---", farmerData);

  if (!phone && !email) {
    throw new Error("Either phone or email is required");
  }

  // Check if phone/email exists in any user table
  const existingUser = await checkExistingUser(
    phone || undefined,
    email || undefined,
  );

  console.log("Received existingUser data:---", existingUser);

  if (existingUser) {
    const field = existingUser.phone === phone ? "phone" : "email";
    throw new Error(`User with this ${field} already exists`);
  }

  // Validate location data if provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: province as string,
        district: district as string,
        sector: sector as string,
        cell: cell as string,
        village: village as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  // Remove the old farmer-specific check since we already checked globally
  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const farmer = await prisma.farmer.create({
      data: {
        phone,
        email,
        name,
        password: hashedPassword,
        location,
        province,
        district,
        sector,
        cell,
        village,
      },
    });

    console.log("Received farmer data:---", farmer);

    await createNotificationService({
      title: "New User Registration",
      message: `New ${farmer.role.toLowerCase()} ${
        farmer.email
      } has registered`,
      eventType: "USER_SIGNUP",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        userId: farmer.id,
        userRole: farmer.role,
        email: farmer.email,
        registeredAt: new Date().toISOString(),
      },
    });

    await sendAdminUserCreatedEmail({
      userType: farmer.role,
      userName: farmer.phone || "Farmer",
      userEmail: farmer.email || "",
    });

    const { password: _, ...farmerWithoutPassword } = farmer;
    return farmerWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create farmer: ${error.message}`);
  }
};

export const getAllFarmersService = async (query: IPaginationQuery) => {
  const normalizedQuery = PaginationService.validatePaginationParams(
    query.page,
    query.limit,
  );

  const options = {
    select: {
      id: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      phone: true,
      email: true,
      name: true,
      createdAt: true,
      submissions: {
        select: {
          id: true,
          productName: true,
          submittedQty: true,
          submittedAt: true,
        },
        orderBy: {
          submittedAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  };

  const result = await PaginationService.paginate(
    prisma.farmer,
    normalizedQuery,
    options,
  );

  return {
    farmers: result.data,
    pagination: result.pagination,
  };
};

export const getFarmerByIdService = async (id: string) => {
  const farmer = await prisma.farmer.findUnique({
    where: { id },
    select: {
      id: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      phone: true,
      email: true,
      name: true,
      createdAt: true,
      submissions: {
        select: {
          id: true,
          productName: true,
          submittedQty: true,
          submittedAt: true,
        },
        orderBy: {
          submittedAt: "desc",
        },
      },
    },
  });

  return farmer;
};

export const updateFarmerService = async (
  id: string,
  updateData: IUpdateFarmerData,
) => {
  const {
    password,
    province,
    district,
    sector,
    cell,
    village,
    phone,
    email,
    ...otherData
  } = updateData;

  const existingFarmer = await prisma.farmer.findUnique({
    where: { id },
  });

  if (!existingFarmer) {
    throw new Error("Farmer not found");
  }

  // Check if new phone/email already exists in any user table (excluding current farmer)
  if (phone || email) {
    const existingUser = await checkExistingUser(
      phone || undefined,
      email || undefined,
    );

    if (existingUser && existingUser.id !== id) {
      throw new Error("User with this phone/email already exists");
    }
  }

  // Validate location data if any location field is provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: (province ? province : existingFarmer.province) as string,
        district: (district ? district : existingFarmer.district) as string,
        sector: (sector ? sector : existingFarmer.sector) as string,
        cell: (cell ? cell : existingFarmer.cell) as string,
        village: (village ? village : existingFarmer.village) as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const updatedFarmer = await prisma.farmer.update({
      where: { id },
      data: {
        ...otherData,
        province,
        district,
        sector,
        cell,
        village,
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    const { password: _, ...farmerWithoutPassword } = updatedFarmer;
    return farmerWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to update farmer: ${error.message}`);
  }
};

export const deleteFarmerService = async (id: string) => {
  const existingFarmer = await prisma.farmer.findUnique({
    where: { id },
  });

  if (!existingFarmer) {
    throw new Error("Farmer not found");
  }

  try {
    await prisma.farmer.delete({
      where: { id },
    });

    return { message: "Farmer deleted successfully" };
  } catch (error: any) {
    throw new Error(`Failed to delete farmer: ${error.message}`);
  }
};

// RESTAURANT SERVICES
export const createRestaurantService = async (
  restaurantData: ICreateRestaurantData,
) => {
  const {
    name,
    email,
    phone,
    password,
    tin,
    location,
    province,
    district,
    sector,
    cell,
    village,
    role = "RESTAURANT", // Default to RESTAURANT if not specified
  } = restaurantData;

  // Require fields
  if (!name || !password) {
    throw new Error("Name, and password are required");
  }

  if (!tin) {
    throw new Error("TIN (Tax Identification Number) is required");
  }

  // Validate role
  if (role && !["RESTAURANT", "HOTEL"].includes(role)) {
    throw new Error("Role must be either RESTAURANT or HOTEL");
  }

  // Validate TIN format
  if (!validateTIN(tin)) {
    throw new Error(
      "Invalid TIN format. TIN must be a 9-digit number (not all zeros)",
    );
  }

  // Check unique TIN
  const existingTIN = await prisma.restaurant.findUnique({
    where: { tin },
  });
  if (existingTIN) {
    throw new Error("A restaurant with this TIN already exists");
  }

  // Check phone/email uniqueness across user tables
  const existingUser = await checkExistingUser(phone || undefined, email);
  if (existingUser) {
    throw new Error("User with this phone/email already exists");
  }

  // Validate location if provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: province as string,
        district: district as string,
        sector: sector as string,
        cell: cell as string,
        village: village as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    const hashedPassword = await hashPassword(password);

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        email,
        phone,
        tin, // Save TIN
        password: hashedPassword,
        location,
        province,
        district,
        sector,
        cell,
        village,
        role: role as any, // Set the role (RESTAURANT or HOTEL)
      },
    });

    // In user registration controller
    await createNotificationService({
      title: "New User Registration",
      message: `New ${restaurant.role.toLowerCase()} ${
        restaurant.name || restaurant.email
      } has registered`,
      eventType: "USER_SIGNUP",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        userId: restaurant.id,
        userRole: restaurant.role,
        email: restaurant.email,
        registeredAt: new Date().toISOString(),
      },
    });

    await sendAdminUserCreatedEmail({
      userName: name,
      userEmail: email,
      userType: role === "HOTEL" ? "HOTEL" : "RESTAURANT",
      restaurantName: name,
    });

    const { password: _, ...restaurantWithoutPassword } = restaurant;
    return restaurantWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create ${role?.toLowerCase() || 'restaurant'}: ${error.message}`);
  }
};

// TERMS AND CONDITIONS SERVICE
export const acceptTermsService = async (identifier: string) => {
  const restaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
    },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  // Update agreed field to true
  const updatedRestaurant = await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { agreed: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      agreed: true,
      verified: true,
    },
  });

  return updatedRestaurant;
};

export const getAllRestaurantsService = async (query: IPaginationQuery) => {
  const normalizedQuery = PaginationService.validatePaginationParams(
    query.page,
    query.limit,
  );

  const options = {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  };

  const result = await PaginationService.paginate(
    prisma.restaurant,
    normalizedQuery,
    options,
  );

  return {
    restaurants: result.data,
    pagination: result.pagination,
  };
};

export const getRestaurantByIdService = async (id: string) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          orderItems: {
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              product: {
                select: {
                  tableTronicProductId: true,
                  productName: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      posSales: {
        select: {
          id: true,
          totalAmount: true,
          paymentMethod: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return restaurant;
};

export const updateRestaurantService = async (
  id: string,
  updateData: IUpdateRestaurantData,
) => {
  const {
    password,
    province,
    district,
    sector,
    cell,
    village,
    phone,
    email,
    ...otherData
  } = updateData;

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { id },
  });

  if (!existingRestaurant) {
    throw new Error("Restaurant not found");
  }

  // Check if new phone/email already exists in any user table (excluding current restaurant)
  if (phone || email) {
    const existingUser = await checkExistingUser(
      phone || undefined,
      email || undefined,
    );

    if (existingUser && existingUser.id !== id) {
      throw new Error("User with this phone/email already exists");
    }
  }

  // Validate location data if any location field is provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: (province ? province : existingRestaurant.province) as string,
        district: (district ? district : existingRestaurant.district) as string,
        sector: (sector ? sector : existingRestaurant.sector) as string,
        cell: (cell ? cell : existingRestaurant.cell) as string,
        village: (village ? village : existingRestaurant.village) as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id },
      data: {
        ...otherData,
        province,
        district,
        sector,
        cell,
        village,
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    const { password: _, ...restaurantWithoutPassword } = updatedRestaurant;
    return restaurantWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to update restaurant: ${error.message}`);
  }
};

export const deleteRestaurantService = async (id: string) => {
  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { id },
  });

  if (!existingRestaurant) {
    throw new Error("Restaurant not found");
  }

  try {
    await prisma.restaurant.delete({
      where: { id },
    });

    return { message: "Restaurant deleted successfully" };
  } catch (error: any) {
    throw new Error(`Failed to delete restaurant: ${error.message}`);
  }
};

// ADMIN SERVICES
export const createAdminService = async (adminData: ICreateAdminData) => {
  const {
    username,
    email,
    phone,
    password,
    role,
    location,
    province,
    district,
    sector,
    cell,
    village,
  } = adminData;

  if (!username || !email || !password || !role) {
    throw new Error("Username, email, password, role are required for admins");
  }

  // Check if phone/email exists in any user table
  const existingUser = await checkExistingUser(phone || undefined, email);
  if (existingUser) {
    throw new Error("User with this phone/email already exists");
  }

  // Validate location data if provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: province as string,
        district: district as string,
        sector: sector as string,
        cell: cell as string,
        village: village as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    const hashedPassword = await hashPassword(password);

    const admin = await prisma.admin.create({
      data: {
        username,
        email,
        phone: phone || null,
        password: hashedPassword,
        role,
        location,
        province,
        district,
        sector,
        cell,
        village,
      },
    });

    // In user registration controller
    await createNotificationService({
      title: "New User Registration",
      message: `New ${admin.role.toLowerCase()} ${admin.email} has registered`,
      eventType: "USER_SIGNUP",
      targetType: "ROLE_BASED",
      targetRole: "ADMIN",
      metadata: {
        userId: admin.id,
        userRole: admin.role,
        email: admin.email,
        registeredAt: new Date().toISOString(),
      },
    });

    await sendAdminUserCreatedEmail({
      userType: admin.role === "TRADER" ? "Trader" : "Admin",
      userName: admin.username,
      userEmail: admin.email,
    });

    const { password: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create admin: ${error.message}`);
  }
};

export const getAllAdminsService = async (query: IPaginationQuery) => {
  const normalizedQuery = PaginationService.validatePaginationParams(
    query.page,
    query.limit,
  );

  const options = {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  };

  const result = await PaginationService.paginate(
    prisma.admin,
    normalizedQuery,
    options,
  );

  return {
    admins: result.data,
    pagination: result.pagination,
  };
};

export const getAdminByIdService = async (id: string) => {
  const admin = await prisma.admin.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      phone: true,
      location: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      createdAt: true,
    },
  });

  return admin;
};

export const updateAdminService = async (
  id: string,
  updateData: IUpdateAdminData,
) => {
  const {
    password,
    province,
    district,
    sector,
    cell,
    village,
    email,
    ...otherData
  } = updateData;

  const existingAdmin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!existingAdmin) {
    throw new Error("Admin not found");
  }

  // Check if new phone/email already exists in any user table (excluding current admin)
  if (email) {
    const existingUser = await checkExistingUser(email || undefined);

    if (existingUser && existingUser.id !== id) {
      throw new Error("User with this phone/email already exists");
    }
  }

  // Validate location data if any location field is provided
  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: (province ? province : existingAdmin.province) as string,
        district: (district ? district : existingAdmin.district) as string,
        sector: (sector ? sector : existingAdmin.sector) as string,
        cell: (cell ? cell : existingAdmin.cell) as string,
        village: (village ? village : existingAdmin.village) as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: {
        ...otherData,
        province,
        district,
        sector,
        cell,
        village,
        ...(hashedPassword && { password: hashedPassword }),
      },
    });

    const { password: _, ...adminWithoutPassword } = updatedAdmin;
    return adminWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to update admin: ${error.message}`);
  }
};

export const deleteAdminService = async (id: string) => {
  const existingAdmin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!existingAdmin) {
    throw new Error("Admin not found");
  }

  try {
    await prisma.admin.delete({
      where: { id },
    });

    return { message: "Admin deleted successfully" };
  } catch (error: any) {
    throw new Error(`Failed to delete admin: ${error.message}`);
  }
};

// LOGIN SERVICE
export const loginService = async (loginData: ILoginData) => {
  const { phone, email, tin, password } = loginData;

  let user: any = null;
  let foundUserType = "";

  // Farmer login
  user = await prisma.farmer.findFirst({
    where: {
      OR: [{ phone: phone || undefined }, { email: email || undefined }],
    },
  });

  if (user) foundUserType = "farmer";

  // Restaurant login
  if (!user) {
    user = await prisma.restaurant.findFirst({
      where: {
        OR: [
          { phone: phone || undefined },
          { email: email || undefined },
          { tin: tin || undefined },
        ],
      },
    });

    if (user) {
      foundUserType = "restaurant";
      if (!user.verified) {
        throw new Error("Your account is not verified yet.");
      }

      if (!user.agreed) {
        throw new Error(
          "You must agree to the Terms and Conditions before logging in.",
        );
      }
    }
  }

  // Affiliator login
  if (!user) {
    user = await prisma.affiliator.findFirst({
      where: { email: email || undefined },
    });

    if (user) foundUserType = "affiliator";
  }

  // Admin login
  if (!user) {
    user = await prisma.admin.findFirst({
      where: { email: email || undefined },
    });

    if (user) foundUserType = "admin";
  }

  if (!user) throw new Error("User not found");

  if (!user.password) throw new Error("Password not set for this user");

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) throw new Error("Invalid password");

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    userType: foundUserType,
    message: "Login successful",
  };
};

// PASSWORD RESET SERVICES
export const requestPasswordResetService = async (email: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error("No account found with this email address");
  }

  // Generate reset token
  const resetToken = generateResetToken(user.id, user.userType);

  // Create reset link (you'll need to replace with your actual frontend URL)
  const resetLink = `${process.env.CLIENT_PRODUCTION_URL}/reset-password?token=${resetToken}`;

  // Get user name based on user type
  let userName = "";
  if (user.userType === "FARMER") {
    userName = user.phone || "Farmer";
  } else if (user.userType === "RESTAURANT") {
    userName = (user as any).name || "Restaurant Owner";
  } else if (user.userType === "ADMIN") {
    userName = (user as any).username || "Admin";
  }

  // Send reset email
  const emailHtml = sendPasswordResetTemplate({
    email: user.email!,
    name: userName,
    resetLink,
    userType: user.userType,
  });

  await sendEmail({
    to: user.email!,
    subject: "Reset Your FoodBundles Password",
    html: emailHtml,
  });

  return {
    message: "Password reset link has been sent to your email address",
  };
};

export const resetPasswordService = async (
  token: string,
  newPassword: string,
) => {
  // Verify token
  const decoded = verifyResetToken(token);

  if (!decoded) {
    throw new Error("Invalid or expired reset token");
  }

  const { userId, userType } = decoded;

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password based on user type
  try {
    if (userType === "FARMER") {
      await prisma.farmer.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    } else if (userType === "RESTAURANT") {
      await prisma.restaurant.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    } else if (userType === "ADMIN") {
      await prisma.admin.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });
    } else {
      throw new Error("Invalid user type");
    }

    return {
      message: "Password has been reset successfully",
    };
  } catch (error: any) {
    throw new Error(`Failed to reset password: ${error.message}`);
  }
};

// ADMIN-ONLY SERVICES WITH AUTO-GENERATED PASSWORDS

export const createFarmerByAdminService = async (
  farmerData: Omit<ICreateFarmerData, "password">,
) => {
  const {
    phone,
    email,
    name,
    location,
    province,
    district,
    sector,
    cell,
    village,
  } = farmerData;

  if (!phone) {
    throw new Error("Phone number is required for farmer creation");
  }

  if (!name) {
    throw new Error("Farmer name is required");
  }

  const existingUser = await checkExistingUser(phone, email || undefined);
  if (existingUser) {
    throw new Error("User with this phone/email already exists");
  }

  if (province || district || sector || cell || village) {
    const locationValidation =
      LocationValidationService.validateLocationHierarchy({
        province: province as string,
        district: district as string,
        sector: sector as string,
        cell: cell as string,
        village: village as string,
      });

    if (!locationValidation.isValid) {
      throw new Error(
        `Location validation failed: ${locationValidation.errors.join(", ")}`,
      );
    }
  }

  try {
    const generatedPIN = generateFarmerPIN();
    const hashedPassword = await hashPassword(generatedPIN);

    // Build data object conditionally to avoid unique constraint issues
    const farmerData = {
      phone,
      name,
      password: hashedPassword,
      location,
      province,
      district,
      sector,
      cell,
      village,
      ...(email && { email }), // Only include email if it's provided
    };

    const farmer = await prisma.farmer.create({
      data: farmerData,
    });

    await sendPasswordSMS(phone, generatedPIN, "farmer");

    const { password: _, ...farmerWithoutPassword } = farmer;
    return farmerWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create farmer: ${error.message}`);
  }
};

// Admin creates restaurant with auto-generated password
export const createRestaurantByAdminService = async (
  restaurantData: Omit<ICreateRestaurantData, "password">,
) => {
  const { name, email, phone, tin, location } = restaurantData;

  if (!name || !email || !phone) {
    throw new Error(
      "Name, email, and phone are required for restaurant creation",
    );
  }

  if (!tin) {
    throw new Error("TIN is required");
  }

  if (!validateTIN(tin)) {
    throw new Error("Invalid TIN format");
  }

  const existingTIN = await prisma.restaurant.findUnique({ where: { tin } });
  if (existingTIN) {
    throw new Error("Restaurant with this TIN already exists");
  }

  const existingUser = await checkExistingUser(phone, email);
  if (existingUser) {
    throw new Error("User with this phone/email already exists");
  }

  try {
    const generatedPassword = generateRestaurantPassword();
    console.log("Generated password: ", generatedPassword);
    console.log("Phone number for SMS: ", phone);
    const hashedPassword = await hashPassword(generatedPassword);

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        email,
        phone,
        password: hashedPassword,
        tin,
        location,
      },
    });

    try {
      await sendPasswordSMS(phone, generatedPassword, "restaurant");
    } catch (smsError: any) {
      console.error("SMS sending failed:", smsError.message);
    }

    const { password: _, ...restaurantWithoutPassword } = restaurant;
    return restaurantWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create restaurant: ${error.message}`);
  }
};
