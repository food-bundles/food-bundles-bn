import prisma from "../prisma";

const OPEN_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING"] as const;

export interface FarmerCropDemand {
  productId: string;
  cropName: string;
  neededKg: number;
  ratePerKg: number;
  orderCount: number;
}

// Buyer demand = quantity in open restaurant orders, limited to the
// products the farmer has registered as primary crops.
export async function getFarmerCropDemand(
  farmerId: string
): Promise<FarmerCropDemand[]> {
  const crops = await prisma.farmerPrimaryCrop.findMany({
    where: { farmerId },
    select: {
      productId: true,
      product: { select: { productName: true, purchasePrice: true } },
    },
  });
  if (crops.length === 0) return [];

  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: crops.map((c) => c.productId) },
      order: { status: { in: [...OPEN_ORDER_STATUSES] } },
    },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  const byProduct = new Map(grouped.map((g) => [g.productId, g]));
  return crops
    .map((c) => {
      const g = byProduct.get(c.productId);
      return {
        productId: c.productId,
        cropName: c.product.productName,
        neededKg: g?._sum.quantity ?? 0,
        ratePerKg: c.product.purchasePrice,
        orderCount: g?._count._all ?? 0,
      };
    })
    .filter((d) => d.neededKg > 0)
    .sort((a, b) => b.neededKg - a.neededKg);
}
