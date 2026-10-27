import { Request, Response } from "express";
import {
  mobileAddToCart,
  mobileGetMyCart,
  mobileUpdateCartItem,
  mobileRemoveCartItem,
  mobileClearCart,
} from "../../../services/mobile/restaurant/cart.service";

const user = (req: Request) => (req as any).user;

export const mobileCartAdd = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId || !quantity)
      return res
        .status(400)
        .json({ message: "Product ID and quantity are required" });
    if (quantity <= 0)
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    const item = await mobileAddToCart({
      userId: user(req).id,
      userRole: user(req).role,
      productId,
      quantity: Number(quantity),
    });
    res
      .status(200)
      .json({ message: "Item added to cart successfully", data: item });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to add item to cart" });
  }
};

export const mobileCartGet = async (req: Request, res: Response) => {
  try {
    const cart = await mobileGetMyCart(user(req).id, user(req).role);
    res
      .status(200)
      .json({
        message: cart ? "Cart retrieved successfully" : "Cart is empty",
        data: cart ?? null,
      });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get cart" });
  }
};

export const mobileCartSummary = async (req: Request, res: Response) => {
  try {
    const cart = await mobileGetMyCart(user(req).id, user(req).role);
    if (!cart)
      return res
        .status(200)
        .json({
          message: "Cart summary retrieved",
          data: { itemCount: 0, totalAmount: 0 },
        });
    const itemCount = cart.cartItems.reduce(
      (t: number, i: any) => t + i.quantity,
      0,
    );
    res
      .status(200)
      .json({
        message: "Cart summary retrieved",
        data: { itemCount, totalAmount: cart.totalAmount, cartId: cart.id },
      });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get cart summary" });
  }
};

export const mobileCartUpdateItem = async (req: Request, res: Response) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    if (!quantity || quantity <= 0)
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    const item = await mobileUpdateCartItem(
      cartItemId,
      Number(quantity),
      user(req).id,
      user(req).role,
    );
    res
      .status(200)
      .json({ message: "Cart item updated successfully", data: item });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to update cart item" });
  }
};

export const mobileCartRemoveItem = async (req: Request, res: Response) => {
  try {
    const result = await mobileRemoveCartItem(
      req.params.cartItemId,
      user(req).id,
      user(req).role,
    );
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to remove cart item" });
  }
};

export const mobileCartClear = async (req: Request, res: Response) => {
  try {
    const result = await mobileClearCart(user(req).id, user(req).role);
    res.status(200).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to clear cart" });
  }
};
