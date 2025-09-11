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

    // Return saved language or default to KINY
    return (farmer?.preferredLanguage as "KINY" | "ENG" | "FRE") || "KINY";
  } catch (error) {
    console.error("Error fetching user language:", error);
    return "KINY"; // Default fallback
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

  // Add navigation options with special handling
  let navOptions: string[] = [];

  // Add pagination options only if needed
  if (paginated.hasPrev) {
    navOptions.push(`98. ${getTranslation(lang, "previous")}`);
  }
  if (paginated.hasNext) {
    navOptions.push(`99. ${getTranslation(lang, "next")}`);
  }

  // Add back option
  if (backOption) {
    navOptions.push(`0. ${getTranslation(lang, "back")}`);
  }

  if (navOptions.length > 0) {
    menu += navOptions.join("\n");
  }

  return menu;
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

// Handle registration flow
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
      // Next page
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
      // Previous page
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang,
        false
      );
    }

    // Handle province selection
    const provinceIndex = parseInt(currentInput) - 1;
    if (provinceIndex >= 0 && provinceIndex < provinces.length) {
      session.selectedProvince = provinces[provinceIndex];
      session.locationStep = "district";
      session.locationPage = 1;

      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang, false);
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

    if (currentInput === "99") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        false
      );
    }

    if (currentInput === "98") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang,
        false
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
      return buildLocationMenu(sectors, 1, "selectSector", lang, false);
    }

    return buildLocationMenu(
      districts,
      session.locationPage || 1,
      "selectDistrict",
      lang,
      false
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

// Session cleanup function
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
    }
  });
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

async function handleLocationUpdate(
  parts: string[],
  session: ISessionData,
  lang: "KINY" | "ENG" | "FRE",
  phoneNumber: string,
  sessionId: string
): Promise<string> {
  if (parts.length === 3) {
    session.locationStep = "province";
    session.locationPage = 1;
    const provinces = LocationValidationService.getAllProvinces();
    return buildLocationMenu(provinces, 1, "selectProvince", lang);
  }

  const currentInput = parts[parts.length - 1];

  // Handle province selection
  if (session.locationStep === "province") {
    const provinces = LocationValidationService.getAllProvinces();
    const navigation = handlePaginationNavigation(
      parts,
      session,
      provinces,
      "province"
    );

    if (navigation.action === "next") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang
      );
    }

    if (navigation.action === "prev") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        provinces,
        session.locationPage,
        "selectProvince",
        lang
      );
    }

    if (navigation.action === "back") {
      return await showUpdateProfileMenu(lang);
    }

    if (
      navigation.action === "select" &&
      navigation.selectedIndex !== undefined
    ) {
      session.selectedProvince = provinces[navigation.selectedIndex];
      session.locationStep = "district";
      session.locationPage = 1;

      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang);
    }
  }

  // Handle district selection
  if (session.locationStep === "district") {
    const districts = LocationValidationService.getDistrictsByProvince(
      session.selectedProvince!
    );
    const navigation = handlePaginationNavigation(
      parts,
      session,
      districts,
      "district"
    );

    if (navigation.action === "next") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang
      );
    }

    if (navigation.action === "prev") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        districts,
        session.locationPage,
        "selectDistrict",
        lang
      );
    }

    if (navigation.action === "back") {
      session.locationStep = "province";
      session.locationPage = 1;
      const provinces = LocationValidationService.getAllProvinces();
      return buildLocationMenu(provinces, 1, "selectProvince", lang);
    }

    if (
      navigation.action === "select" &&
      navigation.selectedIndex !== undefined
    ) {
      session.selectedDistrict = districts[navigation.selectedIndex];
      session.locationStep = "sector";
      session.locationPage = 1;

      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang);
    }
  }

  // Handle sector selection
  if (session.locationStep === "sector") {
    const sectors = LocationValidationService.getSectorsByDistrict(
      session.selectedProvince!,
      session.selectedDistrict!
    );
    const navigation = handlePaginationNavigation(
      parts,
      session,
      sectors,
      "sector"
    );

    if (navigation.action === "next") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang
      );
    }

    if (navigation.action === "prev") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        sectors,
        session.locationPage,
        "selectSector",
        lang
      );
    }

    if (navigation.action === "back") {
      session.locationStep = "district";
      session.locationPage = 1;
      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince!
      );
      return buildLocationMenu(districts, 1, "selectDistrict", lang);
    }

    if (
      navigation.action === "select" &&
      navigation.selectedIndex !== undefined
    ) {
      session.selectedSector = sectors[navigation.selectedIndex];
      session.locationStep = "cell";
      session.locationPage = 1;

      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector
      );
      return buildLocationMenu(cells, 1, "selectCell", lang);
    }
  }

  // Handle cell selection
  if (session.locationStep === "cell") {
    const cells = LocationValidationService.getCellsBySector(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!
    );
    const navigation = handlePaginationNavigation(
      parts,
      session,
      cells,
      "cell"
    );

    if (navigation.action === "next") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(cells, session.locationPage, "selectCell", lang);
    }

    if (navigation.action === "prev") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(cells, session.locationPage, "selectCell", lang);
    }

    if (navigation.action === "back") {
      session.locationStep = "sector";
      session.locationPage = 1;
      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict!
      );
      return buildLocationMenu(sectors, 1, "selectSector", lang);
    }

    if (
      navigation.action === "select" &&
      navigation.selectedIndex !== undefined
    ) {
      session.selectedCell = cells[navigation.selectedIndex];
      session.locationStep = "village";
      session.locationPage = 1;

      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell
      );
      return buildLocationMenu(villages, 1, "selectVillage", lang);
    }
  }

  // Handle village selection
  if (session.locationStep === "village") {
    const villages = LocationValidationService.getVillagesByCell(
      session.selectedProvince!,
      session.selectedDistrict!,
      session.selectedSector!,
      session.selectedCell!
    );
    const navigation = handlePaginationNavigation(
      parts,
      session,
      villages,
      "village"
    );

    if (navigation.action === "next") {
      session.locationPage = (session.locationPage || 1) + 1;
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang
      );
    }

    if (navigation.action === "prev") {
      session.locationPage = Math.max((session.locationPage || 1) - 1, 1);
      return buildLocationMenu(
        villages,
        session.locationPage,
        "selectVillage",
        lang
      );
    }

    if (navigation.action === "back") {
      session.locationStep = "cell";
      session.locationPage = 1;
      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!
      );
      return buildLocationMenu(cells, 1, "selectCell", lang);
    }

    if (
      navigation.action === "select" &&
      navigation.selectedIndex !== undefined
    ) {
      session.selectedVillage = villages[navigation.selectedIndex];

      try {
        // Update user location in database
        await prisma.farmer.update({
          where: { phone: phoneNumber },
          data: {
            province: session.selectedProvince,
            district: session.selectedDistrict,
            sector: session.selectedSector,
            cell: session.selectedCell,
            village: session.selectedVillage,
          },
        });

        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "locationUpdatedSuccessfully")}`;
      } catch (error) {
        console.error("Error updating location:", error);
        return `END ${getTranslation(lang, "locationUpdateFailed")}`;
      }
    }
  }

  return `END ${getTranslation(lang, "invalidInput")}`;
}

// Helper function to handle pagination navigation
function handlePaginationNavigation(
  parts: string[],
  session: ISessionData,
  items: string[],
  currentStep: string
): {
  action: "next" | "prev" | "back" | "mainMenu" | "select" | null;
  selectedIndex?: number;
} {
  const currentInput = parts[parts.length - 1];
  const currentPage = session.locationPage || 1;

  // Handle pagination navigation
  if (currentInput === "99") {
    return { action: "next" };
  }

  if (currentInput === "98") {
    return { action: "prev" };
  }

  if (currentInput === "0") {
    return { action: "back" };
  }

  // Handle item selection
  const selectedIndex = parseInt(currentInput) - 1;
  const totalItems = items.length;

  if (
    !isNaN(selectedIndex) &&
    selectedIndex >= 0 &&
    selectedIndex < totalItems
  ) {
    return { action: "select", selectedIndex };
  }

  return { action: null };
}

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: IUssdRequest): Promise<string> {
  // Clean up expired sessions
  cleanupExpiredSessions();

  const parts = text.split("*");
  console.log(
    `USSD Request - Session: ${sessionId}, Phone: ${phoneNumber}, Text: ${text}, Parts: ${JSON.stringify(
      parts
    )}`
  );

  // Initialize session
  let session = ussdSessions[sessionId];
  if (!session) {
    session = {
      language: "KINY",
      previousSteps: [],
      lastActivity: new Date(Date.now()),
    };
    ussdSessions[sessionId] = session;
  } else {
    // Update last activity time
    session.lastActivity = new Date(Date.now());
  }

  // Check if user exists first
  const userExists = await checkUserExists(phoneNumber);

  // For returning users, get their saved language and skip language selection
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

      console.log(
        `Language selected: ${selectedLanguage}, Starting registration...`
      );

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
    switch (parts[0]) {
      // 1. Submit Product - handles category -> product flow
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
            session.categoryPage = Math.max((session.categoryPage || 1) - 1, 1);
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
            const productNames = products.map((product) => product.productName);
            const paginated = paginateLocationList(productNames, 1);
            let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;

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

            const productNames = products.map((product) => product.productName);
            const paginated = paginateLocationList(
              productNames,
              session.productPage
            );

            let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;
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

            const productNames = products.map((product) => product.productName);
            const paginated = paginateLocationList(
              productNames,
              session.productPage
            );

            let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;
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

            let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;
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

          session.wishedPrice = priceInput;
          addToHistory(session, "priceInput");

          return `CON ${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
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

      // 2. Help - Expanded with support services
      case "2": {
        session.mode = "help";

        if (parts.length === 1) {
          addToHistory(session, "mainMenu");
          return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "technicalSupport")}
2. ${getTranslation(lang, "faqSection")}
3. ${getTranslation(lang, "contactSupport")}
4. ${getTranslation(lang, "systemStatus")}
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
              const status = await SupportService.getSystemStatus();
              return `END ${getTranslation(lang, "systemStatus")}: ${status}`;
            } catch (error) {
              console.error("Error getting system status:", error);
              return `END ${getTranslation(lang, "statusCheckFailed")}`;
            }
          }
        }

        // FAQ Section
        if (parts[1] === "2") {
          try {
            const faqs = await SupportService.getFAQs(lang);
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

        // Contact Support
        if (parts[1] === "3") {
          return `END ${getTranslation(lang, "contactSupport")}
${getTranslation(lang, "callUs")}: +250796897823
${getTranslation(lang, "whatsapp")}: +250796897823
${getTranslation(lang, "email")}: info@food.rw`;
        }

        // System Status
        if (parts[1] === "4") {
          try {
            const status = await SupportService.getSystemStatus();
            return `END ${getTranslation(lang, "systemStatus")}: ${status}`;
          } catch (error) {
            console.error("Error getting system status:", error);
            return `END ${getTranslation(lang, "statusCheckFailed")}`;
          }
        }

        return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "technicalSupport")}
2. ${getTranslation(lang, "faqSection")}
3. ${getTranslation(lang, "contactSupport")}
4. ${getTranslation(lang, "systemStatus")}
0. ${getTranslation(lang, "back")}`;
      }

      // 3. My Account - Expanded with all services
      case "3": {
        session.mode = "account";

        const farmer = await prisma.farmer.findUnique({
          where: { phone: phoneNumber },
        });

        if (!farmer) {
          return `END ${getTranslation(lang, "pleaseRegister")}`;
        }

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

        // Update Profile
        if (parts[1] === "2") {
          if (parts.length === 2) {
            addToHistory(session, "accountMenu");
            return await showUpdateProfileMenu(lang);
          }

          // Handle location update
          if (parts[2] === "2") {
            return await handleLocationUpdate(
              parts,
              session,
              lang,
              phoneNumber,
              sessionId
            );
          }

          // Handle other profile updates
          return await showUpdateProfileMenu(lang);
        }

        // Farming Profile
        if (parts[1] === "3") {
          if (parts.length === 2) {
            addToHistory(session, "accountMenu");
            return await showFarmingProfileMenu(lang);
          }

          // View farming profile
          if (parts[2] === "4") {
            try {
              const profile = await FarmingProfileService.getFarmingProfile(
                farmer.id
              );
              let response = `END ${getTranslation(
                lang,
                "farmingProfile"
              )}\n\n`;

              response += `${getTranslation(
                lang,
                "primaryCrops"
              )}: ${profile.primaryCrops.join(", ")}\n`;
              response += `${getTranslation(lang, "farmSize")}: ${
                profile.farmSize
              } ${getTranslation(lang, "hectares")}\n`;
              response += `${getTranslation(lang, "experience")}: ${
                profile.yearsExperience
              } ${getTranslation(lang, "years")}\n`;
              response += `${getTranslation(
                lang,
                "preferredBuyers"
              )}: ${profile.preferredBuyerTypes.join(", ")}`;

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

          // Income Summary
          if (parts[2] === "1") {
            try {
              const summary = await AnalyticsEarningsService.getIncomesSummary(
                farmer.id
              );
              let response = `END ${getTranslation(lang, "incomeSummary")}\n\n`;

              response += `${getTranslation(lang, "totalEarnings")}: ${
                summary.totalEarnings
              } RWF\n`;
              response += `${getTranslation(lang, "monthlyAverage")}: ${
                summary.monthlyAverage
              } RWF\n`;
              response += `${getTranslation(lang, "topProduct")}: ${
                summary.topProduct
              }\n`;
              response += `${getTranslation(lang, "transactions")}: ${
                summary.totalTransactions
              }`;

              return response;
            } catch (error) {
              console.error("Error fetching income summary:", error);
              return `END ${getTranslation(lang, "incomeFetchFailed")}`;
            }
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

            if (parts.length === 6 && session.pinChangeStep === "confirmPin") {
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
                return `END ${getTranslation(lang, "pinChangeFailedTryAgain")}`;
              }
            }
          }

          // Account Activity
          if (parts[2] === "2") {
            try {
              const activities =
                await ActivityMonitoringService.getRecentActivity(phoneNumber);

              let response = `END ${getTranslation(
                lang,
                "recentActivity"
              )}\n\n`;

              activities.forEach((activity, index) => {
                const date = new Date(activity.timestamp).toLocaleDateString();
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
                return `END ${getTranslation(newLanguage, "languageChanged")}`;
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

        return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
      }

      // 4. Exit
      case "4":
        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "exitMessage")}`;
    }
  }

  // Default fallback
  if (userExists) {
    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
  } else {
    return `END ${getTranslation(lang, "registrationFailed")}`;
  }
}
