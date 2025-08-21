import Locations from "../config/locations.json";
import {
  LocationsData,
  Province,
  District,
  Sector,
  Cell,
  Village,
} from "../types/locationTypes";

// Type the imported JSON data
const typedLocations = Locations as LocationsData;

export interface LocationData {
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
}

export class LocationValidationService {
  /**
   * Validates if a province exists
   */
  static validateProvince(provinceName: string): boolean {
    return typedLocations.provinces.some(
      (province: Province) => province.name === provinceName
    );
  }

  /**
   * Validates if a district exists in a given province
   */
  static validateDistrict(provinceName: string, districtName: string): boolean {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return false;

    return province.districts.some(
      (district: District) => district.name === districtName
    );
  }

  /**
   * Validates if a sector exists in a given district and province
   */
  static validateSector(
    provinceName: string,
    districtName: string,
    sectorName: string
  ): boolean {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return false;

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    if (!district) return false;

    return district.sectors.some(
      (sector: Sector) => sector.name === sectorName
    );
  }

  /**
   * Validates if a cell exists in a given sector, district, and province
   */
  static validateCell(
    provinceName: string,
    districtName: string,
    sectorName: string,
    cellName: string
  ): boolean {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return false;

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    if (!district) return false;

    const sector = district.sectors.find((s: Sector) => s.name === sectorName);
    if (!sector) return false;

    return sector.cells.some((cell: Cell) => cell.name === cellName);
  }

  /**
   * Validates if a village exists in a given cell, sector, district, and province
   */
  static validateVillage(
    provinceName: string,
    districtName: string,
    sectorName: string,
    cellName: string,
    villageName: string
  ): boolean {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return false;

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    if (!district) return false;

    const sector = district.sectors.find((s: Sector) => s.name === sectorName);
    if (!sector) return false;

    const cell = sector.cells.find((c: Cell) => c.name === cellName);
    if (!cell) return false;

    return cell.villages.some(
      (village: Village) => village.name === villageName
    );
  }

  /**
   * Validates a complete location hierarchy
   */
  static validateLocationHierarchy(locationData: LocationData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (
      !locationData.province &&
      !locationData.district &&
      !locationData.sector &&
      !locationData.cell &&
      !locationData.village
    ) {
      return { isValid: true, errors: [] }; // No location data provided, which is allowed
    }

    // If any location field is provided, validate the hierarchy
    if (locationData.province) {
      if (!this.validateProvince(locationData.province)) {
        errors.push(`Invalid province: ${locationData.province}`);
        return { isValid: false, errors };
      }

      if (locationData.district) {
        if (
          !this.validateDistrict(locationData.province, locationData.district)
        ) {
          errors.push(
            `Invalid district: ${locationData.district} in province ${locationData.province}`
          );
          return { isValid: false, errors };
        }

        if (locationData.sector) {
          if (
            !this.validateSector(
              locationData.province,
              locationData.district,
              locationData.sector
            )
          ) {
            errors.push(
              `Invalid sector: ${locationData.sector} in district ${locationData.district}, province ${locationData.province}`
            );
            return { isValid: false, errors };
          }

          if (locationData.cell) {
            if (
              !this.validateCell(
                locationData.province,
                locationData.district,
                locationData.sector,
                locationData.cell
              )
            ) {
              errors.push(
                `Invalid cell: ${locationData.cell} in sector ${locationData.sector}, district ${locationData.district}, province ${locationData.province}`
              );
              return { isValid: false, errors };
            }

            if (locationData.village) {
              if (
                !this.validateVillage(
                  locationData.province,
                  locationData.district,
                  locationData.sector,
                  locationData.cell,
                  locationData.village
                )
              ) {
                errors.push(
                  `Invalid village: ${locationData.village} in cell ${locationData.cell}, sector ${locationData.sector}, district ${locationData.district}, province ${locationData.province}`
                );
                return { isValid: false, errors };
              }
            }
          }
        }
      }
    }

    // Check for incomplete hierarchy
    if (locationData.district && !locationData.province) {
      errors.push("Province is required when district is provided");
    }
    if (
      locationData.sector &&
      (!locationData.province || !locationData.district)
    ) {
      errors.push("Province and district are required when sector is provided");
    }
    if (
      locationData.cell &&
      (!locationData.province || !locationData.district || !locationData.sector)
    ) {
      errors.push(
        "Province, district, and sector are required when cell is provided"
      );
    }
    if (
      locationData.village &&
      (!locationData.province ||
        !locationData.district ||
        !locationData.sector ||
        !locationData.cell)
    ) {
      errors.push(
        "Province, district, sector, and cell are required when village is provided"
      );
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Get all provinces
   */
  static getAllProvinces(): string[] {
    return typedLocations.provinces.map((province: Province) => province.name);
  }

  /**
   * Get all districts in a province
   */
  static getDistrictsByProvince(provinceName: string): string[] {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    return province ? province.districts.map((d: District) => d.name) : [];
  }

  /**
   * Get all sectors in a district
   */
  static getSectorsByDistrict(
    provinceName: string,
    districtName: string
  ): string[] {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return [];

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    return district ? district.sectors.map((s: Sector) => s.name) : [];
  }

  /**
   * Get all cells in a sector
   */
  static getCellsBySector(
    provinceName: string,
    districtName: string,
    sectorName: string
  ): string[] {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return [];

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    if (!district) return [];

    const sector = district.sectors.find((s: Sector) => s.name === sectorName);
    return sector ? sector.cells.map((c: Cell) => c.name) : [];
  }

  /**
   * Get all villages in a cell
   */
  static getVillagesByCell(
    provinceName: string,
    districtName: string,
    sectorName: string,
    cellName: string
  ): string[] {
    const province = typedLocations.provinces.find(
      (p: Province) => p.name === provinceName
    );
    if (!province) return [];

    const district = province.districts.find(
      (d: District) => d.name === districtName
    );
    if (!district) return [];

    const sector = district.sectors.find((s: Sector) => s.name === sectorName);
    if (!sector) return [];

    const cell = sector.cells.find((c: Cell) => c.name === cellName);
    return cell ? cell.villages.map((v: Village) => v.name) : [];
  }
}
