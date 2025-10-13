import { Role } from "@prisma/client";
import { UserLocationData } from "./locationTypes";

export interface ICreateFarmerData extends UserLocationData {
  phone?: string;
  email?: string;
  password?: string;
}

export interface ICreateRestaurantData extends UserLocationData {
  name: string;
  email: string;
  phone?: string;
  tin: string;
  password: string;
}

export interface ICreateAdminData extends Partial<UserLocationData> {
  username: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}

export interface IUpdateFarmerData extends Partial<UserLocationData> {
  phone?: string;
  email?: string;
  password?: string;
}

export interface IUpdateRestaurantData extends Partial<UserLocationData> {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface IUpdateAdminData extends Partial<UserLocationData> {
  username?: string;
  email?: string;
  password?: string;
  role?: Role;
}

export interface IPaginationQuery {
  page: number;
  limit: number;
}

export interface ILoginData {
  phone?: string;
  email?: string;
  password: string;
  tin?: string;
}

export interface IPaginationQuery {
  page: number;
  limit: number;
}

export interface IPaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IPaginationOptions {
  skip?: number;
  take?: number;
  orderBy?: any;
  select?: any;
  include?: any;
  where?: any;
}

export interface JwtPayload {
  id: string;
  // role: Role;
  iat?: number;
  exp?: number;
}
