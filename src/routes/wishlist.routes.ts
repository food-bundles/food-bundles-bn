import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../prisma";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const wishlistRoutes = Router();

wishlistRoutes.use(isAuthenticated, checkPermission("RESTAURANT"));

wishlistRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { restaurantId: (req as any).user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to load wishlist" });
  }
});

wishlistRoutes.post("/:productId", async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { productId } = req.params;
    const item = await prisma.wishlistItem.upsert({
      where: { restaurantId_productId: { restaurantId, productId } },
      update: {},
      create: { id: randomUUID(), restaurantId, productId },
    });
    res.status(201).json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to add to wishlist" });
  }
});

wishlistRoutes.delete("/:productId", async (req: Request, res: Response) => {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { restaurantId: (req as any).user.id, productId: req.params.productId },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || "Failed to remove from wishlist" });
  }
});

export default wishlistRoutes;
