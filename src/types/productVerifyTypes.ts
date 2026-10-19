import { Role } from "@prisma/client";

export interface IPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  productName?: string;
  feedbackStatus?: string;
  province?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface IGetSubmissionsParams {
  userId: string;
  userRole: Role;
  options?: IPaginationOptions;
}
