import prisma from "../prisma";
import { nearestSitesForFarmer } from "./aggregationSite.service";

const OPEN_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING"] as const;

export interface FarmerCropDemand {
  productId: string;
  cropName: string;
  neededKg: number;
  ratePerKg: number;
  orderCount: number;
  /** The farmer's aggregation site (the one an admin chose, else the nearest); null when unknown */
  deliveryPoint: string | null;
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

  // Same site as the farmer's profile shows: the assigned one, else the nearest to them
  const assigned = await prisma.farmer
    .findUnique({ where: { id: farmerId }, select: { aggregationSite: { select: { name: true } } } })
    .catch(() => null);
  const nearestSite = assigned?.aggregationSite ?? (await nearestSitesForFarmer(farmerId, 1).catch(() => []))[0];
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
        deliveryPoint: nearestSite?.name ?? null,
      };
    })
    .filter((d) => d.neededKg > 0)
    .sort((a, b) => b.neededKg - a.neededKg);
}
