import { getAllProductsService, getProductByIdService } from "../../productService";

export const mobileGetProducts = (params: {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) => getAllProductsService({ ...params, includeOutOfStock: false });

export const mobileGetProductById = (productId: string) =>
  getProductByIdService(productId);
