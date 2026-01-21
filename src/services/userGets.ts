import prisma from "../prisma";

export const getUserById = async (id: string) => {
  const farmer = await prisma.farmer.findUnique({ where: { id } });
  if (farmer) return { ...farmer, userType: "FARMER", name: "Farmer" };

  const restaurant = await prisma.restaurant.findUnique({ where: { id } });
  if (restaurant)
    return { ...restaurant, userType: "RESTAURANT", name: restaurant.name };

  const affiliator = await prisma.affiliator.findUnique({ where: { id } });
  if (affiliator)
    return { ...affiliator, userType: "AFFILIATOR", name: affiliator.name };

  const admin = await prisma.admin.findUnique({ where: { id } });
  if (admin) return { ...admin, userType: "ADMIN", name: admin.username };

  return null;
};

export const getUserByEmail = async (email: string) => {
  const farmer = await prisma.farmer.findUnique({ where: { email } });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({ where: { email } });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const affiliator = await prisma.affiliator.findUnique({ where: { email } });
  if (affiliator) return { ...affiliator, userType: "AFFILIATOR" };

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin) return { ...admin, userType: admin.role };

  return null;
};

export const getUserByPhone = async (phone: string) => {
  const farmer = await prisma.farmer.findUnique({ where: { phone } });
  if (farmer) return { ...farmer, userType: "FARMER" };

  const restaurant = await prisma.restaurant.findUnique({ where: { phone } });
  if (restaurant) return { ...restaurant, userType: "RESTAURANT" };

  const affiliator = await prisma.affiliator.findUnique({ where: { phone } });
  if (affiliator) return { ...affiliator, userType: "AFFILIATOR" };

  return null; // Admin doesn't have phone field
};
