import prisma from "../prisma";
import {
  ISessionData,
  IUssdRequest,
  TranslationKey,
  translations,
} from "../types/productTypes";
import { hashPassword } from "../utils/password";
import { LocationValidationService } from "./location.service";

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

// Location pagination helper - Changed limit to 3
function paginateLocationList(
  items: string[],
  page: number,
  limit: number = 3
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

// Build location menu with pagination and back option - Updated for 3 items per page
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
    const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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

  // Add main menu option (00)
  navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

  if (navOptions.length > 0) {
    menu += navOptions.join("\n");
  }

  return menu;
}

// Build product category menu - Paginated to 3 items
async function buildCategoryMenu(
  lang: "KINY" | "ENG" | "FRE" = "KINY",
  page: number = 1
): Promise<string> {
  const categories = await getActiveProductCategories();
  const categoryNames = categories.map((category) => category.name);
  const paginated = paginateLocationList(categoryNames, page);

  let menu = `CON ${getTranslation(lang, "selectCategory")}\n`;

  paginated.items.forEach((category, index) => {
    const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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
  navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

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

// Helper function to handle pagination navigation - Updated for 3 items per page
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

  if (currentInput === "00") {
    return { action: "mainMenu" };
  }

  // Handle item selection
  const selectedIndex = parseInt(currentInput) - 1;
  const totalItems = items.length;
  const itemsPerPage = 3;

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
): Promise<boolean> {
  try {
    const farmer = await prisma.farmer.findUnique({
      where: { phone: phoneNumber },
      select: { password: true },
    });

    if (!farmer) return false;

    // Use your password verification function
    const bcrypt = require("bcrypt");
    return await bcrypt.compare(pin, farmer.password);
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return false;
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
      language: "KINY", // Default language, will be updated after language selection
      previousSteps: [],
    };
    ussdSessions[sessionId] = session;
  }

  const lang = session.language || "KINY";

  // Always show language selection first for new sessions
  if (text === "" && !session.languageSelected) {
    return showLanguageSelection(lang);
  }

  // Handle language selection
  if (!session.languageSelected) {
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

      // Check if user exists to show appropriate menu
      const userExists = await checkUserExists(phoneNumber);

      if (userExists) {
        // Update user's language preference in database
        try {
          await updateUserLanguage(phoneNumber, selectedLanguage);
        } catch (error) {
          console.error("Failed to update user language:", error);
        }

        // Show returning user main menu (help before account)
        return `CON ${getTranslation(selectedLanguage, "welcome")}
1. ${getTranslation(selectedLanguage, "submitProduct")}
2. ${getTranslation(selectedLanguage, "help")}
3. ${getTranslation(selectedLanguage, "myAccount")}
4. ${getTranslation(selectedLanguage, "exit")}`;
      } else {
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
      }
    } else {
      return showLanguageSelection(lang);
    }
  }

  // Handle main menu navigation (00)
  if (parts[parts.length - 1] === "00") {
    delete ussdSessions[sessionId];
    const userExists = await checkUserExists(phoneNumber);

    if (userExists) {
      return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
    } else {
      return showLanguageSelection(lang);
    }
  }

  // Handle registration flow for new users (started from language selection)
  if (session.mode === "register") {
    const existingUser = await prisma.farmer.findUnique({
      where: { phone: phoneNumber },
    });

    if (existingUser) {
      return `END ${getTranslation(lang, "alreadyRegistered")}`;
    }

    // Location selection flow
    if (session.locationStep === "province") {
      const provinces = LocationValidationService.getAllProvinces();
      const currentPage = session.locationPage || 1;

      const navigation = handlePaginationNavigation(
        parts,
        session,
        provinces,
        "province"
      );

      switch (navigation.action) {
        case "next":
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            provinces,
            session.locationPage,
            "selectProvince",
            lang
          );

        case "prev":
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            provinces,
            session.locationPage,
            "selectProvince",
            lang
          );

        case "back":
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "languageSelection") {
            delete ussdSessions[sessionId];
            return showLanguageSelection(lang);
          }
          break;

        case "mainMenu":
          delete ussdSessions[sessionId];
          return showLanguageSelection(lang);

        case "select":
          if (
            navigation.selectedIndex !== undefined &&
            navigation.selectedIndex >= 0 &&
            navigation.selectedIndex < provinces.length
          ) {
            session.selectedProvince = provinces[navigation.selectedIndex];
            session.locationStep = "district";
            session.locationPage = 1;
            addToHistory(session, "province", { page: currentPage });

            const districts = LocationValidationService.getDistrictsByProvince(
              session.selectedProvince
            );
            return buildLocationMenu(districts, 1, "selectDistrict", lang);
          }
          break;
      }

      return `CON ${getTranslation(lang, "invalidCategory")}`;
    }

    // Continue with district, sector, cell, village selection (same logic as before)
    if (session.locationStep === "district") {
      const districts = LocationValidationService.getDistrictsByProvince(
        session.selectedProvince!
      );
      const currentPage = session.locationPage || 1;

      const navigation = handlePaginationNavigation(
        parts,
        session,
        districts,
        "district"
      );

      switch (navigation.action) {
        case "next":
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            districts,
            session.locationPage,
            "selectDistrict",
            lang
          );

        case "prev":
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            districts,
            session.locationPage,
            "selectDistrict",
            lang
          );

        case "back":
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "province") {
            session.locationStep = "province";
            session.locationPage = prevStep.data.page || 1;
            const provinces = LocationValidationService.getAllProvinces();
            return buildLocationMenu(
              provinces,
              session.locationPage ?? 1,
              "selectProvince",
              lang
            );
          }
          break;

        case "mainMenu":
          delete ussdSessions[sessionId];
          return showLanguageSelection(lang);

        case "select":
          if (
            navigation.selectedIndex !== undefined &&
            navigation.selectedIndex >= 0 &&
            navigation.selectedIndex < districts.length
          ) {
            session.selectedDistrict = districts[navigation.selectedIndex];
            session.locationStep = "sector";
            session.locationPage = 1;
            addToHistory(session, "district", { page: currentPage });

            const sectors = LocationValidationService.getSectorsByDistrict(
              session.selectedProvince!,
              session.selectedDistrict
            );
            return buildLocationMenu(sectors, 1, "selectSector", lang);
          }
          break;
      }

      return `CON ${getTranslation(lang, "invalidCategory")}`;
    }

    if (session.locationStep === "sector") {
      const sectors = LocationValidationService.getSectorsByDistrict(
        session.selectedProvince!,
        session.selectedDistrict!
      );
      const currentPage = session.locationPage || 1;

      const navigation = handlePaginationNavigation(
        parts,
        session,
        sectors,
        "sector"
      );

      switch (navigation.action) {
        case "next":
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            sectors,
            session.locationPage,
            "selectSector",
            lang
          );

        case "prev":
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            sectors,
            session.locationPage,
            "selectSector",
            lang
          );

        case "back":
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "district") {
            session.locationStep = "district";
            session.locationPage = prevStep.data.page || 1;
            const districts = LocationValidationService.getDistrictsByProvince(
              session.selectedProvince!
            );
            return buildLocationMenu(
              districts,
              session.locationPage ?? 1,
              "selectDistrict",
              lang
            );
          }
          break;

        case "mainMenu":
          delete ussdSessions[sessionId];
          return showLanguageSelection(lang);

        case "select":
          if (
            navigation.selectedIndex !== undefined &&
            navigation.selectedIndex >= 0 &&
            navigation.selectedIndex < sectors.length
          ) {
            session.selectedSector = sectors[navigation.selectedIndex];
            session.locationStep = "cell";
            session.locationPage = 1;
            addToHistory(session, "sector", { page: currentPage });

            const cells = LocationValidationService.getCellsBySector(
              session.selectedProvince!,
              session.selectedDistrict!,
              session.selectedSector
            );
            return buildLocationMenu(cells, 1, "selectCell", lang);
          }
          break;
      }

      return `CON ${getTranslation(lang, "invalidCategory")}`;
    }

    if (session.locationStep === "cell") {
      const cells = LocationValidationService.getCellsBySector(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!
      );
      const currentPage = session.locationPage || 1;

      const navigation = handlePaginationNavigation(
        parts,
        session,
        cells,
        "cell"
      );

      switch (navigation.action) {
        case "next":
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            cells,
            session.locationPage,
            "selectCell",
            lang
          );

        case "prev":
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            cells,
            session.locationPage,
            "selectCell",
            lang
          );

        case "back":
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "sector") {
            session.locationStep = "sector";
            session.locationPage = prevStep.data.page || 1;
            const sectors = LocationValidationService.getSectorsByDistrict(
              session.selectedProvince!,
              session.selectedDistrict!
            );
            return buildLocationMenu(
              sectors,
              session.locationPage ?? 1,
              "selectSector",
              lang
            );
          }
          break;

        case "mainMenu":
          delete ussdSessions[sessionId];
          return showLanguageSelection(lang);

        case "select":
          if (
            navigation.selectedIndex !== undefined &&
            navigation.selectedIndex >= 0 &&
            navigation.selectedIndex < cells.length
          ) {
            session.selectedCell = cells[navigation.selectedIndex];
            session.locationStep = "village";
            session.locationPage = 1;
            addToHistory(session, "cell", { page: currentPage });

            const villages = LocationValidationService.getVillagesByCell(
              session.selectedProvince!,
              session.selectedDistrict!,
              session.selectedSector!,
              session.selectedCell
            );
            return buildLocationMenu(villages, 1, "selectVillage", lang);
          }
          break;
      }

      return `CON ${getTranslation(lang, "invalidCategory")}`;
    }

    if (session.locationStep === "village") {
      const villages = LocationValidationService.getVillagesByCell(
        session.selectedProvince!,
        session.selectedDistrict!,
        session.selectedSector!,
        session.selectedCell!
      );
      const currentPage = session.locationPage || 1;

      const navigation = handlePaginationNavigation(
        parts,
        session,
        villages,
        "village"
      );

      switch (navigation.action) {
        case "next":
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            villages,
            session.locationPage,
            "selectVillage",
            lang
          );

        case "prev":
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            villages,
            session.locationPage,
            "selectVillage",
            lang
          );

        case "back":
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "cell") {
            session.locationStep = "cell";
            session.locationPage = prevStep.data.page || 1;
            const cells = LocationValidationService.getCellsBySector(
              session.selectedProvince!,
              session.selectedDistrict!,
              session.selectedSector!
            );
            return buildLocationMenu(
              cells,
              session.locationPage ?? 1,
              "selectCell",
              lang
            );
          }
          break;

        case "mainMenu":
          delete ussdSessions[sessionId];
          return showLanguageSelection(lang);

        case "select":
          if (
            navigation.selectedIndex !== undefined &&
            navigation.selectedIndex >= 0 &&
            navigation.selectedIndex < villages.length
          ) {
            session.selectedVillage = villages[navigation.selectedIndex];
            session.locationStep = "completed";
            addToHistory(session, "village", { page: currentPage });
            return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }
          break;
      }

      return `CON ${getTranslation(lang, "invalidCategory")}`;
    }

    // PIN creation and confirmation (same logic as before)
    if (session.locationStep === "completed") {
      const currentInput = parts[parts.length - 1];

      if (currentInput === "0") {
        const prevStep = getPreviousStep(session);
        if (prevStep && prevStep.step === "village") {
          session.locationStep = "village";
          session.locationPage = prevStep.data.page || 1;
          const villages = LocationValidationService.getVillagesByCell(
            session.selectedProvince!,
            session.selectedDistrict!,
            session.selectedSector!,
            session.selectedCell!
          );
          return buildLocationMenu(
            villages,
            session.locationPage ?? 1,
            "selectVillage",
            lang
          );
        }
        return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      if (currentInput === "00") {
        delete ussdSessions[sessionId];
        return showLanguageSelection(lang);
      }

      if (!/^\d{4}$/.test(currentInput)) {
        return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      session.password = currentInput;
      session.locationStep = "confirm_pin";
      addToHistory(session, "completed");
      return `CON ${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
    }

    if (session.locationStep === "confirm_pin") {
      const confirmInput = parts[parts.length - 1];

      if (confirmInput === "0") {
        session.locationStep = "completed";
        delete session.password;
        return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      if (confirmInput === "00") {
        delete ussdSessions[sessionId];
        return showLanguageSelection(lang);
      }

      if (!/^\d{4}$/.test(confirmInput)) {
        return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      if (session.password !== confirmInput) {
        return `CON ${getTranslation(lang, "pinMismatch")}

${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      try {
        const locationValidation =
          LocationValidationService.validateLocationHierarchy({
            province: session.selectedProvince!,
            district: session.selectedDistrict!,
            sector: session.selectedSector!,
            cell: session.selectedCell!,
            village: session.selectedVillage!,
          });

        if (!locationValidation.isValid) {
          delete ussdSessions[sessionId];
          return `END Location validation failed: ${locationValidation.errors.join(
            ", "
          )}`;
        }

        const hashedPassword = await hashPassword(session.password!);
        await prisma.farmer.create({
          data: {
            phone: phoneNumber,
            password: hashedPassword,
            province: session.selectedProvince!,
            district: session.selectedDistrict!,
            sector: session.selectedSector!,
            cell: session.selectedCell!,
            village: session.selectedVillage!,
            preferredLanguage: lang,
          },
        });

        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "registrationSuccessful")}`;
      } catch (err) {
        console.error("DB Error:", err);
        delete ussdSessions[sessionId];
        return `END ${getTranslation(lang, "registrationFailed")}`;
      }
    }

    return `END ${getTranslation(lang, "invalidCategory")}`;
  }

  // For returning users, handle main menu options
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

        if (categoryChoice === "00") {
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
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }

          // Build product menu with pagination
          const productNames = products.map((product) => product.productName);
          const paginated = paginateLocationList(productNames, 1);
          let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;

          paginated.items.forEach((product, index) => {
            const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
            productMenu += `${itemNumber}. ${product}\n`;
          });

          // Add navigation options
          let navOptions: string[] = [];
          if (paginated.hasNext) {
            navOptions.push(`99. ${getTranslation(lang, "next")}`);
          }

          navOptions.push(`0. ${getTranslation(lang, "back")}`);
          navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

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
            const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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
          navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

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
            const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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
          navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

          if (navOptions.length > 0) {
            productMenu += navOptions.join("\n");
          }

          return productMenu;
        }

        if (productChoice === "0") {
          return await buildCategoryMenu(lang, session.categoryPage || 1);
        }

        if (productChoice === "00") {
          delete ussdSessions[sessionId];
          return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
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
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        } else {
          const paginated = paginateLocationList(
            products.map((product) => product.productName),
            session.productPage || 1
          );
          let productMenu = `CON ${getTranslation(lang, "invalidProduct")}

${getTranslation(lang, "selectProduct")}\n`;

          paginated.items.forEach((product, index) => {
            const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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
          navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

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
            const itemNumber = (paginated.currentPage - 1) * 3 + index + 1;
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
          navOptions.push(`00. ${getTranslation(lang, "mainMenu")}`);

          if (navOptions.length > 0) {
            productMenu += navOptions.join("\n");
          }

          return productMenu;
        }

        if (quantityInput === "00") {
          delete ussdSessions[sessionId];
          return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
        }

        const quantity = parseFloat(quantityInput);
        if (isNaN(quantity) || quantity <= 0) {
          return `CON ${getTranslation(lang, "invalidQuantity")}

${getTranslation(lang, "enterQuantity")} (${session.selectedProductUnit})
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        session.quantity = quantityInput;
        addToHistory(session, "quantityInput");

        return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      // Handle price input
      if (parts.length === 5) {
        const priceInput = parts[4];

        if (priceInput === "0") {
          return `CON ${getTranslation(lang, "enterQuantity")} (${
            session.selectedProductUnit
          })
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (priceInput === "00") {
          delete ussdSessions[sessionId];
          return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
        }

        const price = parseFloat(priceInput);
        if (isNaN(price) || price <= 0) {
          return `CON ${getTranslation(lang, "invalidPrice")}

${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        session.wishedPrice = priceInput;
        addToHistory(session, "priceInput");

        return `CON ${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      // Handle PIN confirmation for submission
      if (parts.length === 6) {
        const pinInput = parts[5];

        if (pinInput === "0") {
          return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (pinInput === "00") {
          delete ussdSessions[sessionId];
          return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
        }

        if (!/^\d{4}$/.test(pinInput)) {
          return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        const pinValid = await verifyUserPin(phoneNumber, pinInput);
        if (!pinValid) {
          return `CON ${getTranslation(lang, "incorrectPin")}

${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
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

    // 2. Help - Improved with only 3 contact options
    case "2": {
      session.mode = "help";

      if (parts.length === 1) {
        addToHistory(session, "mainMenu");
        return `CON ${getTranslation(lang, "helpMenu")}
${getTranslation(lang, "callUs")}: *SHORT_CODE*
${getTranslation(lang, "whatsapp")}: +250XXXXXXXXX
${getTranslation(lang, "email")}: support@agrichain.com

0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      if (parts[1] === "0") {
        delete ussdSessions[sessionId];
        return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
      }

      return `CON ${getTranslation(lang, "helpMenu")}
${getTranslation(lang, "callUs")}: *SHORT_CODE*
${getTranslation(lang, "whatsapp")}: +250XXXXXXXXX
${getTranslation(lang, "email")}: support@agrichain.com

0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
    }

    // 3. My Account
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
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      // Check submissions with pagination (3 items)
      if (parts[1] === "1") {
        if (parts.length === 2) {
          return `CON ${getTranslation(lang, "enterPasswordForSubmissions")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (parts.length === 3) {
          const pinInput = parts[2];

          if (pinInput === "0") {
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }

          if (pinInput === "00") {
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
          }

          const pinValid = await verifyUserPin(phoneNumber, pinInput);
          if (!pinValid) {
            return `END ${getTranslation(
              lang,
              "incorrectPasswordSubmissions"
            )}`;
          }

          try {
            const submissions = await prisma.farmerSubmission.findMany({
              where: { farmerId: farmer.id },
              take: 3,
              orderBy: { createdAt: "asc" },
            });

            if (submissions.length === 0) {
              return `END ${getTranslation(lang, "noOrders")}`;
            }

            let response = `END ${getTranslation(lang, "lastThreeOrders")}\n\n`;
            submissions.forEach((submission, index) => {
              response += `${index + 1}. ${submission.productName}\n`;
              response += `   ${submission.submittedQty}${
                session.selectedProductUnit || "kg"
              } @ ${submission.wishedPrice} RWF/${
                session.selectedProductUnit || "kg"
              }\n`;
              response += `   Status: ${submission.status}\n\n`;
            });

            return response.trim();
          } catch (error) {
            console.error("Error fetching submissions:", error);
            return `END ${getTranslation(lang, "submissionFailed")}`;
          }
        }
      }

      // Change language
      if (parts[1] === "2") {
        if (parts.length === 2) {
          return `CON ${getTranslation(lang, "enterPasswordForLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (parts.length === 3) {
          const pinInput = parts[2];

          if (pinInput === "0") {
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }

          if (pinInput === "00") {
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
          }

          const pinValid = await verifyUserPin(phoneNumber, pinInput);
          if (!pinValid) {
            return `END ${getTranslation(lang, "incorrectPasswordLanguage")}`;
          }

          return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (parts.length === 4) {
          const langChoice = parts[3];

          if (langChoice === "0") {
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }

          if (langChoice === "00") {
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
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
              return `END ${getTranslation(lang, "registrationFailed")}`;
            }
          } else {
            return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }
        }
      }

      if (parts[1] === "0") {
        delete ussdSessions[sessionId];
        return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "submitProduct")}
2. ${getTranslation(lang, "help")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "exit")}`;
      }

      return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
    }

    // 4. Exit
    case "4":
      delete ussdSessions[sessionId];
      return `END ${getTranslation(lang, "exitMessage")}`;
  }

  return "END Invalid input. Try again.";
}
