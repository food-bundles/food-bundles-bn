import prisma from "../prisma";
import {
  ISessionData,
  IUssdRequest,
  TranslationKey,
  translations,
} from "../types/productTypes";
import { ActivityMonitoringService } from "./activityMonitoring.service";
import { AnalyticsEarningsService } from "./analyticsEarnings.service";
import { FarmingProfileService } from "./farmingProfile.service";
import { LocationValidationService } from "./location.service";
import { PinManagementService } from "./pinManagement.service";
import { ProfileManagementService } from "./profileManagement.service";
import { SupportService } from "./support.service";
import { comparePassword, hashPassword } from "../utils/password";
import { ProductData } from "./productService";

let ussdSessions: Record<string, ISessionData> = {};

// Helper function to get translation
function getTranslation(
  lang: "KINY" | "ENG" | "FRE" = "KINY",
  key: TranslationKey
): string {
  return translations[lang][key] || translations.ENG[key];
}

// Helper function to get user's preferred language from database
async function getUserLanguage(
  phoneNumber: string
): Promise<"KINY" | "ENG" | "FRE"> {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { phone: phoneNumber },
      select: { preferredLanguage: true },
    });

    return (farmer?.preferredLanguage as "KINY" | "ENG" | "FRE") || "KINY";
  } catch (error) {
    console.error("Error fetching user language:", error);
    return "KINY";
  }
}

// Helper function to update user's language preference in database
async function updateUserLanguage(
  phoneNumber: string,
  language: "KINY" | "ENG" | "FRE"
): Promise<void> {
  try {
    await prisma.farmer.update({
      where: { phone: phoneNumber },
      data: { preferredLanguage: language },
    });
  } catch (error) {
    console.error("Error updating user language:", error);
    throw new Error("Failed to update language preference");
  }
}

// Get active product categories from database
export async function getActiveProductCategories(): Promise<
  Array<{ id: string; name: string }>
> {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

// Get products by category from database with unit information
export async function getProductsByCategory(
  categoryId: string
): Promise<Array<{ productName: string; unit: string }>> {
  try {
    const products = await prisma.product.findMany({
      where: {
        categoryId: categoryId,
        status: "ACTIVE",
      },
      select: { productName: true, unit: true },
      orderBy: { productName: "asc" },
    });
    return products;
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return [];
  }
}

// Location pagination helper
function paginateLocationList(
  items: string[],
  page: number,
  limit: number = 6
) {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedItems = items.slice(startIndex, endIndex);
  const totalPages = Math.ceil(items.length / limit);

  return {
    items: paginatedItems,
    currentPage: page,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// Build location menu with pagination and back option
function buildLocationMenu(
  items: string[],
  page: number,
  titleKey: TranslationKey,
  lang: "KINY" | "ENG" | "FRE" = "KINY",
  backOption: boolean = true
): string {
  const paginated = paginateLocationList(items, page);
  let menu = `CON ${getTranslation(lang, titleKey)}\n`;

  // Add items with proper numbering
  paginated.items.forEach((item, index) => {
    const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
    menu += `${itemNumber}. ${item}\n`;
  });

  // Add navigation options
  let navOptions: string[] = [];

  if (paginated.hasPrev) {
    navOptions.push(`98. ${getTranslation(lang, "previous")}`);
  }
  if (paginated.hasNext) {
    navOptions.push(`99. ${getTranslation(lang, "next")}`);
  }

  if (backOption) {
    navOptions.push(`0. ${getTranslation(lang, "back")}`);
  }

  if (navOptions.length > 0) {
    menu += navOptions.join("\n");
  }

  return menu;
}

// Function to handle location updates for profile
async function handleLocationUpdate(
  parts: string[],
  session: ISessionData,
  lang: "KINY" | "ENG" | "FRE",
  phoneNumber: string
): Promise<string> {
  const currentInput = parts[parts.length - 1];

  // Handle province selection
  if (session.locationStep === "province") {
    const provinces = LocationValidationService.getAllProvinces();

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang,
        true
      );
    }

    if (currentInput === "0") {
      session.locationStep = undefined;
      session.locationPage = undefined;
      return await showUpdateProfileMenu(lang);
    }

    const provinceIndex = parseInt(currentInput) - 1;
    if (provinceIndex >= 0 && provinceIndex < provinces.length) {
      session.selectedProvince = provinces[provinceIndex];
      session.locationStep = "district";
      session.locationPage = 1;

      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang, true);
    }

    return buildLocationMenu(
      provinces,
      session.locationPage || 1,
      "selectProvince",
      lang,
      true
    );
  }

  // Handle district selection
  if (session.locationStep === "district") {
    const districts = LocationValidationService.getDistrictsByProvince(
      session.selectedProvince!
    );

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        true
      );
    }

    if (currentInput === "0") {
      session.locationStep = "province";
      session.locationPage = 1;
      const provinces = LocationValidationService.getAllProvinces();
      return buildLocationMenu(provinces, 1, "selectProvince", lang, true);
    }

    const districtIndex = parseInt(currentInput) - 1;
    if (districtIndex >= 0 && districtIndex < districts.length) {
      session.selectedDistrict = districts[districtIndex];
      session.locationStep = "sector";
      session.locationPage = 1;

      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang, true);
    }

    return buildLocationMenu(
      districts,
      session.locationPage || 1,
      "selectDistrict",
      lang,
      true
    );
  }

  // Handle sector selection
  if (session.locationStep === "sector") {
    const sectors = LocationValidationService.getSectorsByDistrict(
      session.selectedProvince!,
      session.selectedDistrict!
    );

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang,
        true
      );
    }

    if (currentInput === "0") {
      session.locationStep = "district";
      session.locationPage = 1;
      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince!
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang, true);
    }

    const sectorIndex = parseInt(currentInput) - 1;
    if (sectorIndex >= 0 && sectorIndex < sectors.length) {
      session.selectedSector = sectors[sectorIndex];
      session.locationStep = "cell";
      session.locationPage = 1;

      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector
      );
      return buildLocationMenu(cells, 1, "selectCell", lang, true);
    }

    return buildLocationMenu(
      sectors,
      session.locationPage || 1,
      "selectSector",
      lang,
      true
    );
  }

  // Handle cell selection
  if (session.locationStep === "cell") {
    const cells = LocationValidationService.getCellsBySector(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!
    );

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        cells,
        session.locationPage,
        "selectCell",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        cells,
        session.locationPage,
        "selectCell",
        lang,
        true
      );
    }

    if (currentInput === "0") {
      session.locationStep = "sector";
      session.locationPage = 1;
      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict!
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang, true);
    }

    const cellIndex = parseInt(currentInput) - 1;
    if (cellIndex >= 0 && cellIndex < cells.length) {
      session.selectedCell = cells[cellIndex];
      session.locationStep = "village";
      session.locationPage = 1;

      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell
      );
      return buildLocationMenu(villages, 1, "selectVillage", lang, true);
    }

    return buildLocationMenu(
      cells,
      session.locationPage || 1,
      "selectCell",
      lang,
      true
    );
  }

  // Handle village selection
  if (session.locationStep === "village") {
    const villages = LocationValidationService.getVillagesByCell(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!,
      session.selectedCell!
    );

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang,
        true
      );
    }

    if (currentInput === "0") {
      session.locationStep = "cell";
      session.locationPage = 1;
      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!
      );
      return buildLocationMenu(cells, 1, "selectCell", lang, true);
    }

    const villageIndex = parseInt(currentInput) - 1;
    if (villageIndex >= 0 && villageIndex < villages.length) {
      session.selectedVillage = villages[villageIndex];
      session.locationStep = "confirm_location";

      return `CON ${getTranslation(lang, "confirmLocationUpdate")}
${getTranslation(lang, "province")}: ${session.selectedProvince}
${getTranslation(lang, "district")}: ${session.selectedDistrict}
${getTranslation(lang, "sector")}: ${session.selectedSector}
${getTranslation(lang, "cell")}: ${session.selectedCell}
${getTranslation(lang, "village")}: ${session.selectedVillage}

1. ${getTranslation(lang, "confirm")}
2. ${getTranslation(lang, "cancel")}
0. ${getTranslation(lang, "back")}`;
    }

    return buildLocationMenu(
      villages,
      session.locationPage || 1,
      "selectVillage",
      lang,
      true
    );
  }

  // Handle location confirmation
  if (session.locationStep === "confirm_location") {
    if (currentInput === "1") {
      // Confirm and update location
      try {
        const success = await ProfileManagementService.updateLocation(
          phoneNumber,
          {
            province: session.selectedProvince!,
            district: session.selectedDistrict!,
            sector: session.selectedSector!,
            cell: session.selectedCell!,
            village: session.selectedVillage!,
          }
        );

        if (success) {
          // Clear location session data
          session.locationStep = undefined;
          session.locationPage = undefined;
          session.selectedProvince = undefined;
          session.selectedDistrict = undefined;
          session.selectedSector = undefined;
          session.selectedCell = undefined;
          session.selectedVillage = undefined;

          return `END ${getTranslation(lang, "locationUpdatedSuccessfully")}`;
        } else {
          return `END ${getTranslation(lang, "locationUpdateFailed")}`;
        }
      } catch (error) {
        console.error("Location update error:", error);
        return `END ${getTranslation(lang, "locationUpdateFailed")}`;
      }
    }

    if (currentInput === "2" || currentInput === "0") {
      // Cancel or go back to village selection
      session.locationStep = "village";
      session.locationPage = 1;
      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell!
      );
      return buildLocationMenu(villages, 1, "selectVillage", lang, true);
    }
  }

  return `END ${getTranslation(lang, "invalidInput")}`;
}

// Helper function to check if user exists
async function checkUserExists(phoneNumber: string): Promise<boolean> {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { phone: phoneNumber },
      select: { id: true },
    });
    return !!farmer;
  } catch (error) {
    console.error("Error checking user existence:", error);
    return false;
  }
}

// Language selection menu
function showLanguageSelection(lang: "KINY" | "ENG" | "FRE" = "KINY"): string {
  return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English  
3. Français`;
}

// Helper function to handle back navigation
async function handleBackNavigation(
  session: ISessionData,
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  if (!session.previousSteps || session.previousSteps.length === 0) {
    return showMainMenu(lang);
  }

  const previousStep = session.previousSteps.pop();

  // Clear current step data when going back
  session.currentStep = undefined;
  session.stepData = undefined;

  switch (previousStep?.step) {
    case "mainMenu":
      return showMainMenu(lang);
    case "accountMenu":
      return showAccountMenu(lang);
    case "categoryMenu":
      return await buildCategoryMenu(lang, session.categoryPage || 1);
    case "productMenu":
      // Return to product selection with proper pagination
      const products = await getProductsByCategory(session.selectedCategory!);
      return buildProductMenu(products, session.productPage || 1, lang);
    // Add more cases for other steps
    default:
      return showMainMenu(lang);
  }
}

function showMainMenu(lang: "KINY" | "ENG" | "FRE" = "KINY"): string {
  return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
}

function showAccountMenu(lang: "KINY" | "ENG" | "FRE" = "KINY"): string {
  return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
}

function buildProductMenu(
  products: any[],
  page: number = 1,
  lang: "KINY" | "ENG" | "FRE" = "KINY"
): string {
  const paginated = paginateLocationList(products, page);

  let menu = `CON ${getTranslation(lang, "selectProduct")}\n`;

  paginated.items.forEach((product: any, index) => {
    const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
    menu += `${itemNumber}. ${product.prodcutName}\n`;
  });

  // Add navigation options
  let navOptions: string[] = [];
  if (paginated.hasPrev) {
    navOptions.push(`98. ${getTranslation(lang, "previous")}`);
  }
  if (paginated.hasNext) {
    navOptions.push(`99. ${getTranslation(lang, "next")}`);
  }

  navOptions.push(`0. ${getTranslation(lang, "back")}`);

  return `${menu}${navOptions.join("\n")}`;
}

// Build product category menu
async function buildCategoryMenu(
  lang: "KINY" | "ENG" | "FRE" = "KINY",
  page: number = 1
): Promise<string> {
  const categories = await getActiveProductCategories();
  const categoryNames = categories.map((category) => category.name);
  const paginated = paginateLocationList(categoryNames, page);

  let menu = `CON ${getTranslation(lang, "selectCategory")}\n`;

  paginated.items.forEach((category, index) => {
    const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
    menu += `${itemNumber}. ${category}\n`;
  });

  // Add navigation options
  let navOptions: string[] = [];
  if (paginated.hasPrev) {
    navOptions.push(`98. ${getTranslation(lang, "previous")}`);
  }
  if (paginated.hasNext) {
    navOptions.push(`99. ${getTranslation(lang, "next")}`);
  }

  navOptions.push(`0. ${getTranslation(lang, "back")}`);

  if (navOptions.length > 0) {
    menu += navOptions.join("\n");
  }

  return menu;
}

// Add step to navigation history
function addToHistory(session: ISessionData, step: string, data?: any) {
  if (!session.previousSteps) {
    session.previousSteps = [];
  }
  session.previousSteps.push({ step, data });
}

// Helper function to verify user PIN
async function verifyUserPin(
  phoneNumber: string,
  pin: string
): Promise<{ isValid: boolean; message?: TranslationKey }> {
  try {
    if (!/^\d{4}$/.test(pin)) {
      return { isValid: false, message: "invalidPinFormat" };
    }

    const farmer = await prisma.farmer.findUnique({
      where: { phone: phoneNumber },
      select: { password: true },
    });

    if (!farmer) return { isValid: false, message: "userNotFound" };

    const isValid = await comparePassword(pin, farmer.password!);
    return { isValid, message: isValid ? undefined : "incorrectPin" };
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return { isValid: false, message: "pinVerificationFailed" };
  }
}

// Handle registration flow with improved back navigation
async function handleRegistration(
  parts: string[],
  session: ISessionData,
  lang: "KINY" | "ENG" | "FRE",
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  console.log(
    `Registration flow - Step: ${session.locationStep}, Parts: ${JSON.stringify(
      parts
    )}`
  );

  const currentInput = parts[parts.length - 1];

  // Handle province selection
  if (session.locationStep === "province") {
    const provinces = LocationValidationService.getAllProvinces();

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang,
        false
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang,
        false
      );
    }

    const provinceIndex = parseInt(currentInput) - 1;
    if (provinceIndex >= 0 && provinceIndex < provinces.length) {
      session.selectedProvince = provinces[provinceIndex];
      session.locationStep = "district";
      session.locationPage = 1;

      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang, true);
    }

    return buildLocationMenu(
      provinces,
      session.locationPage || 1,
      "selectProvince",
      lang,
      false
    );
  }

  // Handle district selection
  if (session.locationStep === "district") {
    const districts = LocationValidationService.getDistrictsByProvince(
      session.selectedProvince!
    );

    if (currentInput === "0") {
      session.locationStep = "province";
      session.locationPage = 1;
      const provinces = LocationValidationService.getAllProvinces();
      return buildLocationMenu(provinces, 1, "selectProvince", lang, false);
    }

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        true
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        true
      );
    }

    const districtIndex = parseInt(currentInput) - 1;
    if (districtIndex >= 0 && districtIndex < districts.length) {
      session.selectedDistrict = districts[districtIndex];
      session.locationStep = "sector";
      session.locationPage = 1;

      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang, true);
    }

    return buildLocationMenu(
      districts,
      session.locationPage || 1,
      "selectDistrict",
      lang,
      true
    );
  }

  // Handle sector selection
  if (session.locationStep === "sector") {
    const sectors = LocationValidationService.getSectorsByDistrict(
      session.selectedProvince!,
      session.selectedDistrict!
    );

    if (currentInput === "0") {
      session.locationStep = "district";
      session.locationPage = 1;
      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince!
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang, true);
    }

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang,
        false
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang,
        false
      );
    }

    const sectorIndex = parseInt(currentInput) - 1;
    if (sectorIndex >= 0 && sectorIndex < sectors.length) {
      session.selectedSector = sectors[sectorIndex];
      session.locationStep = "cell";
      session.locationPage = 1;

      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector
      );
      return buildLocationMenu(cells, 1, "selectCell", lang, false);
    }

    return buildLocationMenu(
      sectors,
      session.locationPage || 1,
      "selectSector",
      lang,
      false
    );
  }

  // Handle cell selection
  if (session.locationStep === "cell") {
    const cells = LocationValidationService.getCellsBySector(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!
    );

    if (currentInput === "0") {
      session.locationStep = "sector";
      session.locationPage = 1;
      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict!
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang, false);
    }

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        cells,
        session.locationPage,
        "selectCell",
        lang,
        false
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        cells,
        session.locationPage,
        "selectCell",
        lang,
        false
      );
    }

    const cellIndex = parseInt(currentInput) - 1;
    if (cellIndex >= 0 && cellIndex < cells.length) {
      session.selectedCell = cells[cellIndex];
      session.locationStep = "village";
      session.locationPage = 1;

      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell
      );
      return buildLocationMenu(villages, 1, "selectVillage", lang, false);
    }

    return buildLocationMenu(
      cells,
      session.locationPage || 1,
      "selectCell",
      lang,
      false
    );
  }

  // Handle village selection
  if (session.locationStep === "village") {
    const villages = LocationValidationService.getVillagesByCell(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!,
      session.selectedCell!
    );

    if (currentInput === "0") {
      session.locationStep = "cell";
      session.locationPage = 1;
      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!
      );
      return buildLocationMenu(cells, 1, "selectCell", lang, false);
    }

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang,
        false
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang,
        false
      );
    }

    const villageIndex = parseInt(currentInput) - 1;
    if (villageIndex >= 0 && villageIndex < villages.length) {
      session.selectedVillage = villages[villageIndex];
      session.locationStep = "confirm_pin";

      return `CON ${getTranslation(lang, "createPin")}`;
    }

    return buildLocationMenu(
      villages,
      session.locationPage || 1,
      "selectVillage",
      lang,
      false
    );
  }

  // Handle PIN creation
  if (session.locationStep === "confirm_pin") {
    if (currentInput === "0") {
      session.locationStep = "village";
      session.locationPage = 1;
      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell!
      );
      return buildLocationMenu(villages, 1, "selectVillage", lang, false);
    }

    if (!session.password) {
      // First PIN entry
      const pin = currentInput;
      if (!/^\d{4}$/.test(pin)) {
        return `CON ${getTranslation(lang, "invalidPin")}
        
${getTranslation(lang, "createPin")}`;
      }

      session.password = pin;
      return `CON ${getTranslation(lang, "confirmPin")}`;
    } else {
      // PIN confirmation
      const confirmPin = currentInput;

      if (confirmPin !== session.password) {
        delete session.password;
        return `CON ${getTranslation(lang, "pinMismatch")}
        
${getTranslation(lang, "createPin")}`;
      }

      // Register the user
      try {
        const hashedPin = await hashPassword(session.password);

        await prisma.farmer.create({
          data: {
            phone: phoneNumber,
            password: hashedPin,
            province: session.selectedProvince!,
            district: session.selectedDistrict!,
            sector: session.selectedSector!,
            cell: session.selectedCell!,
            village: session.selectedVillage!,
            preferredLanguage: session.language!,
          },
        });

        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "registrationSuccessful")}`;
      } catch (error) {
        console.error("Registration error:", error);
        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "registrationFailed")}`;
      }
    }
  }

  return `END ${getTranslation(lang, "invalidInput")}`;
}

// Enhanced system status check with proper error handling
async function getSystemStatus(lang: "KINY" | "ENG" | "FRE"): Promise<string> {
  try {
    const status = await SupportService.getSystemStatus();

    if (typeof status === "object" && status !== null) {
      return `System Status: ${status.overall || "Unknown"}
Database: ${status.database || "Unknown"}
SMS: ${status.sms || "Unknown"}
Payments: ${status.payments || "Unknown"}
Last Updated: ${new Date().toLocaleString()}`;
    }

    return `System Status: Operational
All services are running normally.
Last checked: ${new Date().toLocaleString()}`;
  } catch (error) {
    console.error("Error getting system status:", error);
    return `System Status: Error
Unable to retrieve system status at this time.
Please try again later.`;
  }
}

// Enhanced FAQ handling with proper structure
async function getFAQContent(
  lang: "KINY" | "ENG" | "FRE",
  faqIndex?: number
): Promise<string> {
  try {
    const faqs = SupportService.getFAQs(lang);

    if (faqIndex !== undefined && faqIndex >= 0 && faqIndex < faqs.length) {
      const faq = faqs[faqIndex];
      return `END ${faq.question}

${faq.answer}`;
    }

    let response = `CON ${getTranslation(lang, "faqSection")}\n\n`;
    faqs.slice(0, 5).forEach((faq, index) => {
      response += `${index + 1}. ${faq.question}\n`;
    });
    response += `\n0. ${getTranslation(lang, "back")}`;

    return response;
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    return `END ${getTranslation(lang, "faqFetchFailed")}`;
  }
}

// Enhanced income summary with null checking
async function getIncomeSummaryDisplay(
  phoneNumber: string,
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  try {
    const summary = await AnalyticsEarningsService.getIncomesSummary(
      phoneNumber
    );

    if (!summary) {
      return `END ${getTranslation(lang, "noIncomeData")}
${getTranslation(lang, "submitProductsFirst")}`;
    }

    let response = `END ${getTranslation(lang, "incomeSummary")}\n\n`;
    response += `${getTranslation(lang, "thisMonth")}: ${
      summary.thisMonth || 0
    } RWF\n`;
    response += `${getTranslation(lang, "lastMonth")}: ${
      summary.lastMonth || 0
    } RWF\n`;
    response += `${getTranslation(lang, "yearToDate")}: ${
      summary.yearToDate || 0
    } RWF\n`;
    response += `${getTranslation(lang, "avgPerSubmission")}: ${
      summary.avgPerSubmission || 0
    } RWF`;

    return response;
  } catch (error) {
    console.error("Error fetching income summary:", error);
    return `END ${getTranslation(lang, "incomeFetchFailed")}
${getTranslation(lang, "tryAgainLater")}`;
  }
}

// Session cleanup function with improved timeout handling
function cleanupExpiredSessions() {
  const now = new Date();
  const sessionTimeout = 15 * 60 * 1000; // 15 minutes

  Object.keys(ussdSessions).forEach((sessionId) => {
    const session = ussdSessions[sessionId];
    if (
      session.lastActivity &&
      now.getTime() - session.lastActivity.getTime() > sessionTimeout
    ) {
      delete ussdSessions[sessionId];
      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  });
}

// Enhanced error handling for session management
function getOrCreateSession(sessionId: string): ISessionData {
  let session = ussdSessions[sessionId];
  if (!session) {
    session = {
      language: "KINY",
      previousSteps: [],
      lastActivity: new Date(),
    };
    ussdSessions[sessionId] = session;
  } else {
    session.lastActivity = new Date();
  }
  return session;
}

// Helper functions for the various sub-menus
async function showSecurityMenu(lang: "KINY" | "ENG" | "FRE"): Promise<string> {
  return `CON ${getTranslation(lang, "securitySettings")}
1. ${getTranslation(lang, "changePIN")}
2. ${getTranslation(lang, "accountActivity")}
3. ${getTranslation(lang, "privacySettings")}
4. ${getTranslation(lang, "accountRecovery")}
0. ${getTranslation(lang, "back")}`;
}

async function showUpdateProfileMenu(
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  return `CON ${getTranslation(lang, "updateProfile")}
1. ${getTranslation(lang, "changePhoneNumber")}
2. ${getTranslation(lang, "updateLocation")}
3. ${getTranslation(lang, "communicationPrefs")}
0. ${getTranslation(lang, "back")}`;
}

async function showFarmingProfileMenu(
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  return `CON ${getTranslation(lang, "farmingProfile")}
1. ${getTranslation(lang, "primaryCrops")}
2. ${getTranslation(lang, "farmInformation")}
3. ${getTranslation(lang, "businessPreferences")}
4. ${getTranslation(lang, "viewProfile")}
0. ${getTranslation(lang, "back")}`;
}

async function showEarningsDashboardMenu(
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  return `CON ${getTranslation(lang, "earningsDashboard")}
1. ${getTranslation(lang, "incomeSummary")}
2. ${getTranslation(lang, "performanceMetrics")}
3. ${getTranslation(lang, "comparisonAnalytics")}
4. ${getTranslation(lang, "paymentHistory")}
0. ${getTranslation(lang, "back")}`;
}

// Function to check product prices
async function getProductPurchasePrice(productName: string): Promise<number> {
  try {
    // This would typically come from your pricing database/API
    const product = await prisma.product.findFirst({
      where: { productName },
      select: { purchasePrice: true },
    });
    return product?.purchasePrice || 0;
  } catch (error) {
    console.error("Error fetching product price:", error);
    return 0;
  }
}

// Enhanced pagination navigation handler
function handlePaginationNavigation(
  parts: string[],
  session: ISessionData,
  items: string[],
  currentStep: string
): {
  action: "next" | "prev" | "back" | "select" | null;
  selectedIndex?: number;
} {
  const currentInput = parts[parts.length - 1];

  if (currentInput === "99") return { action: "next" };
  if (currentInput === "98") return { action: "prev" };
  if (currentInput === "0") return { action: "back" };

  const selectedIndex = parseInt(currentInput) - 1;
  const currentPage = session.locationPage || 1;
  const itemsPerPage = 6;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const adjustedIndex = startIndex + selectedIndex;

  if (
    !isNaN(selectedIndex) &&
    selectedIndex >= 0 &&
    adjustedIndex < items.length
  ) {
    return { action: "select", selectedIndex: adjustedIndex };
  }

  return { action: null };
}

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: IUssdRequest): Promise<string> {
  try {
    // Clean up expired sessions
    cleanupExpiredSessions();

    const parts = text.split("*").filter((part) => part !== "");
    console.log(
      `USSD Request - Session: ${sessionId}, Phone: ${phoneNumber}, Text: ${text}, Parts: ${JSON.stringify(
        parts
      )}`
    );

    // Get or create session
    const session = getOrCreateSession(sessionId);

    // Check if user exists
    const userExists = await checkUserExists(phoneNumber);

    // For returning users, get their saved language
    if (userExists && !session.languageSelected) {
      const savedLanguage = await getUserLanguage(phoneNumber);
      session.language = savedLanguage;
      session.languageSelected = true;
    }

    const lang = session.language || "KINY";

    // Show language selection for new users only
    if (text === "" && !session.languageSelected && !userExists) {
      return showLanguageSelection(lang);
    }

    // For returning users on first access, show main menu directly
    if (text === "" && userExists && session.languageSelected) {
      return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
    }

    // Handle language selection for new users
    if (!session.languageSelected && !userExists) {
      const langChoice = parts[0];
      const languageMap: Record<string, "KINY" | "ENG" | "FRE"> = {
        "1": "KINY",
        "2": "ENG",
        "3": "FRE",
      };

      const selectedLanguage = languageMap[langChoice];
      if (selectedLanguage) {
        session.language = selectedLanguage;
        session.languageSelected = true;
        session.mode = "register";
        session.locationStep = "province";
        session.locationPage = 1;

        const provinces = LocationValidationService.getAllProvinces();
        return buildLocationMenu(
          provinces,
          1,
          "selectProvince",
          selectedLanguage,
          false
        );
      } else {
        return showLanguageSelection(lang);
      }
    }

    // Handle registration flow for new users
    if (!userExists && session.mode === "register") {
      return await handleRegistration(
        parts,
        session,
        lang,
        phoneNumber,
        sessionId
      );
    }

    // For registered users, handle main menu options
    if (userExists) {
      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) {
        return `END ${getTranslation(lang, "pleaseRegister")}`;
      }

      switch (parts[0]) {
        // 1. Submit Product
        case "1": {
          session.mode = "submit";

          const farmer = await prisma.farmer.findUnique({
            where: { phone: phoneNumber },
          });

          if (!farmer) {
            return `END ${getTranslation(lang, "pleaseRegister")}`;
          }

          // Category selection with pagination
          if (parts.length === 1) {
            session.categoryPage = 1;
            addToHistory(session, "mainMenu");
            return await buildCategoryMenu(lang, 1);
          }

          // Handle category pagination and selection
          if (parts.length === 2) {
            const categoryChoice = parts[1];

            if (categoryChoice === "99") {
              // Next page
              session.categoryPage = (session.categoryPage || 1) + 1;
              return await buildCategoryMenu(lang, session.categoryPage);
            }

            if (categoryChoice === "98") {
              // Previous page
              session.categoryPage = Math.max(
                (session.categoryPage || 1) - 1,
                1
              );
              return await buildCategoryMenu(lang, session.categoryPage);
            }

            if (categoryChoice === "0") {
              delete ussdSessions[sessionId];
              return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
            }

            // Get categories from database
            const categories = await getActiveProductCategories();
            const categoryIndex = parseInt(categoryChoice) - 1;

            if (categoryIndex >= 0 && categoryIndex < categories.length) {
              const selectedCategory = categories[categoryIndex];
              session.selectedCategoryId = selectedCategory.id;
              session.selectedCategoryName = selectedCategory.name;
              session.productPage = 1;
              addToHistory(session, "categoryMenu");

              const products = await getProductsByCategory(selectedCategory.id);

              if (products.length === 0) {
                return `CON ${getTranslation(lang, "noCategoryProducts")}
0. ${getTranslation(lang, "back")}`;
              }

              // Build product menu with pagination
              const productNames = products.map(
                (product) => product.productName
              );
              const paginated = paginateLocationList(productNames, 1);
              let productMenu = `CON ${getTranslation(
                lang,
                "selectProduct"
              )}\n`;

              paginated.items.forEach((product, index) => {
                const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
                productMenu += `${itemNumber}. ${product}\n`;
              });

              // Add navigation options
              let navOptions: string[] = [];
              if (paginated.hasNext) {
                navOptions.push(`99. ${getTranslation(lang, "next")}`);
              }

              navOptions.push(`0. ${getTranslation(lang, "back")}`);

              if (navOptions.length > 0) {
                productMenu += navOptions.join("\n");
              }

              return productMenu;
            } else {
              return `CON ${getTranslation(lang, "invalidCategory")}

${await buildCategoryMenu(lang, session.categoryPage || 1)}`.replace(
                "CON ",
                ""
              );
            }
          }

          // Handle product selection and pagination
          if (parts.length === 3) {
            const productChoice = parts[2];

            if (productChoice === "99") {
              // Next page for products
              session.productPage = (session.productPage || 1) + 1;
              const products = await getProductsByCategory(
                session.selectedCategoryId!
              );

              const productNames = products.map(
                (product) => product.productName
              );
              const paginated = paginateLocationList(
                productNames,
                session.productPage
              );

              let productMenu = `CON ${getTranslation(
                lang,
                "selectProduct"
              )}\n`;
              paginated.items.forEach((product, index) => {
                const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
                productMenu += `${itemNumber}. ${product}\n`;
              });

              let navOptions: string[] = [];
              if (paginated.hasPrev) {
                navOptions.push(`98. ${getTranslation(lang, "previous")}`);
              }
              if (paginated.hasNext) {
                navOptions.push(`99. ${getTranslation(lang, "next")}`);
              }

              navOptions.push(`0. ${getTranslation(lang, "back")}`);

              if (navOptions.length > 0) {
                productMenu += navOptions.join("\n");
              }

              return productMenu;
            }

            if (productChoice === "98") {
              // Previous page for products
              session.productPage = Math.max((session.productPage || 1) - 1, 1);
              const products = await getProductsByCategory(
                session.selectedCategoryId!
              );

              const productNames = products.map(
                (product) => product.productName
              );
              const paginated = paginateLocationList(
                productNames,
                session.productPage
              );

              let productMenu = `CON ${getTranslation(
                lang,
                "selectProduct"
              )}\n`;
              paginated.items.forEach((product, index) => {
                const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
                productMenu += `${itemNumber}. ${product}\n`;
              });

              let navOptions: string[] = [];
              if (paginated.hasPrev) {
                navOptions.push(`98. ${getTranslation(lang, "previous")}`);
              }
              if (paginated.hasNext) {
                navOptions.push(`99. ${getTranslation(lang, "next")}`);
              }

              navOptions.push(`0. ${getTranslation(lang, "back")}`);

              if (navOptions.length > 0) {
                productMenu += navOptions.join("\n");
              }

              return productMenu;
            }

            if (productChoice === "0") {
              return await buildCategoryMenu(lang, session.categoryPage || 1);
            }

            // Get products for the selected category
            const products = await getProductsByCategory(
              session.selectedCategoryId!
            );
            const productIndex = parseInt(productChoice) - 1;

            if (productIndex >= 0 && productIndex < products.length) {
              session.selectedProduct = products[productIndex].productName;
              session.selectedProductUnit = products[productIndex].unit;
              addToHistory(session, "productMenu");

              // Show unit in the quantity prompt
              return `CON ${getTranslation(lang, "enterQuantity")} (${
                session.selectedProductUnit
              })
0. ${getTranslation(lang, "back")}`;
            } else {
              const paginated = paginateLocationList(
                products.map((product) => product.productName),
                session.productPage || 1
              );
              let productMenu = `CON ${getTranslation(lang, "invalidProduct")}

${getTranslation(lang, "selectProduct")}\n`;

              paginated.items.forEach((product, index) => {
                const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
                productMenu += `${itemNumber}. ${product}\n`;
              });

              let navOptions: string[] = [];
              if (paginated.hasPrev) {
                navOptions.push(`98. ${getTranslation(lang, "previous")}`);
              }
              if (paginated.hasNext) {
                navOptions.push(`99. ${getTranslation(lang, "next")}`);
              }

              navOptions.push(`0. ${getTranslation(lang, "back")}`);

              if (navOptions.length > 0) {
                productMenu += navOptions.join("\n");
              }

              return productMenu;
            }
          }

          // Handle quantity input
          if (parts.length === 4) {
            const quantityInput = parts[3];

            if (quantityInput === "0") {
              // Back to product selection
              const products = await getProductsByCategory(
                session.selectedCategoryId!
              );
              const paginated = paginateLocationList(
                products.map((product) => product.productName),
                session.productPage || 1
              );

              let productMenu = `CON ${getTranslation(
                lang,
                "selectProduct"
              )}\n`;
              paginated.items.forEach((product, index) => {
                const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
                productMenu += `${itemNumber}. ${product}\n`;
              });

              let navOptions: string[] = [];
              if (paginated.hasPrev) {
                navOptions.push(`98. ${getTranslation(lang, "previous")}`);
              }
              if (paginated.hasNext) {
                navOptions.push(`99. ${getTranslation(lang, "next")}`);
              }

              navOptions.push(`0. ${getTranslation(lang, "back")}`);

              if (navOptions.length > 0) {
                productMenu += navOptions.join("\n");
              }

              return productMenu;
            }

            const quantity = parseFloat(quantityInput);
            if (isNaN(quantity) || quantity <= 0) {
              return `CON ${getTranslation(lang, "invalidQuantity")}

${getTranslation(lang, "enterQuantity")} (${session.selectedProductUnit})
0. ${getTranslation(lang, "back")}`;
            }

            session.quantity = quantityInput;
            addToHistory(session, "quantityInput");

            return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
          }

          // Handle price input
          if (parts.length === 5) {
            const priceInput = parts[4];

            if (priceInput === "0") {
              return `CON ${getTranslation(lang, "enterQuantity")} (${
                session.selectedProductUnit
              })
0. ${getTranslation(lang, "back")}`;
            }

            const price = parseFloat(priceInput);
            if (isNaN(price) || price <= 0) {
              return `CON ${getTranslation(lang, "invalidPrice")}

${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
            }

            // Check if price is higher than purchase price
            const purchasePrice = await getProductPurchasePrice(
              session.selectedProduct!
            );
            if (purchasePrice > 0 && price > purchasePrice) {
              session.wishedPrice = priceInput;
              session.purchasePrice = purchasePrice.toString();
              session.priceComparisonStep = "confirm_high_price";

              return `CON ${getTranslation(lang, "priceHigherThanMarket")}
${getTranslation(lang, "marketPrice")}: ${purchasePrice} RWF
${getTranslation(lang, "yourPrice")}: ${price} RWF

1. ${getTranslation(lang, "acceptAndContinue")}
2. ${getTranslation(lang, "changePrice")}
0. ${getTranslation(lang, "back")}`;
            }

            session.wishedPrice = priceInput;
            addToHistory(session, "priceInput");

            return `CON ${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
          }

          // Handle price comparison response
          if (
            parts.length === 6 &&
            session.priceComparisonStep === "confirm_high_price"
          ) {
            const choice = parts[5];

            if (choice === "0") {
              return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
            }

            if (choice === "1") {
              // Accept high price and continue
              session.priceComparisonStep = undefined;
              addToHistory(session, "priceInput");
              return `CON ${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
            }

            if (choice === "2") {
              // Change price
              session.priceComparisonStep = undefined;
              return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
            }
          }

          // Handle PIN confirmation for submission
          if (parts.length === 6) {
            const pinInput = parts[5];

            if (pinInput === "0") {
              return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
            }

            const pinResult = await verifyUserPin(phoneNumber, pinInput);
            if (!pinResult.isValid) {
              return `CON ${getTranslation(
                lang,
                pinResult.message || "incorrectPin"
              )}

${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
            }

            // Submit product with category ID instead of enum
            try {
              await prisma.farmerSubmission.create({
                data: {
                  farmerId: farmer.id,
                  productName: session.selectedProduct!,
                  categoryId: session.selectedCategoryId!,
                  submittedQty: parseFloat(session.quantity!),
                  wishedPrice: parseFloat(session.wishedPrice!),
                  province: farmer.province,
                  district: farmer.district,
                  sector: farmer.sector,
                  cell: farmer.cell,
                  village: farmer.village,
                },
              });

              delete ussdSessions[sessionId];
              return `END ${getTranslation(lang, "submissionSuccessful")}`;
            } catch (error) {
              console.error("Product submission error:", error);
              delete ussdSessions[sessionId];
              return `END ${getTranslation(lang, "submissionFailed")}`;
            }
          }

          return `END ${getTranslation(lang, "invalidCategory")}`;
        }
        // 2. Help
        case "2": {
          session.mode = "help";

          if (parts.length === 1) {
            addToHistory(session, "mainMenu");
            return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "technicalSupport")}
2. ${getTranslation(lang, "faqSection")}
3. ${getTranslation(lang, "contactSupport")}
0. ${getTranslation(lang, "back")}`;
          }

          // Technical Support
          if (parts[1] === "1") {
            if (parts.length === 2) {
              return `CON ${getTranslation(lang, "technicalSupport")}
${getTranslation(lang, "techSupportDesc")}

1. ${getTranslation(lang, "reportIssue")}
2. ${getTranslation(lang, "checkStatus")}
0. ${getTranslation(lang, "back")}`;
            }

            if (parts[2] === "1") {
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "describeIssue")}
0. ${getTranslation(lang, "back")}`;
              }

              const issueDescription = parts.slice(3).join(" ");
              try {
                await SupportService.submitSupportTicket(phoneNumber, {
                  category: "TECHNICAL",
                  description: issueDescription,
                  priority: "LOW",
                });
                return `END ${getTranslation(lang, "issueReportedSuccess")}`;
              } catch (error) {
                console.error("Error creating support ticket:", error);
                return `END ${getTranslation(lang, "issueReportFailed")}`;
              }
            }

            if (parts[2] === "2") {
              try {
                return `END ${await getSystemStatus(lang)}`;
              } catch (error) {
                console.error("Error getting system status:", error);
                return `END ${getTranslation(lang, "statusCheckFailed")}`;
              }
            }
          }

          // FAQ Section
          if (parts[1] === "2") {
            if (parts.length === 2) {
              return await getFAQContent(lang);
            }

            if (parts[2] === "0") {
              return handleBackNavigation(session, lang);
            }

            const faqIndex = parseInt(parts[2]) - 1;
            if (!isNaN(faqIndex)) {
              return await getFAQContent(lang, faqIndex);
            }

            return await getFAQContent(lang);
          }

          // Contact Support
          if (parts[1] === "3") {
            return `END ${getTranslation(lang, "contactSupport")}
${getTranslation(lang, "callUs")}: +250796897823
${getTranslation(lang, "whatsapp")}: +250796897823
${getTranslation(lang, "email")}: info@food.rw`;
          }

          // Back navigation
          if (parts[1] === "0") {
            return handleBackNavigation(session, lang);
          }

          break;
        }

        // 3. My Account
        case "3": {
          session.mode = "account";

          if (parts.length === 1) {
            addToHistory(session, "mainMenu");
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
          }

          // Check submissions with pagination
          if (parts[1] === "1") {
            if (parts.length === 2) {
              return `CON ${getTranslation(lang, "enterPasswordForSubmissions")}
0. ${getTranslation(lang, "back")}`;
            }

            if (parts.length === 3) {
              const pinInput = parts[2];

              if (pinInput === "0") {
                return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
              }

              const pinResult = await verifyUserPin(phoneNumber, pinInput);
              if (!pinResult.isValid) {
                return `END ${getTranslation(
                  lang,
                  pinResult.message || "incorrectPasswordSubmissions"
                )}`;
              }

              try {
                const submissions = await prisma.farmerSubmission.findMany({
                  where: { farmerId: farmer.id },
                  take: 6,
                  orderBy: { createdAt: "desc" },
                });

                if (submissions.length === 0) {
                  return `END ${getTranslation(lang, "noOrders")}`;
                }

                let response = `END ${getTranslation(
                  lang,
                  "recentSubmissions"
                )}\n\n`;
                submissions.forEach((submission, index) => {
                  response += `${index + 1}. ${submission.productName}\n`;
                  response += `   ${submission.submittedQty}kg @ ${submission.wishedPrice} RWF/kg\n`;
                  response += `   ${getTranslation(
                    lang,
                    "status"
                  )}: ${getTranslation(
                    lang,
                    submission.status as TranslationKey
                  )}\n\n`;
                });

                return response.trim();
              } catch (error) {
                console.error("Error fetching submissions:", error);
                return `END ${getTranslation(lang, "submissionFetchFailed")}`;
              }
            }
          }

          // Update Profile with enhanced navigation
          if (parts[1] === "2") {
            if (parts.length === 2) {
              addToHistory(session, "accountMenu");
              return await showUpdateProfileMenu(lang);
            }

            // Change Phone Number
            if (parts[2] === "1") {
              if (parts.length === 3) {
                session.profileUpdateStep = "phone_step1";
                return `CON ${getTranslation(lang, "enterNewPhoneNumber")}
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 4 &&
                session.profileUpdateStep === "phone_step1"
              ) {
                const newPhone = parts[3];

                // Basic phone validation
                if (!/^\+?\d{10,15}$/.test(newPhone)) {
                  return `CON ${getTranslation(lang, "invalidPhoneFormat")}

${getTranslation(lang, "enterNewPhoneNumber")}
0. ${getTranslation(lang, "back")}`;
                }

                session.newPhoneNumber = newPhone;
                session.profileUpdateStep = "phone_step2";

                // In real implementation, send SMS verification code here
                return `CON ${getTranslation(lang, "verificationCodeSent")}

${getTranslation(lang, "enterVerificationCode")}
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 5 &&
                session.profileUpdateStep === "phone_step2"
              ) {
                const verificationCode = parts[4];

                if (verificationCode === "0") {
                  session.profileUpdateStep = undefined;
                  return await showUpdateProfileMenu(lang);
                }

                try {
                  const success =
                    await ProfileManagementService.updatePhoneNumber(
                      phoneNumber,
                      session.newPhoneNumber!,
                      verificationCode
                    );

                  if (success) {
                    delete session.newPhoneNumber;
                    delete session.profileUpdateStep;
                    return `END ${getTranslation(lang, "phoneNumberUpdated")}`;
                  } else {
                    return `END ${getTranslation(lang, "phoneUpdateFailed")}`;
                  }
                } catch (error) {
                  console.error("Phone update error:", error);
                  return `END ${getTranslation(lang, "phoneUpdateFailed")}`;
                }
              }
            }

            // Update Location
            if (parts[2] === "2") {
              if (parts.length === 3) {
                session.locationStep = "province";
                session.locationPage = 1;
                session.profileUpdateType = "location";

                const provinces = LocationValidationService.getAllProvinces();
                return buildLocationMenu(
                  provinces,
                  1,
                  "selectProvince",
                  lang,
                  true
                );
              }

              return await handleLocationUpdate(
                parts,
                session,
                lang,
                phoneNumber
              );
            }

            // Communication Preferences
            if (parts[2] === "3") {
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "communicationPrefs")}
1. ${getTranslation(lang, "smsNotifications")} ✅
2. ${getTranslation(lang, "notificationFrequency")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts[3] === "1") {
                // Toggle SMS notifications
                try {
                  await ProfileManagementService.updateCommunicationPreferences(
                    phoneNumber,
                    {
                      smsNotifications: !farmer.smsNotifications,
                      language: farmer.preferredLanguage as
                        | "KINY"
                        | "ENG"
                        | "FRE",
                      notificationFrequency:
                        (farmer.notificationFrequency as
                          | "IMMEDIATE"
                          | "DAILY"
                          | "WEEKLY") || "DAILY",
                    }
                  );
                  return `END ${getTranslation(
                    lang,
                    "communicationUpdateSuccess"
                  )}`;
                } catch (error) {
                  console.error("Communication pref update error:", error);
                  return `END ${getTranslation(lang, "operationFailed")}`;
                }
              }

              if (parts[3] === "2") {
                if (parts.length === 4) {
                  return `CON ${getTranslation(lang, "selectNotificationFreq")}
1. ${getTranslation(lang, "IMMEDIATE")}
2. ${getTranslation(lang, "DAILY")}
3. ${getTranslation(lang, "WEEKLY")}
0. ${getTranslation(lang, "back")}`;
                }

                const freqChoice = parts[4];
                const frequencyMap = {
                  "1": "IMMEDIATE",
                  "2": "DAILY",
                  "3": "WEEKLY",
                } as const;

                if (freqChoice in frequencyMap) {
                  try {
                    await ProfileManagementService.updateCommunicationPreferences(
                      phoneNumber,
                      {
                        smsNotifications: farmer.smsNotifications,
                        language: farmer.preferredLanguage as
                          | "KINY"
                          | "ENG"
                          | "FRE",
                        notificationFrequency:
                          frequencyMap[freqChoice as keyof typeof frequencyMap],
                      }
                    );
                    return `END ${getTranslation(
                      lang,
                      "communicationUpdateSuccess"
                    )}`;
                  } catch (error) {
                    console.error("Frequency update error:", error);
                    return `END ${getTranslation(lang, "operationFailed")}`;
                  }
                }
              }
            }

            // Back navigation
            if (parts[2] === "0") {
              return handleBackNavigation(session, lang);
            }
          }

          // Farming Profile
          if (parts[1] === "3") {
            if (parts.length === 2) {
              addToHistory(session, "accountMenu");
              return await showFarmingProfileMenu(lang);
            }

            // Primary Crops implementation
            if (parts[2] === "1") {
              if (parts.length === 3) {
                session.farmingProfileStep = "primary_crops_view";

                // Get available products for selection
                const categories = await getActiveProductCategories();
                let menu = `CON ${getTranslation(lang, "selectCrops")}\n`;

                categories.forEach((category, index) => {
                  menu += `${index + 1}. ${category.name}\n`;
                });

                menu += `\n0. ${getTranslation(lang, "back")}`;
                return menu;
              }

              if (
                parts.length === 4 &&
                session.farmingProfileStep === "primary_crops_view"
              ) {
                const categoryChoice = parts[3];

                if (categoryChoice === "0") {
                  return await showFarmingProfileMenu(lang);
                }

                const categoryIndex = parseInt(categoryChoice) - 1;
                const categories = await getActiveProductCategories();

                if (categoryIndex >= 0 && categoryIndex < categories.length) {
                  session.selectedCategoryId = categories[categoryIndex].id;
                  const products = await getProductsByCategory(
                    session.selectedCategoryId
                  );

                  let productMenu = `CON ${getTranslation(
                    lang,
                    "selectCrops"
                  )}\n`;
                  products.forEach((product, index) => {
                    productMenu += `${index + 1}. ${product.productName}\n`;
                  });

                  productMenu += `\n0. ${getTranslation(lang, "back")}`;
                  session.farmingProfileStep = "select_crops";
                  return productMenu;
                }
              }

              if (
                parts.length === 5 &&
                session.farmingProfileStep === "select_crops"
              ) {
                const productChoice = parts[4];

                if (productChoice === "0") {
                  // Go back to category selection
                  const categories = await getActiveProductCategories();
                  let menu = `CON ${getTranslation(lang, "selectCrops")}\n`;

                  categories.forEach((category, index) => {
                    menu += `${index + 1}. ${category.name}\n`;
                  });

                  menu += `\n0. ${getTranslation(lang, "back")}`;
                  return menu;
                }

                // Here you would implement the logic to save selected crops
                // This is a simplified example
                return `END ${getTranslation(lang, "cropsUpdated")}`;
              }
            }

            // Farm Information implementation
            if (parts[2] === "2") {
              if (parts.length === 3) {
                session.farmingProfileStep = "farm_info";
                return `CON ${getTranslation(
                  lang,
                  "enterFarmSize"
                )} (${getTranslation(lang, "hectares")})
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 4 &&
                session.farmingProfileStep === "farm_info"
              ) {
                const farmSizeInput = parts[3];

                if (farmSizeInput === "0") {
                  return await showFarmingProfileMenu(lang);
                }

                const farmSize = parseFloat(farmSizeInput);
                if (isNaN(farmSize) || farmSize <= 0) {
                  return `CON ${getTranslation(lang, "invalidNumber")}

${getTranslation(lang, "enterFarmSize")} (${getTranslation(lang, "hectares")})
0. ${getTranslation(lang, "back")}`;
                }

                session.farmSize = farmSize;
                session.farmingProfileStep = "farm_experience";
                return `CON ${getTranslation(
                  lang,
                  "enterExperience"
                )} (${getTranslation(lang, "years")})
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 5 &&
                session.farmingProfileStep === "farm_experience"
              ) {
                const experienceInput = parts[4];

                if (experienceInput === "0") {
                  return `CON ${getTranslation(
                    lang,
                    "enterFarmSize"
                  )} (${getTranslation(lang, "hectares")})
0. ${getTranslation(lang, "back")}`;
                }

                const experience = parseInt(experienceInput);
                if (isNaN(experience) || experience < 0) {
                  return `CON ${getTranslation(lang, "invalidNumber")}

${getTranslation(lang, "enterExperience")} (${getTranslation(lang, "years")})
0. ${getTranslation(lang, "back")}`;
                }

                // Save farm information
                try {
                  await FarmingProfileService.updateFarmInformation(
                    phoneNumber,
                    {
                      farmSize: session.farmSize,
                      farmSizeUnit: "HECTARES",
                      experienceYears: experience,
                    }
                  );

                  return `END ${getTranslation(lang, "farmInfoUpdated")}`;
                } catch (error) {
                  console.error("Error updating farm info:", error);
                  return `END ${getTranslation(lang, "operationFailed")}`;
                }
              }
            }

            // Business Preferences implementation
            if (parts[2] === "3") {
              if (parts.length === 3) {
                session.farmingProfileStep = "business_prefs";
                return `CON ${getTranslation(lang, "selectPaymentMethod")}
1. ${getTranslation(lang, "MOBILE_MONEY")}
2. ${getTranslation(lang, "BANK_TRANSFER")}
3. ${getTranslation(lang, "CASH")}
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 4 &&
                session.farmingProfileStep === "business_prefs"
              ) {
                const paymentMethodChoice = parts[3];

                if (paymentMethodChoice === "0") {
                  return await showFarmingProfileMenu(lang);
                }

                const paymentMethodMap = {
                  "1": "MOBILE_MONEY",
                  "2": "BANK_TRANSFER",
                  "3": "CASH",
                } as const;

                if (paymentMethodChoice in paymentMethodMap) {
                  session.paymentMethod =
                    paymentMethodMap[
                      paymentMethodChoice as keyof typeof paymentMethodMap
                    ];
                  session.farmingProfileStep = "min_order_qty";

                  return `CON ${getTranslation(lang, "enterMinOrderQty")}
0. ${getTranslation(lang, "back")}`;
                }
              }

              if (
                parts.length === 5 &&
                session.farmingProfileStep === "min_order_qty"
              ) {
                const minOrderInput = parts[4];

                if (minOrderInput === "0") {
                  return `CON ${getTranslation(lang, "selectPaymentMethod")}
1. ${getTranslation(lang, "MOBILE_MONEY")}
2. ${getTranslation(lang, "BANK_TRANSFER")}
3. ${getTranslation(lang, "CASH")}
0. ${getTranslation(lang, "back")}`;
                }

                const minOrderQty = parseFloat(minOrderInput);
                if (isNaN(minOrderQty) || minOrderQty <= 0) {
                  return `CON ${getTranslation(lang, "invalidNumber")}

${getTranslation(lang, "enterMinOrderQty")}
0. ${getTranslation(lang, "back")}`;
                }

                // Save business preferences
                try {
                  await FarmingProfileService.updateBusinessPreferences(
                    phoneNumber,
                    {
                      preferredPaymentMethod: session.paymentMethod,
                      minimumOrderQuantity: minOrderQty,
                    }
                  );

                  return `END ${getTranslation(lang, "businessPrefsUpdated")}`;
                } catch (error) {
                  console.error("Error updating business prefs:", error);
                  return `END ${getTranslation(lang, "operationFailed")}`;
                }
              }
            }

            // View farming profile
            if (parts[2] === "4") {
              try {
                const profile = await FarmingProfileService.getFarmingProfile(
                  farmer.id
                );

                console.log("Farming Profile:", profile);

                if (!profile || !profile.FarmerProfile) {
                  return `END ${getTranslation(lang, "profileNotFound")}
${getTranslation(lang, "pleaseUpdateProfile")}`;
                }

                let response = `END ${getTranslation(
                  lang,
                  "farmingProfileDetails"
                )}\n\n`;

                // Handle primary crops safely
                if (
                  profile.FarmerPrimaryCrop &&
                  profile.FarmerPrimaryCrop.length > 0
                ) {
                  const cropNames = profile.FarmerPrimaryCrop.filter(
                    (crop: any) => crop.product
                  ).map((crop: any) => crop.product.productName);
                  response += `${getTranslation(lang, "primaryCrops")}: ${
                    cropNames.join(", ") || getTranslation(lang, "none")
                  }\n`;
                } else {
                  response += `${getTranslation(
                    lang,
                    "primaryCrops"
                  )}: ${getTranslation(lang, "none")}\n`;
                }

                // Handle farm information safely
                response += `${getTranslation(lang, "farmSize")}: ${
                  profile.FarmerProfile.farmSize || 0
                } ${getTranslation(lang, "hectares")}\n`;
                response += `${getTranslation(lang, "experience")}: ${
                  profile.FarmerProfile.experienceYears || 0
                } ${getTranslation(lang, "years")}\n`;

                if (profile.FarmerProfile.cooperativeName) {
                  response += `${getTranslation(lang, "cooperativeName")}: ${
                    profile.FarmerProfile.cooperativeName
                  }\n`;
                }

                if (profile.FarmerProfile.cooperativeMember) {
                  response += `${getTranslation(
                    lang,
                    "cooperativeMember"
                  )}: ${getTranslation(lang, "yes")}\n`;
                } else {
                  response += `${getTranslation(
                    lang,
                    "cooperativeMember"
                  )}: ${getTranslation(lang, "no")}\n`;
                }

                return response;
              } catch (error) {
                console.error("Error fetching farming profile:", error);
                return `END ${getTranslation(lang, "profileFetchFailed")}`;
              }
            }

            return await showFarmingProfileMenu(lang);
          }

          // Earnings Dashboard
          if (parts[1] === "4") {
            if (parts.length === 2) {
              addToHistory(session, "accountMenu");
              return await showEarningsDashboardMenu(lang);
            }

            // Income Summary with null checking
            if (parts[2] === "1") {
              return await getIncomeSummaryDisplay(phoneNumber, lang);
            }

            // Performance Metrics
            if (parts[2] === "2") {
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "enterPINForMetrics")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts.length === 4) {
                const pinInput = parts[3];

                if (pinInput === "0") {
                  return await showEarningsDashboardMenu(lang);
                }

                const pinResult = await verifyUserPin(phoneNumber, pinInput);
                if (!pinResult.isValid) {
                  return `END ${getTranslation(
                    lang,
                    pinResult.message || "incorrectPinMetrics"
                  )}`;
                }

                try {
                  const metrics =
                    await AnalyticsEarningsService.getPerformanceMetrics(
                      phoneNumber
                    );

                  if (!metrics) {
                    return `END ${getTranslation(
                      lang,
                      "metricsDataNotAvailable"
                    )}`;
                  }

                  let response = `END ${getTranslation(
                    lang,
                    "performanceMetricsDetails"
                  )}\n\n`;
                  response += `${getTranslation(lang, "acceptanceRate")}: ${
                    metrics.acceptanceRate?.toFixed(2) || 0
                  }%\n`;
                  response += `${getTranslation(lang, "avgPricePerKg")}: ${
                    metrics.avgPrice?.toFixed(2) || 0
                  } RWF\n`;

                  if (metrics.topProducts && metrics.topProducts.length > 0) {
                    response += `${getTranslation(lang, "topProduct")}: ${
                      metrics.topProducts[0].productName
                    } (${metrics.topProducts[0]._sum.totalAmount || 0} RWF)\n`;
                  }

                  return response;
                } catch (error) {
                  console.error("Error fetching performance metrics:", error);
                  return `END ${getTranslation(
                    lang,
                    "metricsDataNotAvailable"
                  )}`;
                }
              }
            }

            // Comparison Analytics
            if (parts[2] === "3") {
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "enterPINForEarnings")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts.length === 4) {
                const pinInput = parts[3];

                if (pinInput === "0") {
                  return await showEarningsDashboardMenu(lang);
                }

                const pinResult = await verifyUserPin(phoneNumber, pinInput);
                if (!pinResult.isValid) {
                  return `END ${getTranslation(
                    lang,
                    pinResult.message || "incorrectPinEarnings"
                  )}`;
                }

                try {
                  const analytics =
                    await AnalyticsEarningsService.getComparisonAnalytics(
                      phoneNumber
                    );

                  if (!analytics) {
                    return `END ${getTranslation(lang, "noDataAvailable")}`;
                  }

                  let response = `END ${getTranslation(
                    lang,
                    "comparisonAnalytics"
                  )}\n\n`;
                  response += `${getTranslation(lang, "regionalAverage")}: ${
                    analytics.regionalAverage || 0
                  } RWF\n`;
                  response += `${getTranslation(lang, "yearlyGrowth")}: ${
                    analytics.previousYear?.growthRate?.toFixed(2) || 0
                  }%\n`;
                  response += `${getTranslation(lang, "marketPosition")}: #${
                    analytics.marketPosition || "N/A"
                  }\n`;

                  return response;
                } catch (error) {
                  console.error("Error fetching comparison analytics:", error);
                  return `END ${getTranslation(lang, "noDataAvailable")}`;
                }
              }
            }

            // Payment History
            if (parts[2] === "4") {
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "enterPINForEarnings")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts.length === 4) {
                const pinInput = parts[3];

                if (pinInput === "0") {
                  return await showEarningsDashboardMenu(lang);
                }

                const pinResult = await verifyUserPin(phoneNumber, pinInput);
                if (!pinResult.isValid) {
                  return `END ${getTranslation(
                    lang,
                    pinResult.message || "incorrectPinEarnings"
                  )}`;
                }

                try {
                  const paymentHistory =
                    await AnalyticsEarningsService.getPaymentHistory(
                      phoneNumber,
                      5
                    );

                  // Proper type checking for payment history
                  if (
                    !paymentHistory ||
                    !Array.isArray((paymentHistory as any).recentPayments) ||
                    (paymentHistory as any).recentPayments.length === 0
                  ) {
                    return `END ${getTranslation(lang, "noDataAvailable")}`;
                  }

                  // Type assertion for payment history
                  const paymentData = paymentHistory as {
                    recentPayments: any[];
                    pendingAmount: number;
                    pendingCount: number;
                  };

                  let response = `END ${getTranslation(
                    lang,
                    "paymentHistory"
                  )}\n\n`;

                  paymentData.recentPayments.forEach(
                    (payment: any, index: number) => {
                      response += `${index + 1}. ${payment.productName} - ${
                        payment.totalAmount
                      } RWF\n`;
                      response += `   ${new Date(
                        payment.paidAt
                      ).toLocaleDateString()}\n\n`;
                    }
                  );

                  response += `\n${getTranslation(lang, "pendingPayments")}: ${
                    paymentData.pendingCount
                  } (${paymentData.pendingAmount} RWF)`;

                  return response;
                } catch (error) {
                  console.error("Error fetching payment history:", error);
                  return `END ${getTranslation(lang, "noDataAvailable")}`;
                }
              }
            }

            // Back navigation
            if (parts[2] === "0") {
              return handleBackNavigation(session, lang);
            }

            return await showEarningsDashboardMenu(lang);
          }

          // Security Settings
          if (parts[1] === "5") {
            if (parts.length === 2) {
              addToHistory(session, "accountMenu");
              return await showSecurityMenu(lang);
            }

            // Change PIN
            if (parts[2] === "1") {
              let currentPin = "";
              if (parts.length === 3) {
                return `CON ${getTranslation(lang, "enterCurrentPIN")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts.length === 4) {
                currentPin = parts[3];
                const pinResult = await verifyUserPin(phoneNumber, currentPin);

                if (!pinResult.isValid) {
                  return `END ${getTranslation(
                    lang,
                    pinResult.message || "incorrectPin"
                  )}`;
                }

                session.pinChangeStep = "newPin";
                return `CON ${getTranslation(lang, "enterNewPIN")}
0. ${getTranslation(lang, "back")}`;
              }

              if (parts.length === 5 && session.pinChangeStep === "newPin") {
                const newPin = parts[4];

                if (!/^\d{4}$/.test(newPin)) {
                  return `CON ${getTranslation(lang, "invalidPinFormat")}

${getTranslation(lang, "enterNewPIN")}
0. ${getTranslation(lang, "back")}`;
                }

                session.newPin = newPin;
                session.pinChangeStep = "confirmPin";
                return `CON ${getTranslation(lang, "confirmNewPIN")}
0. ${getTranslation(lang, "back")}`;
              }

              if (
                parts.length === 6 &&
                session.pinChangeStep === "confirmPin"
              ) {
                const confirmPin = parts[5];

                if (confirmPin !== session.newPin) {
                  return `CON ${getTranslation(lang, "pinsDoNotMatch")}

${getTranslation(lang, "confirmNewPIN")}
0. ${getTranslation(lang, "back")}`;
                }

                try {
                  await PinManagementService.changePIN(
                    phoneNumber,
                    (currentPin = ""),
                    confirmPin
                  );

                  delete session.newPin;
                  delete session.pinChangeStep;
                  return `END ${getTranslation(lang, "pinChangedSuccess")}`;
                } catch (error) {
                  console.error("Error changing PIN:", error);
                  return `END ${getTranslation(
                    lang,
                    "pinChangeFailedTryAgain"
                  )}`;
                }
              }
            }

            // Account Activity
            if (parts[2] === "2") {
              try {
                const activities =
                  await ActivityMonitoringService.getRecentActivity(
                    phoneNumber
                  );

                let response = `END ${getTranslation(
                  lang,
                  "recentActivity"
                )}\n\n`;

                activities.forEach((activity, index) => {
                  const date = new Date(
                    activity.timestamp
                  ).toLocaleDateString();
                  response += `${index + 1}. ${getTranslation(
                    lang,
                    activity.action as TranslationKey
                  )} - ${date}\n`;
                });

                return response;
              } catch (error) {
                console.error("Error fetching activities:", error);
                return `END ${getTranslation(lang, "activityFetchFailed")}`;
              }
            }

            return await showSecurityMenu(lang);
          }

          // Change language
          if (parts[1] === "6") {
            if (parts.length === 2) {
              return `CON ${getTranslation(lang, "enterPasswordForLanguage")}
0. ${getTranslation(lang, "back")}`;
            }

            if (parts.length === 3) {
              const pinInput = parts[2];

              if (pinInput === "0") {
                return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
              }

              const pinResult = await verifyUserPin(phoneNumber, pinInput);
              if (!pinResult.isValid) {
                return `END ${getTranslation(
                  lang,
                  pinResult.message || "incorrectPasswordLanguage"
                )}`;
              }

              return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}`;
            }

            if (parts.length === 4) {
              const langChoice = parts[3];

              if (langChoice === "0") {
                return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
              }

              const languageMap: Record<string, "KINY" | "ENG" | "FRE"> = {
                "1": "KINY",
                "2": "ENG",
                "3": "FRE",
              };

              const newLanguage = languageMap[langChoice];
              if (newLanguage) {
                try {
                  await updateUserLanguage(phoneNumber, newLanguage);
                  session.language = newLanguage;

                  delete ussdSessions[sessionId];
                  return `END ${getTranslation(
                    newLanguage,
                    "languageChanged"
                  )}`;
                } catch (error) {
                  console.error("Error updating language:", error);
                  return `END ${getTranslation(lang, "languageChangeFailed")}`;
                }
              } else {
                return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}`;
              }
            }
          }

          // Back navigation for main account menu
          if (parts[1] === "0") {
            return handleBackNavigation(session, lang);
          }

          break;
        }

        case "4":
          delete ussdSessions[sessionId];
          return `END ${getTranslation(lang, "exitMessage")}`;
      }
    }

    // Default fallback with proper error messaging
    if (userExists) {
      return `CON ${getTranslation(lang, "invalidInput")}
${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
    } else {
      return `END ${getTranslation(lang, "pleaseRegister")}`;
    }
  } catch (error) {
    console.error("USSD Logic Error:", error);

    // Clean up the session on critical errors
    if (ussdSessions[sessionId]) {
      delete ussdSessions[sessionId];
    }

    // Return user-friendly error message
    const lang = ussdSessions[sessionId]?.language || "KINY";
    return `END ${getTranslation(lang, "systemError")}
${getTranslation(lang, "pleaseRetry")}`;
  }
}
