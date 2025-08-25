import { Role } from "@prisma/client";
import { LocationData } from "./locationTypes";

export interface ICreateFarmerData extends LocationData {
  phone?: string;
  email?: string;
  password?: string;
}

export interface ICreateRestaurantData extends LocationData {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface ICreateAdminData extends Partial<LocationData> {
  username: string;
  email: string;
  phone?: string;
  password: string;
  role: Role;
}

export interface IUpdateFarmerData extends Partial<LocationData> {
  phone?: string;
  email?: string;
  password?: string;
}

export interface IUpdateRestaurantData extends Partial<LocationData> {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

export interface IUpdateAdminData extends Partial<LocationData> {
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
