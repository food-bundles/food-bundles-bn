import prisma from "../prisma";

export const getUserById = async (id: number) => {
  const farmer = await prisma.farmer.findUnique({ where: { id } });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const admin = await prisma.admin.findUnique({ where: { id } });
  if (admin) return { ...admin, userType: "ADMIN" };

  return null;
};

export const getUserByEmail = async (email: string) => {
  const farmer = await prisma.farmer.findUnique({ where: { email } });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({ where: { email } });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) return { ...admin, userType: "ADMIN" };

  return null;
};


export const getUserByPhone = async (phone: string) => {
  const farmer = await prisma.farmer.findUnique({ where: { phone } });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({ where: { phone } });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  return null; // Admin doesn't have phone field
};
