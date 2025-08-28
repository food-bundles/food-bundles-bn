"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveProductCategories = getActiveProductCategories;
exports.getProductsByCategory = getProductsByCategory;
exports.getProductsFromDatabase = getProductsFromDatabase;
exports.handleUssdLogic = handleUssdLogic;
const prisma_1 = __importDefault(require("../prisma"));
const productTypes_1 = require("../types/productTypes");
const password_1 = require("../utils/password");
const location_service_1 = require("./location.service");
let ussdSessions = {};
// Helper function to get translation
function getTranslation(lang = "KINY", key) {
    return productTypes_1.translations[lang][key] || productTypes_1.translations.ENG[key];
}
// Helper function to get user's preferred language from database
async function getUserLanguage(phoneNumber) {
    try {
        const farmer = await prisma_1.default.farmer.findUnique({
            where: { phone: phoneNumber },
            select: { preferredLanguage: true },
        });
        // Return saved language or default to KINY
        return farmer?.preferredLanguage || "KINY";
    }
    catch (error) {
        console.error("Error fetching user language:", error);
        return "KINY"; // Default fallback
    }
}
// Helper function to update user's language preference in database
async function updateUserLanguage(phoneNumber, language) {
    try {
        await prisma_1.default.farmer.update({
            where: { phone: phoneNumber },
            data: { preferredLanguage: language },
        });
    }
    catch (error) {
        console.error("Error updating user language:", error);
        throw new Error("Failed to update language preference");
    }
}
// Get active product categories from database
async function getActiveProductCategories() {
    try {
        const categories = await prisma_1.default.productCategory.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        });
        return categories;
    }
    catch (error) {
        console.error("Error fetching categories:", error);
        // Fallback to empty array - you might want to handle this differently
        return [];
    }
}
// Get products by category from database
async function getProductsByCategory(categoryId) {
    try {
        const products = await prisma_1.default.product.findMany({
            where: {
                categoryId: categoryId,
                status: "ACTIVE",
            },
            select: { productName: true },
            orderBy: { productName: "asc" },
        });
        return products.map((p) => p.productName);
    }
    catch (error) {
        console.error("Error fetching products by category:", error);
        return [];
    }
}
// Get products from database
async function getProductsFromDatabase() {
    try {
        const products = await prisma_1.default.product.findMany({
            where: { status: "ACTIVE" },
            select: { productName: true },
            distinct: ["productName"],
        });
        return products.map((p) => p.productName);
    }
    catch (error) {
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
function paginateLocationList(items, page, limit = 8) {
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
function buildLocationMenu(items, page, titleKey, lang = "KINY", backOption = true) {
    const paginated = paginateLocationList(items, page);
    let menu = `CON ${getTranslation(lang, titleKey)}\n`;
    // Add items with proper numbering
    paginated.items.forEach((item, index) => {
        const itemNumber = (paginated.currentPage - 1) * 8 + index + 1;
        menu += `${itemNumber}. ${item}\n`;
    });
    // Add navigation options with special handling
    let navOptions = [];
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
// Build product category menu
async function buildCategoryMenu(lang = "KINY") {
    const categories = await getActiveProductCategories();
    let menu = `CON ${getTranslation(lang, "selectCategory")}\n`;
    categories.forEach((category, index) => {
        menu += `${index + 1}. ${category.name}\n`;
    });
    menu += `0. ${getTranslation(lang, "back")}\n`;
    menu += `00. ${getTranslation(lang, "mainMenu")}`;
    return menu;
}
// Add step to navigation history
function addToHistory(session, step, data) {
    if (!session.previousSteps) {
        session.previousSteps = [];
    }
    session.previousSteps.push({ step, data });
}
// Get previous step from navigation history
function getPreviousStep(session) {
    if (!session.previousSteps || session.previousSteps.length === 0) {
        return null;
    }
    return session.previousSteps.pop() || null;
}
// Helper function to get current product prices
async function getCurrentProductPrices(lang) {
    try {
        const products = await prisma_1.default.product.findMany({
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
    }
    catch (error) {
        console.error("Error fetching product prices:", error);
        return getTranslation(lang, "noPricesAvailable");
    }
}
// Helper function to handle pagination navigation
function handlePaginationNavigation(parts, session, items, currentStep) {
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
    if (!isNaN(selectedIndex) &&
        selectedIndex >= 0 &&
        selectedIndex < totalItems) {
        return { action: "select", selectedIndex };
    }
    return { action: null };
}
// Helper function to verify user PIN
async function verifyUserPin(phoneNumber, pin) {
    try {
        const farmer = await prisma_1.default.farmer.findUnique({
            where: { phone: phoneNumber },
            select: { password: true },
        });
        if (!farmer)
            return false;
        // Use your password verification function
        const bcrypt = require("bcrypt");
        return await bcrypt.compare(pin, farmer.password);
    }
    catch (error) {
        console.error("Error verifying PIN:", error);
        return false;
    }
}
async function handleUssdLogic({ sessionId, phoneNumber, text, }) {
    const parts = text.split("*");
    console.log(`USSD Request - Session: ${sessionId}, Phone: ${phoneNumber}, Text: ${text}, Parts: ${JSON.stringify(parts)}`);
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
            const existingUser = await prisma_1.default.farmer.findUnique({
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
                const provinces = location_service_1.LocationValidationService.getAllProvinces();
                return buildLocationMenu(provinces, 1, "selectProvince", lang);
            }
            // Handle location navigation and selection
            if (session.locationStep === "province") {
                const provinces = location_service_1.LocationValidationService.getAllProvinces();
                const currentPage = session.locationPage || 1;
                const navigation = handlePaginationNavigation(parts, session, provinces, "province");
                switch (navigation.action) {
                    case "next":
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(provinces, session.locationPage, "selectProvince", lang);
                    case "prev":
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(provinces, session.locationPage, "selectProvince", lang);
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
                        if (navigation.selectedIndex !== undefined &&
                            navigation.selectedIndex >= 0 &&
                            navigation.selectedIndex < provinces.length) {
                            session.selectedProvince = provinces[navigation.selectedIndex];
                            session.locationStep = "district";
                            session.locationPage = 1;
                            addToHistory(session, "province", { page: currentPage });
                            const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                            return buildLocationMenu(districts, 1, "selectDistrict", lang);
                        }
                        break;
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            if (session.locationStep === "district") {
                const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                const currentPage = session.locationPage || 1;
                const navigation = handlePaginationNavigation(parts, session, districts, "district");
                switch (navigation.action) {
                    case "next":
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(districts, session.locationPage, "selectDistrict", lang);
                    case "prev":
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(districts, session.locationPage, "selectDistrict", lang);
                    case "back":
                        const prevStep = getPreviousStep(session);
                        if (prevStep && prevStep.step === "province") {
                            session.locationStep = "province";
                            session.locationPage = prevStep.data.page || 1;
                            const provinces = location_service_1.LocationValidationService.getAllProvinces();
                            return buildLocationMenu(provinces, session.locationPage ?? 1, "selectProvince", lang);
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
                        if (navigation.selectedIndex !== undefined &&
                            navigation.selectedIndex >= 0 &&
                            navigation.selectedIndex < districts.length) {
                            session.selectedDistrict = districts[navigation.selectedIndex];
                            session.locationStep = "sector";
                            session.locationPage = 1;
                            addToHistory(session, "district", { page: currentPage });
                            const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                            return buildLocationMenu(sectors, 1, "selectSector", lang);
                        }
                        break;
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            if (session.locationStep === "sector") {
                const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                const currentPage = session.locationPage || 1;
                const navigation = handlePaginationNavigation(parts, session, sectors, "sector");
                switch (navigation.action) {
                    case "next":
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(sectors, session.locationPage, "selectSector", lang);
                    case "prev":
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(sectors, session.locationPage, "selectSector", lang);
                    case "back":
                        const prevStep = getPreviousStep(session);
                        if (prevStep && prevStep.step === "district") {
                            session.locationStep = "district";
                            session.locationPage = prevStep.data.page || 1;
                            const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                            return buildLocationMenu(districts, session.locationPage ?? 1, "selectDistrict", lang);
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
                        if (navigation.selectedIndex !== undefined &&
                            navigation.selectedIndex >= 0 &&
                            navigation.selectedIndex < sectors.length) {
                            session.selectedSector = sectors[navigation.selectedIndex];
                            session.locationStep = "cell";
                            session.locationPage = 1;
                            addToHistory(session, "sector", { page: currentPage });
                            const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                            return buildLocationMenu(cells, 1, "selectCell", lang);
                        }
                        break;
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            if (session.locationStep === "cell") {
                const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                const currentPage = session.locationPage || 1;
                const navigation = handlePaginationNavigation(parts, session, cells, "cell");
                switch (navigation.action) {
                    case "next":
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(cells, session.locationPage, "selectCell", lang);
                    case "prev":
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(cells, session.locationPage, "selectCell", lang);
                    case "back":
                        const prevStep = getPreviousStep(session);
                        if (prevStep && prevStep.step === "sector") {
                            session.locationStep = "sector";
                            session.locationPage = prevStep.data.page || 1;
                            const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                            return buildLocationMenu(sectors, session.locationPage ?? 1, "selectSector", lang);
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
                        if (navigation.selectedIndex !== undefined &&
                            navigation.selectedIndex >= 0 &&
                            navigation.selectedIndex < cells.length) {
                            session.selectedCell = cells[navigation.selectedIndex];
                            session.locationStep = "village";
                            session.locationPage = 1;
                            addToHistory(session, "cell", { page: currentPage });
                            const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                            return buildLocationMenu(villages, 1, "selectVillage", lang);
                        }
                        break;
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            if (session.locationStep === "village") {
                const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                const currentPage = session.locationPage || 1;
                const navigation = handlePaginationNavigation(parts, session, villages, "village");
                switch (navigation.action) {
                    case "next":
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(villages, session.locationPage, "selectVillage", lang);
                    case "prev":
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(villages, session.locationPage, "selectVillage", lang);
                    case "back":
                        const prevStep = getPreviousStep(session);
                        if (prevStep && prevStep.step === "cell") {
                            session.locationStep = "cell";
                            session.locationPage = prevStep.data.page || 1;
                            const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                            return buildLocationMenu(cells, session.locationPage ?? 1, "selectCell", lang);
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
                        if (navigation.selectedIndex !== undefined &&
                            navigation.selectedIndex >= 0 &&
                            navigation.selectedIndex < villages.length) {
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
                const currentInput = parts[parts.length - 1]; // Get the last input
                if (currentInput === "0") {
                    // Back to village selection
                    const prevStep = getPreviousStep(session);
                    if (prevStep && prevStep.step === "village") {
                        session.locationStep = "village";
                        session.locationPage = prevStep.data.page || 1;
                        const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                        return buildLocationMenu(villages, session.locationPage ?? 1, "selectVillage", lang);
                    }
                    return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                if (currentInput === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                // Validate PIN format
                if (!/^\d{4}$/.test(currentInput)) {
                    return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                // Store the PIN and move to confirmation step
                session.password = currentInput;
                session.locationStep = "confirm_pin";
                addToHistory(session, "completed"); // Track where we came from
                return `CON ${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
            }
            // PIN confirmation step
            if (session.locationStep === "confirm_pin") {
                const confirmInput = parts[parts.length - 1]; // Get the last input
                if (confirmInput === "0") {
                    // Back to PIN creation
                    session.locationStep = "completed";
                    delete session.password; // Clear stored PIN
                    return `CON ${getTranslation(lang, "createPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                if (confirmInput === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                // Validate confirmation PIN format
                if (!/^\d{4}$/.test(confirmInput)) {
                    return `CON ${getTranslation(lang, "invalidPin")}

${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                // Check if PINs match
                if (session.password !== confirmInput) {
                    return `CON ${getTranslation(lang, "pinMismatch")}

${getTranslation(lang, "confirmPin")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                // PINs match - proceed with registration
                try {
                    // Validate complete location hierarchy
                    const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
                        province: session.selectedProvince,
                        district: session.selectedDistrict,
                        sector: session.selectedSector,
                        cell: session.selectedCell,
                        village: session.selectedVillage,
                    });
                    if (!locationValidation.isValid) {
                        delete ussdSessions[sessionId];
                        return `END Location validation failed: ${locationValidation.errors.join(", ")}`;
                    }
                    const hashedPassword = await (0, password_1.hashPassword)(session.password);
                    await prisma_1.default.farmer.create({
                        data: {
                            phone: phoneNumber,
                            password: hashedPassword,
                            province: session.selectedProvince,
                            district: session.selectedDistrict,
                            sector: session.selectedSector,
                            cell: session.selectedCell,
                            village: session.selectedVillage,
                            preferredLanguage: lang,
                        },
                    });
                    delete ussdSessions[sessionId];
                    return `END ${getTranslation(lang, "registrationSuccessful")}`;
                }
                catch (err) {
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
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer) {
                return `END ${getTranslation(lang, "pleaseRegister")}`;
            }
            // Category selection
            if (parts.length === 1) {
                addToHistory(session, "mainMenu");
                return await buildCategoryMenu(lang);
            }
            // Handle category selection
            if (parts.length === 2) {
                const categoryChoice = parts[1];
                if (categoryChoice === "0") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                if (categoryChoice === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                // Get categories from database
                const categories = await getActiveProductCategories();
                const categoryIndex = parseInt(categoryChoice) - 1;
                if (categoryIndex >= 0 && categoryIndex < categories.length) {
                    const selectedCategory = categories[categoryIndex];
                    // Store both ID and name for easy access
                    session.selectedCategoryId = selectedCategory.id;
                    session.selectedCategoryName = selectedCategory.name;
                    addToHistory(session, "categoryMenu");
                    // Get products for selected category from database
                    const products = await getProductsByCategory(selectedCategory.id);
                    if (products.length === 0) {
                        return `CON ${getTranslation(lang, "noCategoryProducts")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                    }
                    let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;
                    products.forEach((product, index) => {
                        productMenu += `${index + 1}. ${product}\n`;
                    });
                    productMenu += `0. ${getTranslation(lang, "back")}\n`;
                    productMenu += `00. ${getTranslation(lang, "mainMenu")}`;
                    return productMenu;
                }
                else {
                    return `CON ${getTranslation(lang, "invalidCategory")}

${await buildCategoryMenu(lang)}`.replace("CON ", "");
                }
            }
            // Handle product selection
            if (parts.length === 3) {
                const productChoice = parts[2];
                if (productChoice === "0") {
                    return await buildCategoryMenu(lang);
                }
                if (productChoice === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                // Get products for the selected category
                const products = await getProductsByCategory(session.selectedCategoryId);
                const productIndex = parseInt(productChoice) - 1;
                if (productIndex >= 0 && productIndex < products.length) {
                    session.selectedProduct = products[productIndex];
                    addToHistory(session, "productMenu");
                    return `CON ${getTranslation(lang, "enterQuantity")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                else {
                    return `CON ${getTranslation(lang, "invalidProduct")}

${getTranslation(lang, "selectProduct")}
${products.map((product, index) => `${index + 1}. ${product}`).join("\n")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
            }
            // Handle quantity input
            if (parts.length === 4) {
                const quantityInput = parts[3];
                if (quantityInput === "0") {
                    // Back to product selection
                    const products = await getProductsByCategory(session.selectedCategoryId);
                    let productMenu = `CON ${getTranslation(lang, "selectProduct")}\n`;
                    products.forEach((product, index) => {
                        productMenu += `${index + 1}. ${product}\n`;
                    });
                    productMenu += `0. ${getTranslation(lang, "back")}\n`;
                    productMenu += `00. ${getTranslation(lang, "mainMenu")}`;
                    return productMenu;
                }
                if (quantityInput === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                }
                const quantity = parseFloat(quantityInput);
                if (isNaN(quantity) || quantity <= 0) {
                    return `CON ${getTranslation(lang, "invalidQuantity")}

${getTranslation(lang, "enterQuantity")}
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
                    return `CON ${getTranslation(lang, "enterQuantity")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
                }
                if (priceInput === "00") {
                    delete ussdSessions[sessionId];
                    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
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
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
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
                    await prisma_1.default.farmerSubmission.create({
                        data: {
                            farmerId: farmer.id,
                            productName: session.selectedProduct,
                            categoryId: session.selectedCategoryId, // Use categoryId instead of category
                            submittedQty: parseFloat(session.quantity),
                            wishedPrice: parseFloat(session.wishedPrice),
                            province: farmer.province,
                            district: farmer.district,
                            sector: farmer.sector,
                            cell: farmer.cell,
                            village: farmer.village,
                        },
                    });
                    delete ussdSessions[sessionId];
                    return `END ${getTranslation(lang, "submissionSuccessful")}`;
                }
                catch (error) {
                    console.error("Product submission error:", error);
                    delete ussdSessions[sessionId];
                    return `END ${getTranslation(lang, "submissionFailed")}`;
                }
            }
            return `END ${getTranslation(lang, "invalidCategory")}`;
        }
        // 3. My Account
        case "3": {
            session.mode = "account";
            const farmer = await prisma_1.default.farmer.findUnique({
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
            // Check submissions
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
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                    }
                    const pinValid = await verifyUserPin(phoneNumber, pinInput);
                    if (!pinValid) {
                        return `END ${getTranslation(lang, "incorrectPasswordSubmissions")}`;
                    }
                    try {
                        const submissions = await prisma_1.default.farmerSubmission.findMany({
                            where: { farmerId: farmer.id },
                            take: 3,
                        });
                        if (submissions.length === 0) {
                            return `END ${getTranslation(lang, "noOrders")}`;
                        }
                        let response = `END ${getTranslation(lang, "lastThreeOrders")}\n\n`;
                        submissions.forEach((submission, index) => {
                            response += `${index + 1}. ${submission.productName}\n`;
                            response += `   ${submission.submittedQty}kg @ ${submission.wishedPrice} RWF/kg\n`;
                            response += `   Status: ${submission.status}\n\n`;
                        });
                        return response.trim();
                    }
                    catch (error) {
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
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
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
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
                    }
                    const languageMap = {
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
                        }
                        catch (error) {
                            console.error("Error updating language:", error);
                            return `END ${getTranslation(lang, "registrationFailed")}`;
                        }
                    }
                    else {
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
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
            }
            return `CON ${getTranslation(lang, "myAccount")}
1. ${getTranslation(lang, "checkSubmissions")}
2. ${getTranslation(lang, "changeLanguage")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }
        // 4. Help
        case "4": {
            session.mode = "help";
            if (parts.length === 1) {
                addToHistory(session, "mainMenu");
                return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "supportContact")}
2. ${getTranslation(lang, "productPrices")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
            }
            if (parts[1] === "1") {
                return `END ${getTranslation(lang, "supportNumber")}`;
            }
            if (parts[1] === "2") {
                const prices = await getCurrentProductPrices(lang);
                return `END ${prices}`;
            }
            if (parts[1] === "0") {
                delete ussdSessions[sessionId];
                return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
            }
            return `CON ${getTranslation(lang, "helpMenu")}
1. ${getTranslation(lang, "supportContact")}
2. ${getTranslation(lang, "productPrices")}
0. ${getTranslation(lang, "back")}
00. ${getTranslation(lang, "mainMenu")}`;
        }
        // 5. Exit
        case "5":
            delete ussdSessions[sessionId];
            return `END ${getTranslation(lang, "exitMessage")}`;
    }
    return "END Invalid input. Try again.";
}
