 
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
import {PaginationService } from "./paginationService";

 
export const createFarmerService = async (farmerData: ICreateFarmerData) => {
  const { location, phone, email, password } = farmerData;

  if (!location) {
    throw new Error("Location is required for farmers");
  }

  if (!phone && !email) {
    throw new Error("Either phone or email is required");
  }

  const existingFarmer = await prisma.farmer.findFirst({
    where: {
      OR: [{ phone: phone || undefined }, { email: email || undefined }],
    },
  });

  if (existingFarmer) {
    throw new Error("Farmer with this phone/email already exists");
  }

  try {
    let hashedPassword;
    if (password) {
      hashedPassword = await hashPassword(password);
    }

    const farmer = await prisma.farmer.create({
      data: {
        location,
        phone,
        email,
        password: hashedPassword,
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
      location: true,
      role: true,
      phone: true,
      email: true,
      createdAt: true,
      submissions: {
        select: {
          id: true,
          productName: true,
          quantity: true,
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
      location: true,
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
  const { password, ...otherData } = updateData;

  const existingFarmer = await prisma.farmer.findUnique({
    where: { id },
  });

  if (!existingFarmer) {
    throw new Error("Farmer not found");
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

 
export const createRestaurantService = async (
  restaurantData: ICreateRestaurantData
) => {
  const { name, email, phone, location, password } = restaurantData;

  if (!name || !email || !location || !password) {
    throw new Error(
      "Name, email, location, and password are required for restaurants"
    );
  }

  const existingRestaurant = await prisma.restaurant.findFirst({
    where: {
      OR: [{ email }, { phone: phone || undefined }],
    },
  });

  if (existingRestaurant) {
    throw new Error("Restaurant with this email/phone already exists");
  }

  try {
    const hashedPassword = await hashPassword(password);

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        email,
        phone,
        location,
        password: hashedPassword,
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
      location: true,
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
      location: true,
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
  const { password, ...otherData } = updateData;

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { id },
  });

  if (!existingRestaurant) {
    throw new Error("Restaurant not found");
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

 
export const createAdminService = async (adminData: ICreateAdminData) => {
  const { username, email, password, role } = adminData;

  if (!username || !email || !password || !role) {
    throw new Error(
      "Username, email, password, and role are required for admins"
    );
  }

  const existingAdmin = await prisma.admin.findFirst({
    where: { email },
  });

  if (existingAdmin) {
    throw new Error("Admin with this email already exists");
  }

  try {
    const hashedPassword = await hashPassword(password);

    const admin = await prisma.admin.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role,
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
      createdAt: true,
    },
  });

  return admin;
};

export const updateAdminService = async (
  id: string,
  updateData: IUpdateAdminData
) => {
  const { password, ...otherData } = updateData;

  const existingAdmin = await prisma.admin.findUnique({
    where: { id },
  });

  if (!existingAdmin) {
    throw new Error("Admin not found");
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

 
export const loginService = async (loginData: ILoginData) => {
  const { phone, email, password, userType } = loginData;

  let user: any = null;
  let foundUserType = "";

   
  if (userType) {
    switch (userType) {
      case "farmer":
        user = await prisma.farmer.findFirst({
          where: {
            OR: [{ phone: phone || undefined }, { email: email || undefined }],
          },
        });
        foundUserType = "farmer";
        break;

      case "restaurant":
        user = await prisma.restaurant.findFirst({
          where: {
            OR: [{ phone: phone || undefined }, { email: email || undefined }],
          },
        });
        foundUserType = "restaurant";
        break;

      case "admin":
        user = await prisma.admin.findFirst({
          where: { email: email || undefined },
        });
        foundUserType = "admin";
        break;
    }
  } else {
     
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
