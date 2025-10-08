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
import { PaginationService } from "./paginationService";
import { LocationValidationService } from "./location.service";

// Helper function to check for existing phone/email across all user types
const checkExistingUser = async (phone?: string, email?: string) => {
  if (!phone && !email) return null;

  const conditions = [];

  if (phone) {
    conditions.push(
      prisma.farmer.findFirst({ where: { phone } }),
      prisma.restaurant.findFirst({ where: { phone } }),
      prisma.admin.findFirst({ where: { phone } })
    );
  }

  if (email) {
    conditions.push(
      prisma.farmer.findFirst({ where: { email } }),
      prisma.restaurant.findFirst({ where: { email } }),
      prisma.admin.findFirst({ where: { email } })
    );
  }

  const results = await Promise.all(conditions);
  return results.find((result) => result !== null) || null;
};
// FARMER SERVICES
export const createFarmerService = async (farmerData: ICreateFarmerData) => {
  const {
    phone,
    email,
    password,
    location,
    province,
    district,
    sector,
    cell,
    village,
  } = farmerData;

  if (!phone && !email) {
    throw new Error("Either phone or email is required");
  }

  // Check if phone/email exists in any user table
  const existingUser = await checkExistingUser(
    phone || undefined,
    email || undefined
  );
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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
        password: hashedPassword,
        location,
        province,
        district,
        sector,
        cell,
        village,
      },
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
    query.limit
  );

  const options = {
    select: {
      id: true,
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      phone: true,
      email: true,
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
    options
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
      province: true,
      district: true,
      sector: true,
      cell: true,
      village: true,
      role: true,
      phone: true,
      email: true,
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
  updateData: IUpdateFarmerData
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
      email || undefined
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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
  restaurantData: ICreateRestaurantData
) => {
  const {
    name,
    email,
    phone,
    password,
    location,
    province,
    district,
    sector,
    cell,
    village,
  } = restaurantData;

  if (!name || !email || !password) {
    throw new Error("Name, email, password are required for restaurants");
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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
        password: hashedPassword,
        location,
        province,
        district,
        sector,
        cell,
        village,
      },
    });

    const { password: _, ...restaurantWithoutPassword } = restaurant;
    return restaurantWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create restaurant: ${error.message}`);
  }
};
export const getAllRestaurantsService = async (query: IPaginationQuery) => {
  const normalizedQuery = PaginationService.validatePaginationParams(
    query.page,
    query.limit
  );

  const options = {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
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
    options
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
  updateData: IUpdateRestaurantData
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
      email || undefined
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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

    const { password: _, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  } catch (error: any) {
    throw new Error(`Failed to create admin: ${error.message}`);
  }
};

export const getAllAdminsService = async (query: IPaginationQuery) => {
  const normalizedQuery = PaginationService.validatePaginationParams(
    query.page,
    query.limit
  );

  const options = {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      phone: true,
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
    options
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
  updateData: IUpdateAdminData
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
        `Location validation failed: ${locationValidation.errors.join(", ")}`
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
  const { phone, email, password } = loginData;

  let user: any = null;
  let foundUserType = "";

  user = await prisma.farmer.findFirst({
    where: {
      OR: [{ phone: phone || undefined }, { email: email || undefined }],
    },
  });
  if (user) foundUserType = "farmer";

  if (!user) {
    user = await prisma.restaurant.findFirst({
      where: {
        OR: [{ phone: phone || undefined }, { email: email || undefined }],
      },
    });
    if (user) foundUserType = "restaurant";
  }

  if (!user) {
    user = await prisma.admin.findFirst({
      where: { email: email || undefined },
    });
    if (user) foundUserType = "admin";
  }

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.password) {
    throw new Error("Password not set for this user");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
  }

  const { password: _, ...userWithoutPassword } = user;

  return {
    user: userWithoutPassword,
    userType: foundUserType,
    message: "Login successful",
  };
};
