import { Request, Response } from "express";
import {
  addToCartService,
  getCartByRestaurantIdService,
  getCartByIdService,
  updateCartItemService,
  removeCartItemService,
  clearCartService,
  getAllCartsService,
} from "../services/cart.service";

/**
 * Controller to add item to cart
 * POST /carts/add
 */
export const addToCart = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;
    const restaurantId = (req as any).user.id; // Assuming authenticated user

    // Validate required fields
    if (!productId || !quantity) {
      return res.status(400).json({
        message: "Product ID and quantity are required",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const cartItem = await addToCartService({
      restaurantId,
      productId,
      quantity: Number(quantity),
    });

    res.status(200).json({
      message: "Item added to cart successfully",
      data: cartItem,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to add item to cart",
    });
  }
};

/**
 * Controller to get current cart for authenticated restaurant
 * GET /carts/my-cart
 */
export const getMyCart = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;

    const cart = await getCartByRestaurantIdService(restaurantId);

    if (!cart) {
      return res.status(200).json({
        message: "Cart is empty",
        data: null,
      });
    }

    res.status(200).json({
      message: "Cart retrieved successfully",
      data: cart,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get cart",
    });
  }
};

/**
 * Controller to get cart by ID (Admin only)
 * GET /carts/:cartId
 */
export const getCartById = async (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;

    const cart = await getCartByIdService(cartId);

    res.status(200).json({
      message: "Cart retrieved successfully",
      data: cart,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get cart",
    });
  }
};

/**
 * Controller to update cart item quantity
 * PATCH /carts/items/:cartItemId
 */
export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const { cartItemId } = req.params;
    const { quantity } = req.body;
    const restaurantId = (req as any).user.id;

    // Validate required fields
    if (!quantity) {
      return res.status(400).json({
        message: "Quantity is required",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const updatedCartItem = await updateCartItemService(
      cartItemId,
      { quantity: Number(quantity) },
      restaurantId
    );

    res.status(200).json({
      message: "Cart item updated successfully",
      data: updatedCartItem,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to update cart item",
    });
  }
};

/**
 * Controller to remove item from cart
 * DELETE /carts/items/:cartItemId
 */
export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const { cartItemId } = req.params;
    const restaurantId = (req as any).user.id;

    const result = await removeCartItemService(cartItemId, restaurantId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to remove cart item",
    });
  }
};

/**
 * Controller to clear entire cart
 * DELETE /carts/clear
 */
export const clearCart = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;

    const result = await clearCartService(restaurantId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to clear cart",
    });
  }
};

/**
 * Controller to get all carts (Admin only)
 * GET /carts
 */
export const getAllCarts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const result = await getAllCartsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      status: status as string,
    });

    res.status(200).json({
      message: "Carts retrieved successfully",
      data: result.carts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get carts",
    });
  }
};

/**
 * Controller to get cart summary (item count and total)
 * GET /carts/summary
 */
export const getCartSummary = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;

    const cart = await getCartByRestaurantIdService(restaurantId);

    if (!cart) {
      return res.status(200).json({
        message: "Cart summary retrieved successfully",
        data: {
          itemCount: 0,
          totalAmount: 0,
        },
      });
    }

    const itemCount = cart.cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );

    res.status(200).json({
      message: "Cart summary retrieved successfully",
      data: {
        itemCount,
        totalAmount: cart.totalAmount,
        cartId: cart.id,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get cart summary",
    });
  }
};
