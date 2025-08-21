import { ProductCategory } from "@prisma/client";

export interface ProductSubmissionInput {
  farmerId: string;
  productName: string;
  category: ProductCategory;
  submittedQty: number;
  wishedPrice: number;
}
