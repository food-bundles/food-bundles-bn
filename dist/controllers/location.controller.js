"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLocationHierarchy = exports.getVillagesByCell = exports.getCellsBySector = exports.getSectorsByDistrict = exports.getDistrictsByProvince = exports.getAllProvinces = void 0;
const location_service_1 = require("../services/location.service");
/**
 * Controller to get all provinces
 * GET /locations/provinces
 */
const getAllProvinces = async (req, res) => {
    try {
        const provinces = location_service_1.LocationValidationService.getAllProvinces();
        res.status(200).json({
            message: "Provinces retrieved successfully",
            data: provinces,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get provinces",
        });
    }
};
exports.getAllProvinces = getAllProvinces;
/**
 * Controller to get all districts in a province
 * POST /locations/districts
 */
const getDistrictsByProvince = async (req, res) => {
    try {
        const { province } = req.body;
        if (!province) {
            return res.status(400).json({
                message: "Province is required",
            });
        }
        // Validate province exists
        if (!location_service_1.LocationValidationService.validateProvince(province)) {
            const validProvinces = location_service_1.LocationValidationService.getAllProvinces();
            return res.status(404).json({
                message: `Province '${province}' not found`,
                validProvinces,
            });
        }
        const districts = location_service_1.LocationValidationService.getDistrictsByProvince(province);
        res.status(200).json({
            message: `Districts in ${province} retrieved successfully`,
            data: districts,
            province,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get districts",
        });
    }
};
exports.getDistrictsByProvince = getDistrictsByProvince;
/**
 * Controller to get all sectors in a district
 * POST /locations/sectors
 */
const getSectorsByDistrict = async (req, res) => {
    try {
        const { province, district } = req.body;
        if (!province || !district) {
            return res.status(400).json({
                message: "Province and district are required",
            });
        }
        // Validate province exists
        if (!location_service_1.LocationValidationService.validateProvince(province)) {
            const validProvinces = location_service_1.LocationValidationService.getAllProvinces();
            return res.status(404).json({
                message: `Province '${province}' not found`,
                validProvinces,
            });
        }
        // Validate district exists
        if (!location_service_1.LocationValidationService.validateDistrict(province, district)) {
            const validDistricts = location_service_1.LocationValidationService.getDistrictsByProvince(province);
            return res.status(404).json({
                message: `District '${district}' not found in province '${province}'`,
                validDistricts,
                province,
            });
        }
        const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(province, district);
        res.status(200).json({
            message: `Sectors in ${district}, ${province} retrieved successfully`,
            data: sectors,
            province,
            district,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get sectors",
        });
    }
};
exports.getSectorsByDistrict = getSectorsByDistrict;
/**
 * Controller to get all cells in a sector
 * POST /locations/cells
 */
const getCellsBySector = async (req, res) => {
    try {
        const { province, district, sector } = req.body;
        if (!province || !district || !sector) {
            return res.status(400).json({
                message: "Province, district, and sector are required",
            });
        }
        // Validate province exists
        if (!location_service_1.LocationValidationService.validateProvince(province)) {
            const validProvinces = location_service_1.LocationValidationService.getAllProvinces();
            return res.status(404).json({
                message: `Province '${province}' not found`,
                validProvinces,
            });
        }
        // Validate district exists
        if (!location_service_1.LocationValidationService.validateDistrict(province, district)) {
            const validDistricts = location_service_1.LocationValidationService.getDistrictsByProvince(province);
            return res.status(404).json({
                message: `District '${district}' not found in province '${province}'`,
                validDistricts,
                province,
            });
        }
        // Validate sector exists
        if (!location_service_1.LocationValidationService.validateSector(province, district, sector)) {
            const validSectors = location_service_1.LocationValidationService.getSectorsByDistrict(province, district);
            return res.status(404).json({
                message: `Sector '${sector}' not found in district '${district}', province '${province}'`,
                validSectors,
                province,
                district,
            });
        }
        const cells = location_service_1.LocationValidationService.getCellsBySector(province, district, sector);
        res.status(200).json({
            message: `Cells in ${sector}, ${district}, ${province} retrieved successfully`,
            data: cells,
            province,
            district,
            sector,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get cells",
        });
    }
};
exports.getCellsBySector = getCellsBySector;
/**
 * Controller to get all villages in a cell
 * POST /locations/villages
 */
const getVillagesByCell = async (req, res) => {
    try {
        const { province, district, sector, cell } = req.body;
        if (!province || !district || !sector || !cell) {
            return res.status(400).json({
                message: "Province, district, sector, and cell are required",
            });
        }
        // Validate province exists
        if (!location_service_1.LocationValidationService.validateProvince(province)) {
            const validProvinces = location_service_1.LocationValidationService.getAllProvinces();
            return res.status(404).json({
                message: `Province '${province}' not found`,
                validProvinces,
            });
        }
        // Validate district exists
        if (!location_service_1.LocationValidationService.validateDistrict(province, district)) {
            const validDistricts = location_service_1.LocationValidationService.getDistrictsByProvince(province);
            return res.status(404).json({
                message: `District '${district}' not found in province '${province}'`,
                validDistricts,
                province,
            });
        }
        // Validate sector exists
        if (!location_service_1.LocationValidationService.validateSector(province, district, sector)) {
            const validSectors = location_service_1.LocationValidationService.getSectorsByDistrict(province, district);
            return res.status(404).json({
                message: `Sector '${sector}' not found in district '${district}', province '${province}'`,
                validSectors,
                province,
                district,
            });
        }
        // Validate cell exists
        if (!location_service_1.LocationValidationService.validateCell(province, district, sector, cell)) {
            const validCells = location_service_1.LocationValidationService.getCellsBySector(province, district, sector);
            return res.status(404).json({
                message: `Cell '${cell}' not found in sector '${sector}', district '${district}', province '${province}'`,
                validCells,
                province,
                district,
                sector,
            });
        }
        const villages = location_service_1.LocationValidationService.getVillagesByCell(province, district, sector, cell);
        res.status(200).json({
            message: `Villages in ${cell}, ${sector}, ${district}, ${province} retrieved successfully`,
            data: villages,
            province,
            district,
            sector,
            cell,
        });
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to get villages",
        });
    }
};
exports.getVillagesByCell = getVillagesByCell;
/**
 * Controller to validate location hierarchy
 * POST /locations/validate
 */
const validateLocationHierarchy = async (req, res) => {
    try {
        const locationData = req.body;
        const validation = location_service_1.LocationValidationService.validateLocationHierarchy(locationData);
        if (validation.isValid) {
            res.status(200).json({
                message: "Location hierarchy is valid",
                isValid: true,
                data: locationData,
            });
        }
        else {
            res.status(400).json({
                message: "Location hierarchy is invalid",
                isValid: false,
                errors: validation.errors,
            });
        }
    }
    catch (error) {
        res.status(500).json({
            message: error.message || "Failed to validate location hierarchy",
        });
    }
};
exports.validateLocationHierarchy = validateLocationHierarchy;
