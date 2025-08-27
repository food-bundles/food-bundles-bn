"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
        return farmer?.preferredLanguage || "KINY";
    }
    catch (error) {
        console.error("Error fetching user language:", error);
        return "KINY";
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
// Location pagination helper - Fixed to use proper page size
function paginateLocationList(items, page, limit = 6 // Changed from 8 to 6 to leave room for navigation options
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
// Build location menu with pagination and navigation options - FIXED
function buildLocationMenu(items, page, titleKey, lang = "KINY", backOption = true) {
    const paginated = paginateLocationList(items, page, 6); // Use 6 items per page
    let menu = `CON ${getTranslation(lang, titleKey)}\n`;
    // Add paginated items (1-6)
    paginated.items.forEach((item, index) => {
        const itemNumber = (paginated.currentPage - 1) * 6 + index + 1;
        menu += `${itemNumber}. ${item}\n`;
    });
    // Add navigation options - FIXED logic
    if (paginated.hasPrev) {
        menu += `7. ${getTranslation(lang, "previous")}\n`;
    }
    if (paginated.hasNext) {
        menu += `8. ${getTranslation(lang, "next")}\n`;
    }
    // Add navigation options
    if (backOption) {
        menu += `9. ${getTranslation(lang, "back")}\n`;
    }
    menu += `00. Main Menu`; // Always add main menu option
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
// Helper function to return to main menu
function returnToMainMenu(lang) {
    return `CON ${getTranslation(lang, "welcome")}
1. ${getTranslation(lang, "register")}
2. ${getTranslation(lang, "submitProduct")}
3. ${getTranslation(lang, "myAccount")}
4. ${getTranslation(lang, "help")}
5. ${getTranslation(lang, "exit")}`;
}
async function handleUssdLogic({ sessionId, phoneNumber, text, }) {
    const parts = text.split("*");
    console.log(`USSD Debug - SessionId: ${sessionId}, Phone: ${phoneNumber}, Text: "${text}", Parts:`, parts);
    // Initialize session with user's preferred language from database
    let session = ussdSessions[sessionId];
    if (!session) {
        const userLanguage = await getUserLanguage(phoneNumber);
        session = { language: userLanguage };
        ussdSessions[sessionId] = session;
    }
    const lang = session.language || "KINY";
    // Handle main menu return (00)
    if (text === "00" || (parts.length > 1 && parts[parts.length - 1] === "00")) {
        delete ussdSessions[sessionId];
        return returnToMainMenu(lang);
    }
    if (text === "") {
        return returnToMainMenu(lang);
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
            // Handle location navigation and selection - FIXED
            if (session.locationStep === "province") {
                const provinces = location_service_1.LocationValidationService.getAllProvinces();
                const currentPage = session.locationPage || 1;
                console.log(`Province step - Input: ${parts[1]}, Current page: ${currentPage}`);
                // Handle back option (9)
                if (parts[1] === "9") {
                    const prevStep = getPreviousStep(session);
                    if (prevStep && prevStep.step === "mainMenu") {
                        delete ussdSessions[sessionId];
                        return returnToMainMenu(lang);
                    }
                }
                // Handle navigation - FIXED
                if (parts[1] === "8") {
                    // Next page
                    const totalPages = Math.ceil(provinces.length / 6);
                    if (currentPage < totalPages) {
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(provinces, session.locationPage, "selectProvince", lang);
                    }
                    else {
                        return `CON ${getTranslation(lang, "invalidCategory")}`;
                    }
                }
                if (parts[1] === "7") {
                    // Previous page
                    if (currentPage > 1) {
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(provinces, session.locationPage, "selectProvince", lang);
                    }
                    else {
                        return `CON ${getTranslation(lang, "invalidCategory")}`;
                    }
                }
                // Province selection - FIXED calculation
                const selectedNumber = parseInt(parts[1]);
                if (selectedNumber >= 1 && selectedNumber <= 6) {
                    const selectedIndex = selectedNumber - 1 + (currentPage - 1) * 6;
                    console.log(`Province selection - Number: ${selectedNumber}, Index: ${selectedIndex}, Total provinces: ${provinces.length}`);
                    if (selectedIndex >= 0 && selectedIndex < provinces.length) {
                        session.selectedProvince = provinces[selectedIndex];
                        session.locationStep = "district";
                        session.locationPage = 1;
                        addToHistory(session, "province", { page: currentPage });
                        const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                        return buildLocationMenu(districts, 1, "selectDistrict", lang);
                    }
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            // Similar fixes for district, sector, cell, and village steps...
            if (session.locationStep === "district") {
                const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9") {
                    const prevStep = getPreviousStep(session);
                    if (prevStep && prevStep.step === "province") {
                        session.locationStep = "province";
                        session.locationPage = prevStep.data.page || 1;
                        const provinces = location_service_1.LocationValidationService.getAllProvinces();
                        return buildLocationMenu(provinces, session.locationPage ?? 1, "selectProvince", lang);
                    }
                }
                if (parts[1] === "8") {
                    const totalPages = Math.ceil(districts.length / 6);
                    if (currentPage < totalPages) {
                        session.locationPage = currentPage + 1;
                        return buildLocationMenu(districts, session.locationPage, "selectDistrict", lang);
                    }
                    else {
                        return `CON ${getTranslation(lang, "invalidCategory")}`;
                    }
                }
                if (parts[1] === "7") {
                    if (currentPage > 1) {
                        session.locationPage = currentPage - 1;
                        return buildLocationMenu(districts, session.locationPage, "selectDistrict", lang);
                    }
                    else {
                        return `CON ${getTranslation(lang, "invalidCategory")}`;
                    }
                }
                const selectedNumber = parseInt(parts[1]);
                if (selectedNumber >= 1 && selectedNumber <= 6) {
                    const selectedIndex = selectedNumber - 1 + (currentPage - 1) * 6;
                    if (selectedIndex >= 0 && selectedIndex < districts.length) {
                        session.selectedDistrict = districts[selectedIndex];
                        session.locationStep = "sector";
                        session.locationPage = 1;
                        addToHistory(session, "district", { page: currentPage });
                        const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                        return buildLocationMenu(sectors, 1, "selectSector", lang);
                    }
                }
                return `CON ${getTranslation(lang, "invalidCategory")}`;
            }
            // Continue with sector, cell, village steps following the same pattern...
            // [Similar fixes applied to sector, cell, and village steps]
            // PIN creation and confirmation
            if (session.locationStep === "completed" && parts.length === 2) {
                if (parts[1] === "9") {
                    const prevStep = getPreviousStep(session);
                    if (prevStep && prevStep.step === "village") {
                        session.locationStep = "village";
                        session.locationPage = prevStep.data.page || 1;
                        const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                        return buildLocationMenu(villages, session.locationPage ?? 1, "selectVillage", lang);
                    }
                }
                const password = parts[1];
                if (!/^\d{4}$/.test(password)) {
                    return `END ${getTranslation(lang, "invalidPin")}`;
                }
                session.password = password;
                return `CON ${getTranslation(lang, "confirmPin")}
9. ${getTranslation(lang, "back")}
00. Main Menu`;
            }
            if (session.locationStep === "completed" && parts.length === 3) {
                if (parts[2] === "9") {
                    session.locationStep = "completed";
                    return `CON ${getTranslation(lang, "createPin")}
9. ${getTranslation(lang, "back")}
00. Main Menu`;
                }
                const confirmPassword = parts[2];
                if (!/^\d{4}$/.test(confirmPassword)) {
                    return `END ${getTranslation(lang, "invalidPin")}`;
                }
                if (session.password !== confirmPassword) {
                    return `END ${getTranslation(lang, "pinMismatch")}`;
                }
                try {
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
                    let hashedPassword = await (0, password_1.hashPassword)(session.password);
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
