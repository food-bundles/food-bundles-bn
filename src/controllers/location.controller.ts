import { Request, Response } from "express";
import { LocationValidationService } from "../services/location.service";

/**
 * Controller to get all provinces
 * GET /locations/provinces
 */
export const getAllProvinces = async (req: Request, res: Response) => {
  try {
    const provinces = LocationValidationService.getAllProvinces();

    res.status(200).json({
      message: "Provinces retrieved successfully",
      data: provinces,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get provinces",
    });
  }
};

/**
 * Controller to get all districts in a province
 * POST /locations/districts
 */
export const getDistrictsByProvince = async (req: Request, res: Response) => {
  try {
    const { province } = req.body;

    if (!province) {
      return res.status(400).json({
        message: "Province is required",
      });
    }

    // Validate province exists
    if (!LocationValidationService.validateProvince(province)) {
      const validProvinces = LocationValidationService.getAllProvinces();
      return res.status(404).json({
        message: `Province '${province}' not found`,
        validProvinces,
      });
    }

    const districts =
      LocationValidationService.getDistrictsByProvince(province);

    res.status(200).json({
      message: `Districts in ${province} retrieved successfully`,
      data: districts,
      province,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get districts",
    });
  }
};

/**
 * Controller to get all sectors in a district
 * POST /locations/sectors
 */
export const getSectorsByDistrict = async (req: Request, res: Response) => {
  try {
    const { province, district } = req.body;

    if (!province || !district) {
      return res.status(400).json({
        message: "Province and district are required",
      });
    }

    // Validate province exists
    if (!LocationValidationService.validateProvince(province)) {
      const validProvinces = LocationValidationService.getAllProvinces();
      return res.status(404).json({
        message: `Province '${province}' not found`,
        validProvinces,
      });
    }

    // Validate district exists
    if (!LocationValidationService.validateDistrict(province, district)) {
      const validDistricts =
        LocationValidationService.getDistrictsByProvince(province);
      return res.status(404).json({
        message: `District '${district}' not found in province '${province}'`,
        validDistricts,
        province,
      });
    }

    const sectors = LocationValidationService.getSectorsByDistrict(
      province,
      district
    );

    res.status(200).json({
      message: `Sectors in ${district}, ${province} retrieved successfully`,
      data: sectors,
      province,
      district,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get sectors",
    });
  }
};

/**
 * Controller to get all cells in a sector
 * POST /locations/cells
 */
export const getCellsBySector = async (req: Request, res: Response) => {
  try {
    const { province, district, sector } = req.body;

    if (!province || !district || !sector) {
      return res.status(400).json({
        message: "Province, district, and sector are required",
      });
    }

    // Validate province exists
    if (!LocationValidationService.validateProvince(province)) {
      const validProvinces = LocationValidationService.getAllProvinces();
      return res.status(404).json({
        message: `Province '${province}' not found`,
        validProvinces,
      });
    }

    // Validate district exists
    if (!LocationValidationService.validateDistrict(province, district)) {
      const validDistricts =
        LocationValidationService.getDistrictsByProvince(province);
      return res.status(404).json({
        message: `District '${district}' not found in province '${province}'`,
        validDistricts,
        province,
      });
    }

    // Validate sector exists
    if (!LocationValidationService.validateSector(province, district, sector)) {
      const validSectors = LocationValidationService.getSectorsByDistrict(
        province,
        district
      );
      return res.status(404).json({
        message: `Sector '${sector}' not found in district '${district}', province '${province}'`,
        validSectors,
        province,
        district,
      });
    }

    const cells = LocationValidationService.getCellsBySector(
      province,
      district,
      sector
    );

    res.status(200).json({
      message: `Cells in ${sector}, ${district}, ${province} retrieved successfully`,
      data: cells,
      province,
      district,
      sector,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get cells",
    });
  }
};

/**
 * Controller to get all villages in a cell
 * POST /locations/villages
 */
export const getVillagesByCell = async (req: Request, res: Response) => {
  try {
    const { province, district, sector, cell } = req.body;

    if (!province || !district || !sector || !cell) {
      return res.status(400).json({
        message: "Province, district, sector, and cell are required",
      });
    }

    // Validate province exists
    if (!LocationValidationService.validateProvince(province)) {
      const validProvinces = LocationValidationService.getAllProvinces();
      return res.status(404).json({
        message: `Province '${province}' not found`,
        validProvinces,
      });
    }

    // Validate district exists
    if (!LocationValidationService.validateDistrict(province, district)) {
      const validDistricts =
        LocationValidationService.getDistrictsByProvince(province);
      return res.status(404).json({
        message: `District '${district}' not found in province '${province}'`,
        validDistricts,
        province,
      });
    }

    // Validate sector exists
    if (!LocationValidationService.validateSector(province, district, sector)) {
      const validSectors = LocationValidationService.getSectorsByDistrict(
        province,
        district
      );
      return res.status(404).json({
        message: `Sector '${sector}' not found in district '${district}', province '${province}'`,
        validSectors,
        province,
        district,
      });
    }

    // Validate cell exists
    if (
      !LocationValidationService.validateCell(province, district, sector, cell)
    ) {
      const validCells = LocationValidationService.getCellsBySector(
        province,
        district,
        sector
      );
      return res.status(404).json({
        message: `Cell '${cell}' not found in sector '${sector}', district '${district}', province '${province}'`,
        validCells,
        province,
        district,
        sector,
      });
    }

    const villages = LocationValidationService.getVillagesByCell(
      province,
      district,
      sector,
      cell
    );

    res.status(200).json({
      message: `Villages in ${cell}, ${sector}, ${district}, ${province} retrieved successfully`,
      data: villages,
      province,
      district,
      sector,
      cell,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get villages",
    });
  }
};

/**
 * Controller to validate location hierarchy
 * POST /locations/validate
 */
export const validateLocationHierarchy = async (
  req: Request,
  res: Response
) => {
  try {
    const locationData = req.body;

    const validation =
      LocationValidationService.validateLocationHierarchy(locationData);

    if (validation.isValid) {
      res.status(200).json({
        message: "Location hierarchy is valid",
        isValid: true,
        data: locationData,
      });
    } else {
      res.status(400).json({
        message: "Location hierarchy is invalid",
        isValid: false,
        errors: validation.errors,
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to validate location hierarchy",
    });
  }
};
