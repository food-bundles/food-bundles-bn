import { Request, Response } from "express";
import prisma from "../../../prisma";
import {
  mobileGetProducts,
  mobileGetProductById,
} from "../../../services/mobile/restaurant/products.service";

export const mobileProductsList = async (req: Request, res: Response) => {
  try {
    const { categoryId, search, page = 1, limit = 20 } = req.query;
    const result = await mobileGetProducts({
      categoryId: categoryId as string,
      search: search as string,
      page: Number(page),
      limit: Number(limit),
    });
    res.status(200).json({
      message: "Products retrieved",
      data: result.products,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: error.message || "Failed to get products" });
  }
};

export const mobileProductGet = async (req: Request, res: Response) => {
  try {
    const product = await mobileGetProductById(req.params.productId);
    res.status(200).json({ message: "Product retrieved", data: product });
  } catch (error: any) {
    const status = error.message === "Product not found" ? 404 : 500;
    res
      .status(status)
      .json({ message: error.message || "Failed to get product" });
  }
};

// GET /mobile/restaurant/products/categories
export const mobileProductCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    res.status(200).json({ message: "Categories retrieved", data: categories });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get categories" });
  }
};
