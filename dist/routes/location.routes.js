"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const location_controller_1 = require("../controllers/location.controller");
const locationRoutes = (0, express_1.Router)();
// ========================================
// PUBLIC LOCATION ROUTES
// ========================================
/**
 * Get all provinces
 * GET /locations/provinces
 * Access: Public
 */
locationRoutes.get("/provinces", location_controller_1.getAllProvinces);
/**
 * Get all districts in a province
 * POST /locations/districts
 * Body: { province: string }
 * Access: Public
 */
locationRoutes.post("/districts", location_controller_1.getDistrictsByProvince);
/**
 * Get all sectors in a district
 * POST /locations/sectors
 * Body: { province: string, district: string }
 * Access: Public
 */
locationRoutes.post("/sectors", location_controller_1.getSectorsByDistrict);
/**
 * Get all cells in a sector
 * POST /locations/cells
 * Body: { province: string, district: string, sector: string }
 * Access: Public
 */
locationRoutes.post("/cells", location_controller_1.getCellsBySector);
/**
 * Get all villages in a cell
 * POST /locations/villages
 * Body: { province: string, district: string, sector: string, cell: string }
 * Access: Public
 */
locationRoutes.post("/villages", location_controller_1.getVillagesByCell);
/**
 * Validate location hierarchy
 * POST /locations/validate
 * Body: LocationData (optional fields)
 * Access: Public
 */
locationRoutes.post("/validate", location_controller_1.validateLocationHierarchy);
exports.default = locationRoutes;
