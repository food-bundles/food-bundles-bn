import prisma from "../../../prisma";

export interface GuestOrderLine {
  productId: string;
  qty: number;
  unitPrice: number;
  name?: string;
}

export interface GuestOrderInput {
  lines: GuestOrderLine[];
  contactName: string;
  contactPhone: string;
  deliveryStreet: string;
  deliveryLandmark?: string;
  paymentMethod: string;
}

export const createGuestOrderService = async (input: GuestOrderInput) => {
  const { lines, contactName, contactPhone, deliveryStreet, deliveryLandmark, paymentMethod } = input;

  if (!lines || lines.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const deliveryFee = subtotal > 0 && subtotal < 100000 ? 5000 : 0;
  const total = subtotal + deliveryFee;

  // Verify products exist
  const productIds = lines.map((l) => l.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, productName: true, restaurantPrice: true },
  });

  if (products.length !== productIds.length) {
    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    throw new Error(`Products not found: ${missing.join(", ")}`);
  }

  const reference = `FB-G-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  const guestOrder = await prisma.guestOrder.create({
    data: {
      reference,
      contactName,
      contactPhone,
      deliveryAddress: [deliveryStreet, deliveryLandmark].filter(Boolean).join(", "),
      paymentMethod,
      subtotal,
      deliveryFee,
      total,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      },
    },
    include: { lines: true },
  });

  return { reference: guestOrder.reference, total: guestOrder.total, orderId: guestOrder.id };
};
