import { ProductCategory } from "@prisma/client";

export interface ProductSubmissionInput {
  farmerId: string;
  productId: string;
  submittedQty: number;
  wishedPrice: number;
  province?: string;
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
}

// Enhanced session data for USSD
export interface ISessionData {
  mode?: "register" | "submit" | "account" | "help";
  language?: "KINY" | "ENG" | "FRE";
  languageSelected?: boolean;
  selectedNewLanguage?: "KINY" | "ENG" | "FRE";

  // Registration location flow
  locationStep?:
    | "province"
    | "district"
    | "sector"
    | "cell"
    | "village"
    | "completed"
    | "confirm_pin";
  locationPage?: number;
  selectedProvince?: string;
  selectedDistrict?: string;
  selectedSector?: string;
  selectedCell?: string;
  selectedVillage?: string;

  // Registration data
  password?: string;

  // Product submission flow
  productPage?: number;
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  categoryPage?: number;
  selectedProduct?: string;
  selectedProductUnit?: string;
  quantity?: string;
  wishedPrice?: string;

  // Navigation history for back functionality
  previousSteps?: Array<{
    step: string;
    data?: any;
  }>;
}

export interface IUssdRequest {
  sessionId: string;
  serviceCode?: string;
  phoneNumber: string;
  text: string;
}

// Location validation response
export interface LocationValidationResult {
  isValid: boolean;
  errors: string[];
}

// Paginated location response
export interface PaginatedLocationResponse {
  items: string[];
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Translation keys
export type TranslationKey =
  | "welcome"
  | "register"
  | "submitProduct"
  | "myAccount"
  | "help"
  | "exit"
  | "changeLanguage"
  | "enterLocation"
  | "createPin"
  | "confirmPin"
  | "pinMismatch"
  | "invalidPin"
  | "registrationSuccessful"
  | "registrationFailed"
  | "alreadyRegistered"
  | "pleaseRegister"
  | "selectCategory"
  | "selectProduct"
  | "enterQuantity"
  | "enterPrice"
  | "enterPinConfirm"
  | "invalidCategory"
  | "invalidProduct"
  | "invalidQuantity"
  | "invalidPrice"
  | "incorrectPin"
  | "submissionSuccessful"
  | "submissionFailed"
  | "checkSubmissions"
  | "lastThreeOrders"
  | "noOrders"
  | "enterPasswordForLanguage"
  | "enterPasswordForSubmissions"
  | "selectLanguage"
  | "languageChanged"
  | "incorrectPasswordLanguage"
  | "incorrectPasswordSubmissions"
  | "helpMenu"
  | "supportContact"
  | "callUs"
  | "whatsapp"
  | "email"
  | "productPrices"
  | "supportNumber"
  | "noPricesAvailable"
  | "currentPrices"
  | "animalProducts"
  | "vegetables"
  | "fruits"
  | "grains"
  | "tubers"
  | "legumes"
  | "herbsSpices"
  | "exitMessage"
  | "back"
  | "next"
  | "previous"
  | "selectProvince"
  | "selectDistrict"
  | "selectSector"
  | "selectCell"
  | "selectVillage"
  | "mainMenu"
  | "noCategoryProducts";

// Translation object with support for Kinyarwanda, English, and French

export const translations = {
  KINY: {
    welcome: "Murakaza neza kuri FoodBundles!",
    register: "Kwiyandikisha",
    submitProduct: "Ohereza umusaruro",
    myAccount: "Konti yanjye",
    help: "Ubufasha",
    exit: "Gusohoka",
    changeLanguage: "Guhindura ururimi",
    enterLocation: "Andika aho ubarizwa:",
    createPin: "Koresha PIN y'imibare 4:",
    confirmPin: "Emeza PIN yawe y'imibare 4:",
    pinMismatch: "PIN ntizifite. Ongera ugerageze.",
    invalidPin: "Andika PIN y'imibare 4 gusa. Ongera ugerageze.",
    registrationSuccessful: "Kwiyandikisha byagenze neza. Urakoze!",
    registrationFailed: "Kwiyandikisha byanze. Ongera ugerageze nyuma.",
    alreadyRegistered: "Usanzwe wanditswe.",
    pleaseRegister: "Banza wiyandikishe mbere yo kwoherereza umusaruro.",
    selectCategory: "Hitamo icyiciro cy'umusaruro:",
    selectProduct: "Hitamo umusaruro:",
    enterQuantity: "Andika ingano y'umusaruro mu:",
    enterPrice: "Andika igiciro ukeneye (RWF):",
    enterPinConfirm: "Andika PIN yawe kugirango wemeze:",
    invalidCategory: "Icyiciro wahisemo ntaricyo. Ongera ugerageze.",
    invalidProduct: "Umusaruro wahisemo ntawo ari. Ongera ugerageze.",
    invalidQuantity: "Andika ingano y'umusaruro yemewe. Ongera ugerageze.",
    invalidPrice: "Andika igiciro cyemewe. Ongera ugerageze.",
    incorrectPin: "PIN y'imibare itari yo. Ongera ugerageze.",
    submissionSuccessful: "Kwohererza byagenze neza. Urakoze!",
    submissionFailed: "Kwohererza byanze. Ongera ugerageze.",
    checkSubmissions: "Reba ibyohererejwe",
    lastThreeOrders: "Imisaruro 3 y'ubucuruzi iheruka:",
    noOrders: "Nta makuru y'ubucuruzi ufite.",
    enterPasswordForLanguage: "Andika PIN kugirango uhindure ururimi:",
    enterPasswordForSubmissions:
      "Andika PIN yawe kugirango urebe ibyohererejwe:",
    selectLanguage: "Hitamo ururimi:",
    languageChanged: "Ururimi rwahindutse neza!",
    incorrectPasswordLanguage:
      "PIN y'imibare itari yo. Ururimi ntiruhagarikwa.",
    incorrectPasswordSubmissions:
      "PIN y'imibare itari yo. Ntushobora kureba ibyohererejwe.",
    helpMenu: "Ubufasha:",
    supportContact: "Telefoni y'ubufasha",
    callUs: "Duhamagare",
    whatsapp: "WhatsApp",
    email: "Email",
    productPrices: "Ibiciro by'ibicuruzwa",
    supportNumber: "Kugirango ubone ubufasha, hamagara: 911",
    noPricesAvailable: "Nta biciro bihari kuri ubu.",
    currentPrices: "Ibiciro bikurikizwa:",
    animalProducts: "Ibikomoka ku matungo",
    vegetables: "Imboga",
    fruits: "Imbuto",
    grains: "Ibinyampeke",
    tubers: "Ibiribwa by'imizi",
    legumes: "Ibinyamisogwe",
    herbsSpices: "Ibiyunguranoma",
    exitMessage: "Murakoze gukoresha FoodBundles!",
    back: "Subira inyuma",
    next: "Ibikurikira",
    previous: "Ibyahise",
    selectProvince: "Hitamo intara:",
    selectDistrict: "Hitamo akarere:",
    selectSector: "Hitamo umurenge:",
    selectCell: "Hitamo akagari:",
    selectVillage: "Hitamo umudugudu:",
    mainMenu: "Ahabanza",
    noCategoryProducts: "Nta musaruro uri muri iki cyiciro.",
  },
  ENG: {
    welcome: "Welcome to FoodBundles!",
    register: "Register",
    submitProduct: "Submit Product",
    myAccount: "My Account",
    help: "Help",
    exit: "Exit",
    changeLanguage: "Change Language",
    enterLocation: "Enter your location:",
    createPin: "Create a 4-digit PIN:",
    confirmPin: "Confirm your 4-digit PIN:",
    pinMismatch: "PINs do not match. Please try again.",
    invalidPin: "Please enter a 4-digit numeric PIN only. Try again.",
    registrationSuccessful: "Registration successful. Thank you!",
    registrationFailed: "Registration failed. Please try again later.",
    alreadyRegistered: "You are already registered.",
    pleaseRegister: "Please register first before submitting a product.",
    selectCategory: "Select product category:",
    selectProduct: "Select product:",
    enterQuantity: "Enter quantity in:",
    enterPrice: "Enter your wished price (RWF):",
    enterPinConfirm: "Enter your PIN to confirm:",
    invalidCategory: "Invalid category selection. Please try again.",
    invalidProduct: "Invalid product selection. Please try again.",
    invalidQuantity: "Please enter a valid quantity. Try again.",
    invalidPrice: "Please enter a valid wished price. Try again.",
    incorrectPin: "Incorrect PIN. Please try again.",
    submissionSuccessful: "Submission successful. Thank you!",
    submissionFailed: "Submission failed. Try again.",
    checkSubmissions: "Check Submissions",
    lastThreeOrders: "Last 3 orders:",
    noOrders: "You have no order history.",
    enterPasswordForLanguage: "Enter PIN to change language:",
    enterPasswordForSubmissions: "Enter your PIN to view submissions:",
    selectLanguage: "Select Language:",
    languageChanged: "Language changed successfully!",
    incorrectPasswordLanguage: "Incorrect PIN. Language not changed.",
    incorrectPasswordSubmissions: "Incorrect PIN. Cannot view submissions.",
    helpMenu: "Help:",
    supportContact: "Support Contact",
    callUs: "Call Us",
    whatsapp: "WhatsApp",
    email: "Email",
    productPrices: "Product Prices",
    supportNumber: "For support, call: 911",
    noPricesAvailable: "No prices available at the moment.",
    currentPrices: "Current purchase prices:",
    animalProducts: "Animal Products",
    vegetables: "Vegetables",
    fruits: "Fruits",
    grains: "Grains",
    tubers: "Tubers",
    legumes: "Legumes",
    herbsSpices: "Herbs & Spices",
    exitMessage: "Thank you for using FoodBundles!",
    back: "Back",
    next: "Next",
    previous: "Previous",
    selectProvince: "Select your Province:",
    selectDistrict: "Select your District:",
    selectSector: "Select your Sector:",
    selectCell: "Select your Cell:",
    selectVillage: "Select your Village:",
    mainMenu: "Main Menu",
    noCategoryProducts: "No products in this category.",
  },
  FRE: {
    welcome: "Bienvenue à FoodBundles!",
    register: "S'inscrire",
    submitProduct: "Soumettre un produit",
    myAccount: "Mon compte",
    help: "Aide",
    exit: "Sortir",
    changeLanguage: "Changer de langue",
    enterLocation: "Entrez votre emplacement:",
    createPin: "Créez un PIN à 4 chiffres:",
    confirmPin: "Confirmez votre PIN à 4 chiffres:",
    pinMismatch: "Les PIN ne correspondent pas. Veuillez réessayer.",
    invalidPin:
      "Veuillez entrer uniquement un PIN numérique à 4 chiffres. Réessayer.",
    registrationSuccessful: "Inscription réussie. Merci!",
    registrationFailed: "Échec de l'inscription. Veuillez réessayer plus tard.",
    alreadyRegistered: "Vous êtes déjà inscrit.",
    pleaseRegister:
      "Veuillez d'abord vous inscrire avant de soumettre un produit.",
    selectCategory: "Sélectionnez la catégorie de produit:",
    selectProduct: "Sélectionnez le produit:",
    enterQuantity: "Entrez la quantité en:",
    enterPrice: "Entrez votre prix souhaité (RWF):",
    enterPinConfirm: "Entrez votre PIN pour confirmer:",
    invalidCategory: "Sélection de catégorie invalide. Veuillez réessayer.",
    invalidProduct: "Sélection de produit invalide. Veuillez réessayer.",
    invalidQuantity: "Veuillez entrer une quantité valide. Réessayer.",
    invalidPrice: "Veuillez entrer un prix souhaité valide. Réessayer.",
    incorrectPin: "PIN incorrect. Veuillez réessayer.",
    submissionSuccessful: "Soumission réussie. Merci!",
    submissionFailed: "Échec de la soumission. Réessayer.",
    checkSubmissions: "Vérifier les soumissions",
    lastThreeOrders: "Les 3 dernières commandes:",
    noOrders: "Vous n'avez aucun historique de commande.",
    enterPasswordForLanguage: "Entrez le PIN pour changer la langue:",
    enterPasswordForSubmissions: "Entrez votre PIN pour voir les soumissions:",
    selectLanguage: "Sélectionnez la langue:",
    languageChanged: "Langue changée avec succès!",
    incorrectPasswordLanguage: "PIN incorrect. Langue non changée.",
    incorrectPasswordSubmissions:
      "PIN incorrect. Impossible de voir les soumissions.",
    helpMenu: "Aide:",
    supportContact: "Contact de support",
    callUs: "Appelez-nous",
    whatsapp: "WhatsApp",
    email: "Email",
    productPrices: "Prix des produits",
    supportNumber: "Pour le support, appelez: 911",
    noPricesAvailable: "Aucun prix disponible pour le moment.",
    currentPrices: "Prix d'achat actuels:",
    animalProducts: "Produits animaux",
    vegetables: "Légumes",
    fruits: "Fruits",
    grains: "Céréales",
    tubers: "Tubercules",
    legumes: "Légumineuses",
    herbsSpices: "Herbes et épices",
    exitMessage: "Merci d'utiliser FoodBundles!",
    back: "Retour",
    next: "Suivant",
    previous: "Précédent",
    selectProvince: "Sélectionnez votre Province:",
    selectDistrict: "Sélectionnez votre District:",
    selectSector: "Sélectionnez votre Secteur:",
    selectCell: "Sélectionnez votre Cellule:",
    selectVillage: "Sélectionnez votre Village:",
    mainMenu: "Menu Principal",
    noCategoryProducts: "Aucun produit dans cette catégorie.",
  },
};

export const productsByCategory = {
  ANIMAL_PRODUCTS: [
    "Inyama (Meat)",
    "Amata (Milk)",
    "Amagi (Eggs)",
    "Cheese",
    "Yogurt",
    "Butter",
    "Fish",
    "Chicken",
    "Beef",
    "Pork",
    "Goat Meat",
    "Mutton",
  ],
  VEGETABLES: [
    "Tomatoes",
    "Onions",
    "Cabbage",
    "Carrots",
    "Spinach",
    "Lettuce",
    "Bell Peppers",
    "Broccoli",
    "Cauliflower",
  ],
  FRUITS: [
    "Banana",
    "Avocado",
    "Mango",
    "Pineapple",
    "Orange",
    "Apple",
    "Passion Fruit",
    "Papaya",
  ],
  GRAINS: ["Maize", "Rice", "Wheat", "Sorghum", "Barley", "Millet"],
  TUBERS: ["Potatoes", "Irish Potatoes", "Cassava", "Sweet Potatoes", "Yam"],
  LEGUMES: ["Beans", "Groundnuts", "Soybeans", "Peas", "Lentils", "Cowpeas"],
  HERBS_SPICES: [
    "Ginger",
    "Garlic",
    "Coriander",
    "Parsley",
    "Mint",
    "Basil",
    "Thyme",
  ],
};
