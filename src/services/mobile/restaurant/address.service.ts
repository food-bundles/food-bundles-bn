import prisma from "../../../prisma";

export const mobileGetAddresses = (restaurantId: string) =>
  prisma.deliveryAddress.findMany({
    where: { restaurantId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

export const mobileCreateAddress = async (
  restaurantId: string,
  data: { label: string; street: string; landmark?: string; phone: string; isDefault?: boolean },
) => {
  if (data.isDefault) {
    await prisma.deliveryAddress.updateMany({
      where: { restaurantId },
      data: { isDefault: false },
    });
  }
  return prisma.deliveryAddress.create({ data: { ...data, restaurantId } });
};

export const mobileUpdateAddress = async (
  id: string,
  restaurantId: string,
  data: { label?: string; street?: string; landmark?: string; phone?: string; isDefault?: boolean },
) => {
  const existing = await prisma.deliveryAddress.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new Error("Address not found");
  if (data.isDefault) {
    await prisma.deliveryAddress.updateMany({
      where: { restaurantId },
      data: { isDefault: false },
    });
  }
  return prisma.deliveryAddress.update({ where: { id }, data });
};

export const mobileDeleteAddress = async (id: string, restaurantId: string) => {
  const existing = await prisma.deliveryAddress.findFirst({ where: { id, restaurantId } });
  if (!existing) throw new Error("Address not found");
  await prisma.deliveryAddress.delete({ where: { id } });
  return { message: "Address deleted" };
};
