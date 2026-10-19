import { Request, Response } from "express";
import {
  addToWishlistService,
  getWishlistService,
  removeFromWishlistService,
  resolveWishlistOwner,
} from "../services/wishlist.service";

/**
 * My saved products
 * GET /wishlist
 */
export const getWishlist = async (req: Request, res: Response) => {
  try {
    const restaurantId = await resolveWishlistOwner((req as any).user);
    const data = await getWishlistService(restaurantId);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to load wishlist" });
  }
};

/**
 * Save a product
 * POST /wishlist/:productId
 */
export const addToWishlist = async (req: Request, res: Response) => {
  try {
    const restaurantId = await resolveWishlistOwner((req as any).user);
    const data = await addToWishlistService(restaurantId, req.params.productId as string);
    res.status(201).json({ success: true, message: "Saved to your wishlist", data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to save product" });
  }
};

/**
 * Remove a saved product
 * DELETE /wishlist/:productId
 */
export const removeFromWishlist = async (req: Request, res: Response) => {
  try {
    const restaurantId = await resolveWishlistOwner((req as any).user);
    const data = await removeFromWishlistService(restaurantId, req.params.productId as string);
    res.json({ success: true, message: "Removed from your wishlist", data });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || "Failed to remove product" });
  }
};
