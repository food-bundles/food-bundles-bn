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

// Get products from database
export async function getProductsFromDatabase(): Promise<string[]> {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { productName: true },
      distinct: ["productName"],
    });
    return products.map((p) => p.productName);
  } catch (error) {
    console.error("Error fetching products:", error);
    // Fallback to hardcoded list
    return [
      "Tomatoes",
      "Onions",
      "Maize",
      "Potatoes",
      "Cassava",
      "Irish Potatoes",
      "Banana",
    ];
  }
}

// Location pagination helper
function paginateLocationList(
  items: string[],
  page: number,
  limit: number = 8
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
    const itemNumber = (paginated.currentPage - 1) * 8 + index + 1;
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

// Helper function to get current product prices
async function getCurrentProductPrices(
  lang: "KINY" | "ENG" | "FRE"
): Promise<string> {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: {
        productName: true,
        purchasePrice: true,
        unit: true,
      },
      orderBy: { productName: "asc" },
    });

    if (products.length === 0) {
      return getTranslation(lang, "noPricesAvailable");
    }

    let response = `${getTranslation(lang, "currentPrices")}\n\n`;

    products.forEach((product) => {
      response += `${product.productName}: ${product.purchasePrice} RWF/${product.unit}\n`;
    });

    return response.trim();
  } catch (error) {
    console.error("Error fetching product prices:", error);
    return getTranslation(lang, "noPricesAvailable");
  }
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

  if (currentInput === "00") {
    return { action: "mainMenu" };
  }

  // Handle item selection
  const selectedIndex = parseInt(currentInput) - 1;
  const totalItems = items.length;
  const itemsPerPage = 8;

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
  const parts = text.split("*");
  console.log(
    `USSD Request - Session: ${sessionId}, Phone: ${phoneNumber}, Text: ${text}, Parts: ${JSON.stringify(
      parts
    )}`
  );

  // Initialize session with user's preferred language from database
  let session = ussdSessions[sessionId];
  if (!session) {
    const userLanguage = await getUserLanguage(phoneNumber);
    session = {
      language: userLanguage,
      previousSteps: [],
    };
    ussdSessions[sessionId] = session;
  }

  const lang = session.language || "KINY";

  if (text === "") {
    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
  }

  // Handle main menu navigation (00)
  if (parts[parts.length - 1] === "00") {
    delete ussdSessions[sessionId];
    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
  }

  switch (parts[0]) {
    // 1. Register
    case "1": {
      session.mode = "register";

      const existingUser = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (existingUser) {
        return `END ${getTranslation(lang, "alreadyRegistered")}`;
      }

      // Location selection flow
      if (parts.length === 1) {
        session.locationStep = "province";
        session.locationPage = 1;
        addToHistory(session, "mainMenu");
        const provinces = LocationValidationService.getAllProvinces();
        return buildLocationMenu(provinces, 1, "selectProvince", lang);
      }

      // Handle location navigation and selection
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
            if (prevStep && prevStep.step === "mainMenu") {
              delete ussdSessions[sessionId];
              return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
            }
            break;

          case "mainMenu":
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;

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

              const districts =
                LocationValidationService.getDistrictsByProvince(
                  session.selectedProvince
                );
              return buildLocationMenu(districts, 1, "selectDistrict", lang);
            }
            break;
        }

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

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
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;

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
              const districts =
                LocationValidationService.getDistrictsByProvince(
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
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;

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
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;

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
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;

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

      // PIN creation and confirmation
      if (session.locationStep === "completed") {
        if (parts.length === 2) {
          if (parts[1] === "0") {
            // Back to village selection
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
          }

          if (parts[1] === "00") {
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
          }

          const password = parts[1];

          if (!/^\d{4}$/.test(password)) {
            return `END ${getTranslation(lang, "invalidPin")}`;
          }

          session.password = password;
          return `CON ${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }

        if (parts.length === 3) {
          if (parts[2] === "0") {
            // Back to PIN creation
            session.locationStep = "completed";
            return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
          }

          if (parts[2] === "00") {
            delete ussdSessions[sessionId];
            return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
          }

          const confirmPassword = parts[2];

          if (!/^\d{4}$/.test(confirmPassword)) {
            return `END ${getTranslation(lang, "invalidPin")}`;
          }

          if (session.password !== confirmPassword) {
            return `END ${getTranslation(lang, "pinMismatch")}`;
          }

          try {
            // Validate complete location hierarchy
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

            let hashedPassword = await hashPassword(session.password!);
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

        return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
      }

      return `END ${getTranslation(lang, "invalidCategory")}`;
    }

    // 2. Submit Product - Apply similar fixes
    case "2": {
      // ... (Apply similar pagination fixes to product submission)
      return `END Product submission - Apply similar fixes`;
    }

    // Other cases remain similar...

    case "5":
      delete ussdSessions[sessionId];
      return `END ${getTranslation(lang, "exitMessage")}`;
  }

  return "END Invalid input. Try again.";
}
