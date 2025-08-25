import { ProductCategory } from "@prisma/client";

export interface ProductSubmissionInput {
  farmerId: string;
  productName: string;
  category: ProductCategory;
  submittedQty: number;
  wishedPrice: number;
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
}

// Enhanced session data for USSD
export interface ISessionData {
  mode?: "register" | "submit";

  // Registration location flow
  locationStep?:
    | "province"
    | "district"
    | "sector"
    | "cell"
    | "village"
    | "completed";
  locationPage?: number;
  selectedProvince?: string;
  selectedDistrict?: string;
  selectedSector?: string;
  selectedCell?: string;
  selectedVillage?: string;

  // Registration data
  password?: string;

  // Product submission flow
  productPage?: number;
  selectedProduct?: string;
  quantity?: string;
  wishedPrice?: string;
}

export interface IUssdRequest {
  sessionId: string;
  serviceCode?: string;
  phoneNumber: string;
  text: string;
}

// Location validation response
export interface LocationValidationResult {
  isValid: boolean;
  errors: string[];
}

// Paginated location response
export interface PaginatedLocationResponse {
  items: string[];
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
