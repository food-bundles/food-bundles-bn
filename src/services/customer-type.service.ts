import prisma from "../prisma";

export interface CustomerTypeData {
  name: string;
  description?: string;
  createdBy: string;
}

export const createCustomerTypeService = async (data: CustomerTypeData) => {
  const admin = await prisma.admin.findUnique({ where: { id: data.createdBy } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can create customer types");

  const existing = await prisma.customerType.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" } },
  });
  if (existing) throw new Error("Customer type name already exists");

  return prisma.customerType.create({
    data: { name: data.name.trim(), description: data.description?.trim(), createdBy: data.createdBy },
  });
};

export const getAllCustomerTypesService = async () => {
  return prisma.customerType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
};

export const getCustomerTypeByIdService = async (id: string) => {
  const customerType = await prisma.customerType.findUnique({ where: { id } });
  if (!customerType) throw new Error("Customer type not found");
  return customerType;
};

export const updateCustomerTypeService = async (
  id: string,
  data: Partial<CustomerTypeData>,
  adminId: string
) => {
  const existing = await prisma.customerType.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer type not found");

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin || admin.role !== "ADMIN") throw new Error("Only ADMIN users can update customer types");

  if (data.name && data.name !== existing.name) {
    const nameTaken = await prisma.customerType.findFirst({
      where: { name: { equals: data.name, mode: "insensitive" }, NOT: { id } },
    });
    if (nameTaken) throw new Error("Customer type name already exists");
  }

  return prisma.customerType.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
    },
  });
};

export const deleteCustomerTypeService = async (id: string) => {
  const existing = await prisma.customerType.findUnique({ where: { id } });
  if (!existing) throw new Error("Customer type not found");
  await prisma.customerType.delete({ where: { id } });
  return { message: "Customer type deleted successfully" };
};
