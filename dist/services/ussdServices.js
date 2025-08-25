"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUssdLogic = handleUssdLogic;
exports.submitProductService = submitProductService;
const prisma_1 = __importDefault(require("../prisma"));
const password_1 = require("../utils/password");
const location_service_1 = require("./location.service");
let ussdSessions = {};
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
// Build location menu with pagination
function buildLocationMenu(items, page, title, backOption) {
    const paginated = paginateLocationList(items, page);
    let menu = `CON ${title}:\n`;
    paginated.items.forEach((item, index) => {
        const itemNumber = (paginated.currentPage - 1) * 8 + index + 1;
        menu += `${itemNumber}. ${item}\n`;
    });
    // Add navigation options
    let navOptions = [];
    if (paginated.hasPrev)
        navOptions.push("8. Previous");
    if (paginated.hasNext)
        navOptions.push("9. Next");
    if (backOption)
        navOptions.push("0. Back");
    if (navOptions.length > 0) {
        menu += navOptions.join("\n");
    }
    return menu;
}
async function handleUssdLogic({ sessionId, phoneNumber, text, }) {
    const parts = text.split("*");
    const session = ussdSessions[sessionId] || {};
    ussdSessions[sessionId] = session;
    if (text === "") {
        return `CON Welcome to SmartAgri!
1. Register
2. Submit Product
3. Exit`;
    }
    switch (parts[0]) {
        // 1. Register
        case "1": {
            session.mode = "register";
            const existingUser = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (existingUser) {
                return "END You are already registered.";
            }
            // Location selection flow
            if (parts.length === 1) {
                session.locationStep = "province";
                session.locationPage = 1;
                const provinces = location_service_1.LocationValidationService.getAllProvinces();
                return buildLocationMenu(provinces, 1, "Select your Province");
            }
            // Handle location navigation and selection
            if (session.locationStep === "province") {
                const provinces = location_service_1.LocationValidationService.getAllProvinces();
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9" && currentPage < Math.ceil(provinces.length / 8)) {
                    // Next page
                    session.locationPage = currentPage + 1;
                    return buildLocationMenu(provinces, session.locationPage, "Select your Province");
                }
                if (parts[1] === "8" && currentPage > 1) {
                    // Previous page
                    session.locationPage = currentPage - 1;
                    return buildLocationMenu(provinces, session.locationPage, "Select your Province");
                }
                // Province selection
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < provinces.length) {
                    session.selectedProvince = provinces[selectedIndex];
                    session.locationStep = "district";
                    session.locationPage = 1;
                    const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                    return buildLocationMenu(districts, 1, "Select your District", "Back to Province");
                }
                return "CON Invalid selection. Please try again.";
            }
            if (session.locationStep === "district") {
                if (parts[1] === "0") {
                    // Back to province
                    session.locationStep = "province";
                    session.locationPage = 1;
                    const provinces = location_service_1.LocationValidationService.getAllProvinces();
                    return buildLocationMenu(provinces, 1, "Select your Province");
                }
                const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9" && currentPage < Math.ceil(districts.length / 8)) {
                    session.locationPage = currentPage + 1;
                    return buildLocationMenu(districts, session.locationPage, "Select your District", "Back to Province");
                }
                if (parts[1] === "8" && currentPage > 1) {
                    session.locationPage = currentPage - 1;
                    return buildLocationMenu(districts, session.locationPage, "Select your District", "Back to Province");
                }
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < districts.length) {
                    session.selectedDistrict = districts[selectedIndex];
                    session.locationStep = "sector";
                    session.locationPage = 1;
                    const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                    return buildLocationMenu(sectors, 1, "Select your Sector", "Back to District");
                }
                return "CON Invalid selection. Please try again.";
            }
            if (session.locationStep === "sector") {
                if (parts[1] === "0") {
                    // Back to district
                    session.locationStep = "district";
                    session.locationPage = 1;
                    const districts = location_service_1.LocationValidationService.getDistrictsByProvince(session.selectedProvince);
                    return buildLocationMenu(districts, 1, "Select your District", "Back to Province");
                }
                const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9" && currentPage < Math.ceil(sectors.length / 8)) {
                    session.locationPage = currentPage + 1;
                    return buildLocationMenu(sectors, session.locationPage, "Select your Sector", "Back to District");
                }
                if (parts[1] === "8" && currentPage > 1) {
                    session.locationPage = currentPage - 1;
                    return buildLocationMenu(sectors, session.locationPage, "Select your Sector", "Back to District");
                }
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < sectors.length) {
                    session.selectedSector = sectors[selectedIndex];
                    session.locationStep = "cell";
                    session.locationPage = 1;
                    const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                    return buildLocationMenu(cells, 1, "Select your Cell", "Back to Sector");
                }
                return "CON Invalid selection. Please try again.";
            }
            if (session.locationStep === "cell") {
                if (parts[1] === "0") {
                    // Back to sector
                    session.locationStep = "sector";
                    session.locationPage = 1;
                    const sectors = location_service_1.LocationValidationService.getSectorsByDistrict(session.selectedProvince, session.selectedDistrict);
                    return buildLocationMenu(sectors, 1, "Select your Sector", "Back to District");
                }
                const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9" && currentPage < Math.ceil(cells.length / 8)) {
                    session.locationPage = currentPage + 1;
                    return buildLocationMenu(cells, session.locationPage, "Select your Cell", "Back to Sector");
                }
                if (parts[1] === "8" && currentPage > 1) {
                    session.locationPage = currentPage - 1;
                    return buildLocationMenu(cells, session.locationPage, "Select your Cell", "Back to Sector");
                }
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < cells.length) {
                    session.selectedCell = cells[selectedIndex];
                    session.locationStep = "village";
                    session.locationPage = 1;
                    const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                    return buildLocationMenu(villages, 1, "Select your Village", "Back to Cell");
                }
                return "CON Invalid selection. Please try again.";
            }
            if (session.locationStep === "village") {
                if (parts[1] === "0") {
                    // Back to cell
                    session.locationStep = "cell";
                    session.locationPage = 1;
                    const cells = location_service_1.LocationValidationService.getCellsBySector(session.selectedProvince, session.selectedDistrict, session.selectedSector);
                    return buildLocationMenu(cells, 1, "Select your Cell", "Back to Sector");
                }
                const villages = location_service_1.LocationValidationService.getVillagesByCell(session.selectedProvince, session.selectedDistrict, session.selectedSector, session.selectedCell);
                const currentPage = session.locationPage || 1;
                if (parts[1] === "9" && currentPage < Math.ceil(villages.length / 8)) {
                    session.locationPage = currentPage + 1;
                    return buildLocationMenu(villages, session.locationPage, "Select your Village", "Back to Cell");
                }
                if (parts[1] === "8" && currentPage > 1) {
                    session.locationPage = currentPage - 1;
                    return buildLocationMenu(villages, session.locationPage, "Select your Village", "Back to Cell");
                }
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < villages.length) {
                    session.selectedVillage = villages[selectedIndex];
                    session.locationStep = "completed";
                    return "CON Create a 4-digit PIN:";
                }
                return "CON Invalid selection. Please try again.";
            }
            // PIN creation and confirmation
            if (session.locationStep === "completed" && parts.length === 2) {
                const password = parts[1];
                if (!/^\d{4}$/.test(password)) {
                    delete ussdSessions[sessionId];
                    return "END Please enter a 4-digit numeric PIN only. Try again.";
                }
                session.password = password;
                return "CON Confirm your 4-digit PIN:";
            }
            if (session.locationStep === "completed" && parts.length === 3) {
                const confirmPassword = parts[2];
                if (!/^\d{4}$/.test(confirmPassword)) {
                    delete ussdSessions[sessionId];
                    return "END Please enter a 4-digit numeric PIN only. Try again.";
                }
                if (session.password !== confirmPassword) {
                    delete ussdSessions[sessionId];
                    return "END PINs do not match. Please try again.";
                }
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
                        return "END Location validation failed. Please try again.";
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
                        },
                    });
                    delete ussdSessions[sessionId];
                    return "END Registration successful. Thank you!";
                }
                catch (err) {
                    console.error("DB Error:", err);
                    delete ussdSessions[sessionId];
                    return "END Registration failed. Please try again later.";
                }
            }
            return "END Invalid input during registration.";
        }
        // 2. Submit Product
        case "2": {
            session.mode = "submit";
            const farmer = await prisma_1.default.farmer.findUnique({
                where: { phone: phoneNumber },
            });
            if (!farmer) {
                return "END Please register first before submitting a product.";
            }
            if (parts.length === 1) {
                session.productPage = 1;
                const products = await getProductsFromDatabase();
                if (products.length <= 8) {
                    // Show all products without pagination
                    let menu = "CON Select a product:\n";
                    products.forEach((product, index) => {
                        menu += `${index + 1}. ${product}\n`;
                    });
                    return menu;
                }
                else {
                    // Use pagination
                    return buildLocationMenu(products, 1, "Select a product");
                }
            }
            if (parts.length === 2) {
                const products = await getProductsFromDatabase();
                const currentPage = session.productPage || 1;
                // Handle pagination for products
                if (products.length > 8) {
                    if (parts[1] === "9" &&
                        currentPage < Math.ceil(products.length / 8)) {
                        session.productPage = currentPage + 1;
                        return buildLocationMenu(products, session.productPage, "Select a product");
                    }
                    if (parts[1] === "8" && currentPage > 1) {
                        session.productPage = currentPage - 1;
                        return buildLocationMenu(products, session.productPage, "Select a product");
                    }
                }
                // Product selection
                const selectedIndex = parseInt(parts[1]) - 1 + (currentPage - 1) * 8;
                if (selectedIndex >= 0 && selectedIndex < products.length) {
                    session.selectedProduct = products[selectedIndex];
                    return "CON Enter quantity in kg:";
                }
                return "END Invalid product selection. Please try again.";
            }
            if (parts.length === 3) {
                const quantity = parts[2];
                if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
                    delete ussdSessions[sessionId];
                    return "END Please enter a valid quantity. Try again.";
                }
                session.quantity = quantity;
                return "CON Enter your wished price per kg (RWF):";
            }
            if (parts.length === 4) {
                const wishedPrice = parts[3];
                if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
                    delete ussdSessions[sessionId];
                    return "END Please enter a valid wished price. Try again.";
                }
                session.wishedPrice = wishedPrice;
                return "CON Enter your PIN to confirm:";
            }
            if (parts.length === 5) {
                const enteredPassword = parts[4];
                if (!/^\d{4}$/.test(enteredPassword)) {
                    delete ussdSessions[sessionId];
                    return "END Please enter a 4-digit numeric PIN only. Try again.";
                }
                const isMatch = await (0, password_1.comparePassword)(enteredPassword, farmer.password ?? "");
                if (!isMatch) {
                    delete ussdSessions[sessionId];
                    return "END Incorrect PIN. Please try again.";
                }
                try {
                    await prisma_1.default.farmerSubmission.create({
                        data: {
                            farmerId: farmer.id,
                            productName: session.selectedProduct,
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
                    return "END Submission successful. Thank you!";
                }
                catch (err) {
                    console.error("DB Error:", err);
                    delete ussdSessions[sessionId];
                    return "END Submission failed. Try again.";
                }
            }
            return "END Invalid input during product submission.";
        }
        case "3":
            return "END Thank you for using SmartAgri!";
    }
    return "END Invalid input. Try again.";
}
async function submitProductService(submissionData) {
    // Get valid products from database
    const validProducts = await getProductsFromDatabase();
    // Validate product name
    if (!validProducts.includes(submissionData.productName)) {
        throw new Error(`Invalid product. Valid products are: ${validProducts.join(", ")}`);
    }
    // Validate quantity and price
    if (submissionData.submittedQty <= 0) {
        throw new Error("Quantity must be greater than 0");
    }
    if (submissionData.wishedPrice <= 0) {
        throw new Error("Price must be greater than 0");
    }
    // Check if farmer exists and get their location data
    const farmer = await prisma_1.default.farmer.findUnique({
        where: { id: submissionData.farmerId },
        select: {
            id: true,
            province: true,
            district: true,
            sector: true,
            cell: true,
            village: true,
        },
    });
    if (!farmer) {
        throw new Error("Farmer not found");
    }
    // Validate farmer's location data
    if (!submissionData.province ||
        !submissionData.district ||
        !submissionData.sector ||
        !submissionData.cell ||
        !submissionData.village) {
        throw new Error("submissionData location data is incomplete. Please update your profile.");
    }
    const locationValidation = location_service_1.LocationValidationService.validateLocationHierarchy({
        province: submissionData.province,
        district: submissionData.district,
        sector: submissionData.sector,
        cell: submissionData.cell,
        village: submissionData.village,
    });
    if (!locationValidation.isValid) {
        throw new Error(`Farmer location validation failed: ${locationValidation.errors.join(", ")}`);
    }
    // Create submission with farmer's location data
    const submission = await prisma_1.default.farmerSubmission.create({
        data: {
            farmerId: submissionData.farmerId,
            productName: submissionData.productName,
            category: submissionData.category,
            submittedQty: submissionData.submittedQty,
            wishedPrice: submissionData.wishedPrice,
            status: "PENDING",
            province: submissionData.province,
            district: submissionData.district,
            sector: submissionData.sector,
            cell: submissionData.cell,
            village: submissionData.village,
        },
        include: {
            farmer: {
                select: {
                    id: true,
                    phone: true,
                    province: true,
                    district: true,
                    sector: true,
                    cell: true,
                    village: true,
                },
            },
        },
    });
    return submission;
}
