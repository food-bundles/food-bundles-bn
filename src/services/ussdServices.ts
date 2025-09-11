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
    // Fallback to empty array - you might want to handle this differently
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
  // Removed main menu option (00) as per requirement

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

// Get previous step from navigation history
function getPreviousStep(
  session: ISessionData
): { step: string; data?: any } | null {
  if (!session.previousSteps || session.previousSteps.length === 0) {
    return null;
  }
  return session.previousSteps.pop() || null;
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

    const bcrypt = require("bcrypt");
    const isValid = await bcrypt.compare(pin, farmer.password);

    return { isValid, message: isValid ? undefined : "incorrectPin" };
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return { isValid: false, message: "pinVerificationFailed" };
  }
}

// Back navigation handler function
function handleBackNavigation(
  session: ISessionData,
  lang: "KINY" | "ENG" | "FRE"
): string | null {
  if (!session.previousSteps || session.previousSteps.length === 0) {
    return null;
  }

  const previousStep = session.previousSteps.pop();
  if (!previousStep) return null;

  switch (previousStep.step) {
    case "mainMenu":
      return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;

    case "accountMenu":
      return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;

    case "securityMenu":
      return `CON ${getTranslation(lang, "securitySettings")}
1. ${getTranslation(lang, "changePIN")}
2. ${getTranslation(lang, "accountActivity")}
3. ${getTranslation(lang, "privacySettings")}
4. ${getTranslation(lang, "accountRecovery")}
0. ${getTranslation(lang, "back")}`;

    case "profileMenu":
      return `CON ${getTranslation(lang, "updateProfile")}
1. ${getTranslation(lang, "changePhoneNumber")}
2. ${getTranslation(lang, "updateLocation")}
3. ${getTranslation(lang, "communicationPrefs")}
0. ${getTranslation(lang, "back")}`;

    case "helpMenu":
      return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "technicalSupport")}
2. ${getTranslation(lang, "faqSection")}
3. ${getTranslation(lang, "contactSupport")}
4. ${getTranslation(lang, "systemStatus")}
0. ${getTranslation(lang, "back")}`;

    default:
      return null;
  }
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

  // Continue with district, sector, cell, village selection...
  // Similar pattern as above for each location level

  // Final confirmation
  if (session.locationStep === "completed") {
    const success = await ProfileManagementService.updateLocation(phoneNumber, {
      province: session.selectedProvince!,
      district: session.selectedDistrict!,
      sector: session.selectedSector!,
      cell: session.selectedCell!,
      village: session.selectedVillage!,
    });

    delete ussdSessions[sessionId];
    return success
      ? `END ${getTranslation(lang, "locationUpdatedSuccessfully")}`
      : `END ${getTranslation(lang, "locationUpdateFailed")}`;
  }

  return `CON ${getTranslation(lang, "invalidSelection")}`;
}

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: IUssdRequest): Promise<string> {
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
      lastActivity: new Date(),
    };
    ussdSessions[sessionId] = session;
  } else {
    // Update last activity timestamp
    session.lastActivity = new Date();
  }

  // Check session expiration (15 minutes)
  if (
    session.lastActivity &&
    Date.now() - session.lastActivity.getTime() > 15 * 60 * 1000
  ) {
    delete ussdSessions[sessionId];
    return `END ${getTranslation(
      session.language || "KINY",
      "sessionExpiredPleaseRestart"
    )}`;
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

  // Handle back navigation (input "0")
  if (parts[parts.length - 1] === "0") {
    const backResponse = handleBackNavigation(session, lang);
    if (backResponse) {
      return backResponse;
    }
  }

  // Only show language selection for new users
  if (text === "" && !session.languageSelected && !userExists) {
    addToHistory(session, "mainMenu");
    return showLanguageSelection(lang);
  }

  // For returning users on first access, show main menu directly
  if (text === "" && userExists && session.languageSelected) {
    addToHistory(session, "languageSelection");
    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
  }

  // Handle language selection (only for new users)
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

      // Save language preference for new users
      try {
        await updateUserLanguage(phoneNumber, selectedLanguage);
      } catch (error) {
        console.error("Failed to save language preference:", error);
      }

      // New user - start with registration directly
      session.mode = "register";
      session.locationStep = "province";
      session.locationPage = 1;
      addToHistory(session, "languageSelection");
      const provinces = LocationValidationService.getAllProvinces();
      return buildLocationMenu(
        provinces,
        1,
        "selectProvince",
        selectedLanguage
      );
    } else {
      return showLanguageSelection(lang);
    }
  }

  // For returning users, handle main menu options
  switch (parts[0]) {
    case "1": {
      // Submit Product flow
      session.mode = "submit";
      addToHistory(session, "mainMenu");

      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) {
        return `END ${getTranslation(lang, "pleaseRegister")}`;
      }

      // Category selection with pagination
      if (parts.length === 1) {
        session.categoryPage = 1;
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

        if (!/^\d{4}$/.test(pinInput)) {
          return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
        }

        const pinValid = await verifyUserPin(phoneNumber, pinInput);
        if (!pinValid.isValid) {
          return `CON ${getTranslation(
            lang,
            pinValid.message || "incorrectPin"
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

    case "2": {
      // Help menu - Uses SupportService
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

      // Handle help submenu options using SupportService
      if (parts[1] === "1") {
        // Technical support
        if (parts.length === 2) {
          addToHistory(session, "helpMenu");
          return `CON ${getTranslation(lang, "technicalSupport")}
1. ${getTranslation(lang, "submitTicket")}
2. ${getTranslation(lang, "requestCallback")}
3. ${getTranslation(lang, "emergencySupport")}
0. ${getTranslation(lang, "back")}`;
        }

        // Handle technical support options
        if (parts[2] === "1") {
          // Submit ticket
          return `CON ${getTranslation(lang, "submitTicket")}
${getTranslation(lang, "contactSupportForAssistance")}
0. ${getTranslation(lang, "back")}`;
        }
      }

      if (parts[1] === "2") {
        // FAQ Section
        const faqs = SupportService.getFAQs(lang);
        let faqMenu = `CON ${getTranslation(lang, "faqSection")}\n`;
        faqs.slice(0, 5).forEach((faq: any, index: number) => {
          faqMenu += `${index + 1}. ${faq.question}\n`;
        });
        faqMenu += `\n0. ${getTranslation(lang, "back")}`;
        return faqMenu;
      }

      if (parts[1] === "4") {
        // System status
        const systemStatus = await SupportService.getSystemStatus();
        return `END ${getTranslation(lang, "systemStatus")}:
${getTranslation(lang, "overall")}: ${systemStatus.overall}
${getTranslation(lang, "database")}: ${systemStatus.database}
${getTranslation(lang, "sms")}: ${systemStatus.sms}
${getTranslation(lang, "payments")}: ${systemStatus.payments}`;
      }

      return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "technicalSupport")}
2. ${getTranslation(lang, "faqSection")}
3. ${getTranslation(lang, "contactSupport")}
4. ${getTranslation(lang, "systemStatus")}
0. ${getTranslation(lang, "back")}`;
    }

    case "3": {
      // My Account
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

      // Check Submissions - FIXED: Show proper message when no submissions
      if (parts[1] === "1") {
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          return `CON ${getTranslation(lang, "enterPasswordForSubmissions")}
0. ${getTranslation(lang, "back")}`;
        }

        if (parts.length === 3) {
          const pin = parts[2];
          if (pin === "0") {
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
          }

          const pinValid = await verifyUserPin(phoneNumber, pin);
          if (!pinValid.isValid) {
            return `CON ${getTranslation(
              lang,
              pinValid.message || "incorrectPasswordSubmissions"
            )}
${getTranslation(lang, "enterPasswordForSubmissions")}
0. ${getTranslation(lang, "back")}`;
          }

          const submissions = await prisma.farmerSubmission.findMany({
            where: { farmerId: farmer.id },
            orderBy: { createdAt: "desc" },
            take: 5,
          });

          if (submissions.length === 0) {
            return `END ${getTranslation(lang, "noOrders")}`;
          }

          let response = `END ${getTranslation(lang, "lastThreeOrders")}\n\n`;
          submissions.forEach((sub, index) => {
            const date = new Date(sub.createdAt).toLocaleDateString();
            response += `${index + 1}. ${sub.productName} - ${
              sub.submittedQty
            } - ${date}\n`;
          });

          return response;
        }
      }

      // Security Settings submenu
      if (parts[1] === "5") {
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          return await showSecurityMenu(lang);
        }

        // Change PIN - FIXED: Proper PIN validation flow
        if (parts[2] === "1") {
          if (parts.length === 3) {
            addToHistory(session, "securityMenu");
            return `CON ${getTranslation(lang, "enterCurrentPIN")}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 4) {
            const currentPin = parts[3];
            if (currentPin === "0") {
              return await showSecurityMenu(lang);
            }

            const pinValid = await verifyUserPin(phoneNumber, currentPin);
            if (!pinValid.isValid) {
              return `CON ${getTranslation(
                lang,
                pinValid.message || "incorrectCurrentPIN"
              )}
${getTranslation(lang, "enterCurrentPIN")}
0. ${getTranslation(lang, "back")}`;
            }

            session.currentPinVerified = true;
            return `CON ${getTranslation(lang, "enterNewPIN")}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 5) {
            const newPin = parts[4];
            if (newPin === "0") {
              session.currentPinVerified = false;
              return `CON ${getTranslation(lang, "enterCurrentPIN")}
0. ${getTranslation(lang, "back")}`;
            }

            if (!/^\d{4}$/.test(newPin)) {
              return `CON ${getTranslation(lang, "invalidPinFormat")}
${getTranslation(lang, "enterNewPIN")}
0. ${getTranslation(lang, "back")}`;
            }

            session.newPin = newPin;
            return `CON ${getTranslation(lang, "confirmNewPIN")}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 6) {
            const confirmPin = parts[5];
            if (confirmPin === "0") {
              return `CON ${getTranslation(lang, "enterNewPIN")}
0. ${getTranslation(lang, "back")}`;
            }

            if (session.newPin !== confirmPin) {
              return `CON ${getTranslation(lang, "pinMismatch")}
${getTranslation(lang, "confirmNewPIN")}
0. ${getTranslation(lang, "back")}`;
            }

            const success = await PinManagementService.changePIN(
              phoneNumber,
              parts[3], // old PIN
              session.newPin!
            );

            delete ussdSessions[sessionId];
            return success
              ? `END ${getTranslation(lang, "pinChangedSuccessfully")}`
              : `END ${getTranslation(lang, "pinChangeFailedTryAgain")}`;
          }
        }

        // Account Activity
        if (parts[2] === "2") {
          if (parts.length === 3) {
            return `CON ${getTranslation(lang, "enterPINForActivity")}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 4) {
            const pin = parts[3];
            if (pin === "0") {
              return await showSecurityMenu(lang);
            }

            const pinValid = await verifyUserPin(phoneNumber, pin);
            if (!pinValid.isValid) {
              return `END ${getTranslation(
                lang,
                pinValid.message || "incorrectPinActivity"
              )}`;
            }

            const recentActivity =
              await ActivityMonitoringService.getRecentActivity(phoneNumber);
            let response = `END ${getTranslation(lang, "recentActivity")}\n\n`;

            recentActivity
              .slice(0, 5)
              .forEach((activity: any, index: number) => {
                const date = new Date(
                  activity.attemptTime
                ).toLocaleDateString();
                const status = activity.successful ? "✓" : "✗";
                response += `${index + 1}. ${date} ${status}\n`;
              });

            return response.trim();
          }
        }
      }

      // Update Profile submenu
      if (parts[1] === "2") {
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          return await showUpdateProfileMenu(lang);
        }

        // Change Phone Number - FIXED: Show current phone number
        if (parts[2] === "1") {
          if (parts.length === 3) {
            addToHistory(session, "profileMenu");
            return `CON ${getTranslation(lang, "enterNewPhoneNumber")}
${getTranslation(lang, "currentPhone")}: ${phoneNumber}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 4) {
            const newPhone = parts[3];
            if (newPhone === "0") {
              return await showUpdateProfileMenu(lang);
            }

            if (!/^\d{10}$/.test(newPhone)) {
              return `CON ${getTranslation(lang, "invalidPhoneFormat")}
${getTranslation(lang, "enterNewPhoneNumber")}
0. ${getTranslation(lang, "back")}`;
            }

            session.newPhoneNumber = newPhone;
            // In real implementation, send SMS verification code
            return `CON ${getTranslation(lang, "verificationCodeSent")}
${getTranslation(lang, "enterVerificationCode")}
0. ${getTranslation(lang, "back")}`;
          }

          if (parts.length === 5) {
            const verificationCode = parts[4];
            if (verificationCode === "0") {
              return `CON ${getTranslation(lang, "enterNewPhoneNumber")}
0. ${getTranslation(lang, "back")}`;
            }

            const success = await ProfileManagementService.updatePhoneNumber(
              phoneNumber,
              session.newPhoneNumber!,
              verificationCode
            );

            delete ussdSessions[sessionId];
            return success
              ? `END ${getTranslation(lang, "phoneNumberUpdated")}`
              : `END ${getTranslation(lang, "phoneUpdateFailed")}`;
          }
        }

        // Update Location flow
        if (parts[2] === "2") {
          return await handleLocationUpdate(
            parts,
            session,
            lang,
            phoneNumber,
            sessionId
          );
        }
      }

      // Change Language
      if (parts[1] === "6") {
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          return `CON ${getTranslation(lang, "enterPasswordForLanguage")}
0. ${getTranslation(lang, "back")}`;
        }

        if (parts.length === 3) {
          const pin = parts[2];
          if (pin === "0") {
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "updateProfile")}
3. ${getTranslation(lang, "farmingProfile")}
4. ${getTranslation(lang, "earningsDashboard")}
5. ${getTranslation(lang, "securitySettings")}
6. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
          }

          const pinValid = await verifyUserPin(phoneNumber, pin);
          if (!pinValid.isValid) {
            return `CON ${getTranslation(
              lang,
              pinValid.message || "incorrectPasswordLanguage"
            )}
${getTranslation(lang, "enterPasswordForLanguage")}
0. ${getTranslation(lang, "back")}`;
          }

          return showLanguageSelection(lang);
        }

        if (parts.length === 4) {
          const langChoice = parts[3];
          const languageMap: Record<string, "KINY" | "ENG" | "FRE"> = {
            "1": "KINY",
            "2": "ENG",
            "3": "FRE",
          };

          const selectedLanguage = languageMap[langChoice];
          if (selectedLanguage) {
            await updateUserLanguage(phoneNumber, selectedLanguage);
            delete ussdSessions[sessionId];
            return `END ${getTranslation(selectedLanguage, "languageChanged")}`;
          } else {
            return showLanguageSelection(lang);
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

    default:
      return `END ${getTranslation(lang, "invalidSelection")}`;
  }
}
