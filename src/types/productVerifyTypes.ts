import { Role } from "@prisma/client";

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  productName?: string;
}

export interface IGetSubmissionsParams {
  userId: string;
  userRole: Role;
  options?: IPaginationOptions;
}
