"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationValidationService = void 0;
const locations_json_1 = __importDefault(require("../config/locations.json"));
// Type the imported JSON data
const typedLocations = locations_json_1.default;
class LocationValidationService {
    /**
     * Validates if a province exists
     */
    static validateProvince(provinceName) {
        return typedLocations.provinces.some((province) => province.name === provinceName);
    }
    /**
     * Validates if a district exists in a given province
     */
    static validateDistrict(provinceName, districtName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return false;
        return province.districts.some((district) => district.name === districtName);
    }
    /**
     * Validates if a sector exists in a given district and province
     */
    static validateSector(provinceName, districtName, sectorName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return false;
        const district = province.districts.find((d) => d.name === districtName);
        if (!district)
            return false;
        return district.sectors.some((sector) => sector.name === sectorName);
    }
    /**
     * Validates if a cell exists in a given sector, district, and province
     */
    static validateCell(provinceName, districtName, sectorName, cellName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return false;
        const district = province.districts.find((d) => d.name === districtName);
        if (!district)
            return false;
        const sector = district.sectors.find((s) => s.name === sectorName);
        if (!sector)
            return false;
        return sector.cells.some((cell) => cell.name === cellName);
    }
    /**
     * Validates if a village exists in a given cell, sector, district, and province
     */
    static validateVillage(provinceName, districtName, sectorName, cellName, villageName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return false;
        const district = province.districts.find((d) => d.name === districtName);
        if (!district)
            return false;
        const sector = district.sectors.find((s) => s.name === sectorName);
        if (!sector)
            return false;
        const cell = sector.cells.find((c) => c.name === cellName);
        if (!cell)
            return false;
        return cell.villages.some((village) => village.name === villageName);
    }
    /**
     * Validates a complete location hierarchy
     */
    static validateLocationHierarchy(locationData) {
        const errors = [];
        if (!locationData.province &&
            !locationData.district &&
            !locationData.sector &&
            !locationData.cell &&
            !locationData.village) {
            return { isValid: true, errors: [] }; // No location data provided, which is allowed
        }
        // If any location field is provided, validate the hierarchy
        if (locationData.province) {
            if (!this.validateProvince(locationData.province)) {
                const validProvinces = this.getAllProvinces();
                errors.push(`Invalid province: ${locationData.province}. Valid provinces are: ${validProvinces.join(", ")}`);
                return { isValid: false, errors };
            }
            if (locationData.district) {
                if (!this.validateDistrict(locationData.province, locationData.district)) {
                    const validDistricts = this.getDistrictsByProvince(locationData.province);
                    errors.push(`Invalid district: ${locationData.district} in province ${locationData.province}. Valid districts are: ${validDistricts.join(", ")}`);
                    return { isValid: false, errors };
                }
                if (locationData.sector) {
                    if (!this.validateSector(locationData.province, locationData.district, locationData.sector)) {
                        const validSectors = this.getSectorsByDistrict(locationData.province, locationData.district);
                        errors.push(`Invalid sector: ${locationData.sector} in district ${locationData.district}, province ${locationData.province}. Valid sectors are: ${validSectors.join(", ")}`);
                        return { isValid: false, errors };
                    }
                    if (locationData.cell) {
                        if (!this.validateCell(locationData.province, locationData.district, locationData.sector, locationData.cell)) {
                            const validCells = this.getCellsBySector(locationData.province, locationData.district, locationData.sector);
                            errors.push(`Invalid cell: ${locationData.cell} in sector ${locationData.sector}, district ${locationData.district}, province ${locationData.province}. Valid cells are: ${validCells.join(", ")}`);
                            return { isValid: false, errors };
                        }
                        if (locationData.village) {
                            if (!this.validateVillage(locationData.province, locationData.district, locationData.sector, locationData.cell, locationData.village)) {
                                const validVillages = this.getVillagesByCell(locationData.province, locationData.district, locationData.sector, locationData.cell);
                                errors.push(`Invalid village: ${locationData.village} in cell ${locationData.cell}, sector ${locationData.sector}, district ${locationData.district}, province ${locationData.province}. Valid villages are: ${validVillages.join(", ")}`);
                                return { isValid: false, errors };
                            }
                        }
                    }
                }
            }
        }
        // Check for incomplete hierarchy
        if (locationData.district && !locationData.province) {
            const validProvinces = this.getAllProvinces();
            errors.push(`Province is required when district is provided. Valid provinces are: ${validProvinces.join(", ")}`);
        }
        if (locationData.sector &&
            (!locationData.province || !locationData.district)) {
            if (!locationData.province) {
                const validProvinces = this.getAllProvinces();
                errors.push(`Province is required when sector is provided. Valid provinces are: ${validProvinces.join(", ")}`);
            }
            else if (!locationData.district) {
                const validDistricts = this.getDistrictsByProvince(locationData.province);
                errors.push(`District is required when sector is provided. Valid districts for ${locationData.province} are: ${validDistricts.join(", ")}`);
            }
        }
        if (locationData.cell &&
            (!locationData.province || !locationData.district || !locationData.sector)) {
            if (!locationData.province) {
                const validProvinces = this.getAllProvinces();
                errors.push(`Province is required when cell is provided. Valid provinces are: ${validProvinces.join(", ")}`);
            }
            else if (!locationData.district) {
                const validDistricts = this.getDistrictsByProvince(locationData.province);
                errors.push(`District is required when cell is provided. Valid districts for ${locationData.province} are: ${validDistricts.join(", ")}`);
            }
            else if (!locationData.sector) {
                const validSectors = this.getSectorsByDistrict(locationData.province, locationData.district);
                errors.push(`Sector is required when cell is provided. Valid sectors for ${locationData.district}, ${locationData.province} are: ${validSectors.join(", ")}`);
            }
        }
        if (locationData.village &&
            (!locationData.province ||
                !locationData.district ||
                !locationData.sector ||
                !locationData.cell)) {
            if (!locationData.province) {
                const validProvinces = this.getAllProvinces();
                errors.push(`Province is required when village is provided. Valid provinces are: ${validProvinces.join(", ")}`);
            }
            else if (!locationData.district) {
                const validDistricts = this.getDistrictsByProvince(locationData.province);
                errors.push(`District is required when village is provided. Valid districts for ${locationData.province} are: ${validDistricts.join(", ")}`);
            }
            else if (!locationData.sector) {
                const validSectors = this.getSectorsByDistrict(locationData.province, locationData.district);
                errors.push(`Sector is required when village is provided. Valid sectors for ${locationData.district}, ${locationData.province} are: ${validSectors.join(", ")}`);
            }
            else if (!locationData.cell) {
                const validCells = this.getCellsBySector(locationData.province, locationData.district, locationData.sector);
                errors.push(`Cell is required when village is provided. Valid cells for ${locationData.sector}, ${locationData.district}, ${locationData.province} are: ${validCells.join(", ")}`);
            }
        }
        return { isValid: errors.length === 0, errors };
    }
    /**
     * Get all provinces
     */
    static getAllProvinces() {
        return typedLocations.provinces.map((province) => province.name);
    }
    /**
     * Get all districts in a province
     */
    static getDistrictsByProvince(provinceName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        return province ? province.districts.map((d) => d.name) : [];
    }
    /**
     * Get all sectors in a district
     */
    static getSectorsByDistrict(provinceName, districtName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return [];
        const district = province.districts.find((d) => d.name === districtName);
        return district ? district.sectors.map((s) => s.name) : [];
    }
    /**
     * Get all cells in a sector
     */
    static getCellsBySector(provinceName, districtName, sectorName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return [];
        const district = province.districts.find((d) => d.name === districtName);
        if (!district)
            return [];
        const sector = district.sectors.find((s) => s.name === sectorName);
        return sector ? sector.cells.map((c) => c.name) : [];
    }
    /**
     * Get all villages in a cell
     */
    static getVillagesByCell(provinceName, districtName, sectorName, cellName) {
        const province = typedLocations.provinces.find((p) => p.name === provinceName);
        if (!province)
            return [];
        const district = province.districts.find((d) => d.name === districtName);
        if (!district)
            return [];
        const sector = district.sectors.find((s) => s.name === sectorName);
        if (!sector)
            return [];
        const cell = sector.cells.find((c) => c.name === cellName);
        return cell ? cell.villages.map((v) => v.name) : [];
    }
}
exports.LocationValidationService = LocationValidationService;
