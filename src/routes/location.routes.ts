import { Router } from "express";
import {
  getAllProvinces,
  getDistrictsByProvince,
  getSectorsByDistrict,
  getCellsBySector,
  getVillagesByCell,
  validateLocationHierarchy,
} from "../controllers/location.controller";

const locationRoutes = Router();

// ========================================
// PUBLIC LOCATION ROUTES
// ========================================

/**
 * Get all provinces
 * GET /locations/provinces
 * Access: Public
 */
locationRoutes.get("/provinces", getAllProvinces);

/**
 * Get all districts in a province
 * POST /locations/districts
 * Body: { province: string }
 * Access: Public
 */
locationRoutes.post("/districts", getDistrictsByProvince);

/**
 * Get all sectors in a district
 * POST /locations/sectors
 * Body: { province: string, district: string }
 * Access: Public
 */
locationRoutes.post("/sectors", getSectorsByDistrict);

/**
 * Get all cells in a sector
 * POST /locations/cells
 * Body: { province: string, district: string, sector: string }
 * Access: Public
 */
locationRoutes.post("/cells", getCellsBySector);

/**
 * Get all villages in a cell
 * POST /locations/villages
 * Body: { province: string, district: string, sector: string, cell: string }
 * Access: Public
 */
locationRoutes.post("/villages", getVillagesByCell);

/**
 * Validate location hierarchy
 * POST /locations/validate
 * Body: LocationData (optional fields)
 * Access: Public
 */
locationRoutes.post("/validate", validateLocationHierarchy);

export default locationRoutes;
