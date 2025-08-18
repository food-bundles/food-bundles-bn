import { Role } from "@prisma/client";


export interface IUssdRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
}

export interface ISessionData {
  location?: string;
  password?: string;
  confirmPassword?: string;
  selectedProduct?: string;
  quantity?: string;
  mode?: "register" | "submit";
  wishedPrice?: string;
}

export  interface ICreateFarmerData {
  location: string;
  phone?: string;
  email?: string;
  password?: string;
}

export interface ICreateRestaurantData {
  name: string;
  email: string;
  phone?: string;
  location: string;
  password: string;
}

export interface ICreateAdminData {
  username: string;
  email: string;
  password: string;
  role: Role;
}

export interface IUpdateFarmerData {
  location?: string;
  phone?: string;
  email?: string;
  password?: string;
}

export interface IUpdateRestaurantData {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  password?: string;
}

export interface IUpdateAdminData {
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
  