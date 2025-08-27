import prisma from "../prisma";
import {
  ISessionData,
  IUssdRequest,
  TranslationKey,
  translations,
} from "../types/productTypes";
import { comparePassword, hashPassword } from "../utils/password";
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

  paginated.items.forEach((item, index) => {
    const itemNumber = (paginated.currentPage - 1) * 8 + index + 1;
    menu += `${itemNumber}. ${item}\n`;
  });

  // Add navigation options
  let navOptions: string[] = [];
  if (paginated.hasPrev)
    navOptions.push(`8. ${getTranslation(lang, "previous")}`);
  if (paginated.hasNext) navOptions.push(`9. ${getTranslation(lang, "next")}`);
  if (backOption) navOptions.push(`0. ${getTranslation(lang, "back")}`);

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

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: IUssdRequest): Promise<string> {
  const parts = text.split("*");

  // Initialize session with user's preferred language from database
  let session = ussdSessions[sessionId];
  if (!session) {
    const userLanguage = await getUserLanguage(phoneNumber);
    session = { language: userLanguage };
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

        // Handle back option
        if (parts[1] === "0") {
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
        }

        if (parts[1] === "9" && currentPage < Math.ceil(provinces.length / 8)) {
          // Next page
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            provinces,
            session.locationPage,
            "selectProvince",
            lang
          );
        }

        if (parts[1] === "8" && currentPage > 1) {
          // Previous page
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            provinces,
            session.locationPage,
            "selectProvince",
            lang
          );
        }

        // Province selection
        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < provinces.length) {
          session.selectedProvince = provinces[selectedIndex];
          session.locationStep = "district";
          session.locationPage = 1;
          addToHistory(session, "province", { page: currentPage });

          const districts = LocationValidationService.getDistrictsByProvince(
            session.selectedProvince
          );
          return buildLocationMenu(districts, 1, "selectDistrict", lang);
        }

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

      if (session.locationStep === "district") {
        if (parts[1] === "0") {
          // Back to province
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
        }

        const districts = LocationValidationService.getDistrictsByProvince(
          session.selectedProvince!
        );
        const currentPage = session.locationPage || 1;

        if (parts[1] === "9" && currentPage < Math.ceil(districts.length / 8)) {
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            districts,
            session.locationPage,
            "selectDistrict",
            lang
          );
        }

        if (parts[1] === "8" && currentPage > 1) {
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            districts,
            session.locationPage,
            "selectDistrict",
            lang
          );
        }

        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < districts.length) {
          session.selectedDistrict = districts[selectedIndex];
          session.locationStep = "sector";
          session.locationPage = 1;
          addToHistory(session, "district", { page: currentPage });

          const sectors = LocationValidationService.getSectorsByDistrict(
            session.selectedProvince!,
            session.selectedDistrict
          );
          return buildLocationMenu(sectors, 1, "selectSector", lang);
        }

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

      if (session.locationStep === "sector") {
        if (parts[1] === "0") {
          // Back to district
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
        }

        const sectors = LocationValidationService.getSectorsByDistrict(
          session.selectedProvince!,
          session.selectedDistrict!
        );
        const currentPage = session.locationPage || 1;

        if (parts[1] === "9" && currentPage < Math.ceil(sectors.length / 8)) {
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            sectors,
            session.locationPage,
            "selectSector",
            lang
          );
        }

        if (parts[1] === "8" && currentPage > 1) {
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            sectors,
            session.locationPage,
            "selectSector",
            lang
          );
        }

        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < sectors.length) {
          session.selectedSector = sectors[selectedIndex];
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

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

      if (session.locationStep === "cell") {
        if (parts[1] === "0") {
          // Back to sector
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
        }

        const cells = LocationValidationService.getCellsBySector(
          session.selectedProvince!,
          session.selectedDistrict!,
          session.selectedSector!
        );
        const currentPage = session.locationPage || 1;

        if (parts[1] === "9" && currentPage < Math.ceil(cells.length / 8)) {
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            cells,
            session.locationPage,
            "selectCell",
            lang
          );
        }

        if (parts[1] === "8" && currentPage > 1) {
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            cells,
            session.locationPage,
            "selectCell",
            lang
          );
        }

        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < cells.length) {
          session.selectedCell = cells[selectedIndex];
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

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

      if (session.locationStep === "village") {
        if (parts[1] === "0") {
          // Back to cell
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
        }

        const villages = LocationValidationService.getVillagesByCell(
          session.selectedProvince!,
          session.selectedDistrict!,
          session.selectedSector!,
          session.selectedCell!
        );
        const currentPage = session.locationPage || 1;

        if (parts[1] === "9" && currentPage < Math.ceil(villages.length / 8)) {
          session.locationPage = currentPage + 1;
          return buildLocationMenu(
            villages,
            session.locationPage,
            "selectVillage",
            lang
          );
        }

        if (parts[1] === "8" && currentPage > 1) {
          session.locationPage = currentPage - 1;
          return buildLocationMenu(
            villages,
            session.locationPage,
            "selectVillage",
            lang
          );
        }

        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < villages.length) {
          session.selectedVillage = villages[selectedIndex];
          session.locationStep = "completed";
          addToHistory(session, "village", { page: currentPage });
          return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}`;
        }

        return `CON ${getTranslation(lang, "invalidCategory")}`;
      }

      // PIN creation and confirmation
      if (session.locationStep === "completed" && parts.length === 2) {
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

        const password = parts[1];

        if (!/^\d{4}$/.test(password)) {
          return `END ${getTranslation(lang, "invalidPin")}`;
        }

        session.password = password;
        return `CON ${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}`;
      }

      if (session.locationStep === "completed" && parts.length === 3) {
        if (parts[2] === "0") {
          // Back to PIN creation
          session.locationStep = "completed";
          return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}`;
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

      return `END ${getTranslation(lang, "invalidCategory")}`;
    }

    // 2. Submit Product
    case "2": {
      session.mode = "submit";

      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) {
        return `END ${getTranslation(lang, "pleaseRegister")}`;
      }

      if (parts.length === 1) {
        session.productPage = 1;
        addToHistory(session, "mainMenu");
        const products = await getProductsFromDatabase();

        if (products.length <= 8) {
          // Show all products without pagination
          let menu = `CON ${getTranslation(lang, "selectProduct")}\n`;
          products.forEach((product, index) => {
            menu += `${index + 1}. ${product}\n`;
          });
          menu += `0. ${getTranslation(lang, "back")}`;
          return menu;
        } else {
          // Use pagination
          return buildLocationMenu(products, 1, "selectProduct", lang);
        }
      }

      if (parts.length === 2) {
        const products = await getProductsFromDatabase();
        const currentPage = session.productPage || 1;

        // Handle back option
        if (parts[1] === "0") {
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
        }

        // Handle pagination for products
        if (products.length > 8) {
          if (
            parts[1] === "9" &&
            currentPage < Math.ceil(products.length / 8)
          ) {
            session.productPage = currentPage + 1;
            return buildLocationMenu(
              products,
              session.productPage,
              "selectProduct",
              lang
            );
          }

          if (parts[1] === "8" && currentPage > 1) {
            session.productPage = currentPage - 1;
            return buildLocationMenu(
              products,
              session.productPage,
              "selectProduct",
              lang
            );
          }
        }

        // Product selection
        const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
        if (selectedIndex >= 0 && selectedIndex < products.length) {
          session.selectedProduct = products[selectedIndex];
          addToHistory(session, "productSelection", { page: currentPage });
          return `CON ${getTranslation(lang, "enterQuantity")}
0. ${getTranslation(lang, "back")}`;
        }

        return `END ${getTranslation(lang, "invalidProduct")}`;
      }

      if (parts.length === 3) {
        // Handle back option
        if (parts[2] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "productSelection") {
            session.productPage = prevStep.data.page || 1;
            const products = await getProductsFromDatabase();

            if (products.length <= 8) {
              let menu = `CON ${getTranslation(lang, "selectProduct")}\n`;
              products.forEach((product, index) => {
                menu += `${index + 1}. ${product}\n`;
              });
              menu += `0. ${getTranslation(lang, "back")}`;
              return menu;
            } else {
              return buildLocationMenu(
                products,
                session.productPage ?? 1,
                "selectProduct",
                lang
              );
            }
          }
        }

        const quantity = parts[2];

        if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
          return `END ${getTranslation(lang, "invalidQuantity")}`;
        }

        session.quantity = quantity;
        addToHistory(session, "quantityEntry");
        return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
      }

      if (parts.length === 4) {
        // Handle back option
        if (parts[3] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "quantityEntry") {
            return `CON ${getTranslation(lang, "enterQuantity")}
0. ${getTranslation(lang, "back")}`;
          }
        }

        const wishedPrice = parts[3];

        if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
          return `END ${getTranslation(lang, "invalidPrice")}`;
        }

        session.wishedPrice = wishedPrice;
        addToHistory(session, "priceEntry");
        return `CON ${getTranslation(lang, "enterPinConfirm")}
0. ${getTranslation(lang, "back")}`;
      }

      if (parts.length === 5) {
        // Handle back option
        if (parts[4] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "priceEntry") {
            return `CON ${getTranslation(lang, "enterPrice")}
0. ${getTranslation(lang, "back")}`;
          }
        }

        const enteredPassword = parts[4];

        if (!/^\d{4}$/.test(enteredPassword)) {
          return `END ${getTranslation(lang, "invalidPin")}`;
        }

        const isMatch = await comparePassword(
          enteredPassword,
          farmer.password ?? ""
        );
        if (!isMatch) {
          return `END ${getTranslation(lang, "incorrectPin")}`;
        }

        try {
          await prisma.farmerSubmission.create({
            data: {
              farmerId: farmer.id,
              productName: session.selectedProduct!,
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
        } catch (err) {
          console.error("DB Error:", err);
          delete ussdSessions[sessionId];
          return `END ${getTranslation(lang, "submissionFailed")}`;
        }
      }

      return `END ${getTranslation(lang, "invalidCategory")}`;
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
        return `CON ${getTranslation(lang, "myAccount")}:
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
      }

      // Handle back option
      if (parts.length === 2 && parts[1] === "0") {
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
      }

      // 3.1 Check Submissions
      if (parts[1] === "1") {
        // Step 1: Ask for PIN to view submissions
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          return `CON ${getTranslation(lang, "enterPasswordForSubmissions")}
0. ${getTranslation(lang, "back")}`;
        }

        // Handle back option
        if (parts.length === 3 && parts[2] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "accountMenu") {
            return `CON ${getTranslation(lang, "myAccount")}:
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
          }
        }

        // Step 2: Verify PIN and show submissions
        if (parts.length === 3) {
          const enteredPassword = parts[2];

          if (!/^\d{4}$/.test(enteredPassword)) {
            return `END ${getTranslation(lang, "invalidPin")}`;
          }

          const isMatch = await comparePassword(
            enteredPassword,
            farmer.password ?? ""
          );

          if (!isMatch) {
            return `END ${getTranslation(
              lang,
              "incorrectPasswordSubmissions"
            )}`;
          }

          // PIN is correct, now show submissions
          try {
            const submissions = await prisma.farmerSubmission.findMany({
              where: { farmerId: farmer.id },
              orderBy: { submittedAt: "desc" },
              take: 3,
              select: {
                productName: true,
                submittedQty: true,
                wishedPrice: true,
                status: true,
                submittedAt: true,
              },
            });

            if (submissions.length === 0) {
              return `END ${getTranslation(lang, "noOrders")}`;
            }

            let response = `END ${getTranslation(lang, "lastThreeOrders")}\n`;
            submissions.forEach((sub, index) => {
              const date = sub.submittedAt.toISOString().split("T")[0];
              response += `${index + 1}. ${sub.productName}\n`;
              response += `   ${sub.submittedQty}kg - ${sub.wishedPrice} RWF\n`;
              response += `   Status: ${sub.status} (${date})\n\n`;
            });

            return response.trim();
          } catch (err) {
            console.error("DB Error:", err);
            return `END Error fetching submissions.`;
          }
        }
      }

      // 3.2 Change Language
      if (parts[1] === "2") {
        if (parts.length === 2) {
          addToHistory(session, "accountMenu");
          // Show language selection
          return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}`;
        }

        // Handle back option
        if (parts.length === 3 && parts[2] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "accountMenu") {
            return `CON ${getTranslation(lang, "myAccount")}:
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}`;
          }
        }

        if (parts.length === 3) {
          const languageChoice = parts[2];

          if (
            languageChoice !== "1" &&
            languageChoice !== "2" &&
            languageChoice !== "3"
          ) {
            return `END Invalid language selection. Please try again.`;
          }

          // Store selected language in session temporarily
          session.selectedNewLanguage =
            languageChoice === "1"
              ? "KINY"
              : languageChoice === "2"
              ? "ENG"
              : "FRE";
          addToHistory(session, "languageSelection");
          return `CON ${getTranslation(lang, "enterPasswordForLanguage")}
0. ${getTranslation(lang, "back")}`;
        }

        // Handle back option
        if (parts.length === 4 && parts[3] === "0") {
          const prevStep = getPreviousStep(session);
          if (prevStep && prevStep.step === "languageSelection") {
            return `CON ${getTranslation(lang, "selectLanguage")}
1. Kinyarwanda
2. English
3. Français
0. ${getTranslation(lang, "back")}`;
          }
        }

        if (parts.length === 4) {
          const enteredPassword = parts[3];

          if (!/^\d{4}$/.test(enteredPassword)) {
            return `END ${getTranslation(lang, "invalidPin")}`;
          }

          const isMatch = await comparePassword(
            enteredPassword,
            farmer.password ?? ""
          );

          if (!isMatch) {
            return `END ${getTranslation(lang, "incorrectPasswordLanguage")}`;
          }

          try {
            // Apply the selected language
            const newLanguage = session.selectedNewLanguage as
              | "KINY"
              | "ENG"
              | "FRE";

            // Update language preference in database
            await updateUserLanguage(phoneNumber, newLanguage);

            // Update session language
            session.language = newLanguage;

            // Clean up temporary selection
            delete session.selectedNewLanguage;

            return `END ${getTranslation(newLanguage, "languageChanged")}`;
          } catch (error) {
            console.error("Error saving language preference:", error);
            return `END Failed to save language preference. Please try again.`;
          }
        }
      }

      return "END Invalid account option.";
    }

    // 4. Help Section
    case "4": {
      session.mode = "help";

      if (parts.length === 1) {
        addToHistory(session, "mainMenu");
        return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "supportContact")}
2. ${getTranslation(lang, "productPrices")}
0. ${getTranslation(lang, "back")}`;
      }

      // Handle back option
      if (parts.length === 2 && parts[1] === "0") {
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
      }

      // 4.1 Support Contact
      if (parts[1] === "1") {
        return `END ${getTranslation(lang, "supportNumber")}`;
      }

      // 4.2 Product Prices
      if (parts[1] === "2") {
        try {
          const pricesInfo = await getCurrentProductPrices(lang);
          return `END ${pricesInfo}`;
        } catch (error) {
          console.error("Error fetching prices:", error);
          return `END ${getTranslation(lang, "noPricesAvailable")}`;
        }
      }

      return "END Invalid help option.";
    }

    // 5. Exit
    case "5":
      delete ussdSessions[sessionId];
      return `END ${getTranslation(lang, "exitMessage")}`;
  }

  return "END Invalid input. Try again.";
}
