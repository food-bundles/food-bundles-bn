export interface ProductSubmissionInput {
  farmerId: string;
  productId: string;
  submittedQty: number;
  wishedPrice: number;
  location?: string;
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
    | "confirm_pin"
    | "confirm_location";
  locationPage?: number;
  selectedProvince?: string;
  selectedDistrict?: string;
  selectedSector?: string;
  selectedCell?: string;
  selectedVillage?: string;

  // Registration data
  password?: string;
  currentPinVerified?: boolean;
  newPhoneNumber?: string;
  newPin?: string;
  pinChangeStep?: string;
  profileUpdateStep?: string;
  profileUpdateType?: string;

  // Product submission flow
  productPage?: number;
  selectedCategoryId?: string;
  selectedCategoryName?: string;
  categoryPage?: number;
  selectedProduct?: string;
  selectedProductUnit?: string;
  quantity?: string;
  wishedPrice?: string;

  // Support service data
  supportTicket?: {
    category?: string;
    description?: string;
    priority?: string;
  };

  currentStep?: string;
  stepData?: any;
  farmingProfileStep?: string;
  farmSize?: number;
  paymentMethod?: "MOBILE_MONEY" | "BANK_TRANSFER" | "CASH";
  selectedCategory?: string;

  // For price comparison feature
  priceComparisonStep?: string;
  purchasePrice?: string;

  // For farming profile updates
  farmingUpdateType?: "crops" | "farm_info" | "business_prefs";

  // For navigation
  previousMenu?: string;

  // Navigation history for back functionality
  previousSteps?: Array<{
    step: string;
    data?: any;
  }>;

  // Timestamp for session expiration
  lastActivity?: Date;
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
  | "submitProductsFirst"
  | "submissionFetchFailed"
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
  | "noCategoryProducts"
  | "securitySettings"
  | "changePIN"
  | "accountActivity"
  | "privacySettings"
  | "accountRecovery"
  | "enterCurrentPIN"
  | "incorrectCurrentPIN"
  | "enterNewPIN"
  | "confirmNewPIN"
  | "invalidPinFormat"
  | "pinChangedSuccessfully"
  | "pinChangeFailedTryAgain"
  | "enterPINForActivity"
  | "incorrectPinActivity"
  | "recentActivity"
  | "pinChangeHistory"
  | "securityQuestions"
  | "emergencyContact"
  | "updateProfile"
  | "pleaseUpdateProfile"
  | "changePhoneNumber"
  | "updateLocation"
  | "communicationPrefs"
  | "enterNewPhoneNumber"
  | "invalidPhoneFormat"
  | "verificationCodeSent"
  | "enterVerificationCode"
  | "phoneNumberUpdated"
  | "phoneUpdateFailed"
  | "communicationUpdateSuccess"
  | "smsNotifications"
  | "notificationFrequency"
  | "selectNotificationFreq"
  | "IMMEDIATE"
  | "DAILY"
  | "WEEKLY"
  | "locationUpdatedSuccessfully"
  | "locationUpdateFailed"
  | "invalidInput"
  | "techSupportDesc"
  | "reportIssue"
  | "checkStatus"
  | "describeIssue"
  | "issueReportedSuccess"
  | "issueReportFailed"
  | "statusCheckFailed"
  | "faqFetchFailed"
  | "recentSubmissions"
  | "status"
  | "hectares"
  | "years"
  | "cooperativeName"
  | "cooperativeMember"
  | "yes"
  | "no"
  | "profileFetchFailed"
  | "totalEarnings"
  | "monthlyAverage"
  | "regionalAverage"
  | "transactions"
  | "incomeFetchFailed"
  | "noIncomeData"
  | "activityFetchFailed"
  | "languageChangeFailed"
  | "pinsDoNotMatch"
  | "pinChangedSuccess"
  | "farmingProfile"
  | "primaryCrops"
  | "farmInformation"
  | "businessPreferences"
  | "viewProfile"
  | "enterPINForProfile"
  | "incorrectPinProfile"
  | "profileNotFound"
  | "farmingProfileDetails"
  | "farmSize"
  | "experience"
  | "cooperative"
  | "primaryCropsCount"
  | "updateCrops"
  | "selectCrops"
  | "cropSeasonality"
  | "defaultQuantities"
  | "farmSizeInHectares"
  | "yearsOfExperience"
  | "cooperativeMembership"
  | "organicCertification"
  | "preferredPaymentMethod"
  | "minimumOrderQty"
  | "deliveryPreferences"
  | "earningsDashboard"
  | "incomeSummary"
  | "performanceMetrics"
  | "comparisonAnalytics"
  | "paymentHistory"
  | "enterPINForEarnings"
  | "incorrectPinEarnings"
  | "earningsDataNotAvailable"
  | "incomeSummaryDetails"
  | "thisMonth"
  | "lastMonth"
  | "yearToDate"
  | "avgPerSubmission"
  | "enterPINForMetrics"
  | "incorrectPinMetrics"
  | "metricsDataNotAvailable"
  | "performanceMetricsDetails"
  | "acceptanceRate"
  | "avgPricePerKg"
  | "topProduct"
  | "pendingPayments"
  | "completedPayments"
  | "paymentSchedule"
  | "regionalComparison"
  | "yearlyGrowth"
  | "marketPosition"
  | "technicalSupport"
  | "submitTicket"
  | "ticketNumber"
  | "issueCategory"
  | "issueDescription"
  | "requestCallback"
  | "systemStatus"
  | "faqSection"
  | "contactSupport"
  | "emergencySupport"
  | "ticketSubmitted"
  | "callbackRequested"
  | "supportHours"
  | "knownIssues"
  | "troubleshooting"
  | "videoTutorials"
  | "userGuide"
  | "invalidSelection"
  | "sessionExpired"
  | "serviceUnavailable"
  | "tryAgainLater"
  | "confirmAction"
  | "actionCancelled"
  | "dataUpdated"
  | "operationFailed"
  | "accessDenied"
  | "accountLocked"
  | "suspiciousActivity"
  | "securityAlert"
  | "currentPhone"
  | "noDataAvailable"
  | "userNotFound"
  | "pinVerificationFailed"
  | "sessionExpiredPleaseRestart"
  | "contactSupportForAssistance"
  | "overall"
  | "database"
  | "sms"
  | "payments"
  | "systemError"
  | "pleaseRetry"
  | "priceHigherThanMarket"
  | "marketPrice"
  | "yourPrice"
  | "acceptAndContinue"
  | "changePrice"
  | "confirmLocationUpdate"
  | "province"
  | "district"
  | "sector"
  | "cell"
  | "village"
  | "confirm"
  | "cancel"
  | "none"
  | "cropsUpdated"
  | "enterFarmSize"
  | "invalidNumber"
  | "enterExperience"
  | "farmInfoUpdated"
  | "selectPaymentMethod"
  | "MOBILE_MONEY"
  | "BANK_TRANSFER"
  | "CASH"
  | "enterMinOrderQty"
  | "businessPrefsUpdated"
  | "farmingMethod"
  | "showMainMenu"
  | "showAccountMenu"
  | "currentStep"
  | "stepData";

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
    submissionFailed: "Kwoherereza byanze. Ongera ugerageze.",
    submitProductsFirst: "Banza wohereze umusaruro.",
    submissionFetchFailed: "Kureba umusaruro byanze. Ongera ugerageze.",
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
    securitySettings: "Amategeko y'umutekano",
    changePIN: "Guhindura PIN",
    accountActivity: "Ibikorwa byo kuri konti",
    privacySettings: "Amategeko y'ubwigenge",
    accountRecovery: "Kugarura konti",
    enterCurrentPIN: "Andika PIN yawe y'ubu:",
    incorrectCurrentPIN: "PIN y'ubu itari yo. Ongera ugerageze.",
    enterNewPIN: "Andika PIN nshya y'imibare 4:",
    confirmNewPIN: "Emeza PIN nshya:",
    invalidPinFormat: "Andika PIN y'imibare 4 gusa.",
    pinChangedSuccessfully: "PIN yawe yahinduwe neza!",
    pinChangeFailedTryAgain: "Guhindura PIN byanze. Ongera ugerageze.",
    enterPINForActivity: "Andika PIN yawe kureba ibikorwa:",
    incorrectPinActivity: "PIN itari yo. Ntushobora kureba ibikorwa.",
    recentActivity: "Ibikorwa by'ubu:",
    pinChangeHistory: "Amateka yo guhindura PIN",
    securityQuestions: "Ibibazo by'umutekano",
    emergencyContact: "Telefoni y'ubutabazi",
    updateProfile: "Guhindura umwirondoro",
    pleaseUpdateProfile: "Nyamuneka vugurura Umwirondoro",
    changePhoneNumber: "Guhindura nimero ya terefone",
    updateLocation: "Guhindura aho ubarizwa",
    communicationPrefs: "Uburyo bw'itumanaho",
    enterNewPhoneNumber: "Andika nimero nshya ya terefone:",
    invalidPhoneFormat: "Nimero ya terefone ntabwo ari nziza.",
    verificationCodeSent: "Kode y'ikemeza yoherejwe.",
    enterVerificationCode: "Andika kode y'ikemeza:",
    phoneNumberUpdated: "Nimero ya terefone yahinduwe neza!",
    phoneUpdateFailed: "Guhindura nimero byanze.",
    communicationUpdateSuccess: "Uburyo bw'itumanaho bwahinduwe neza!",
    smsNotifications: "Ubutumwa bugufi",
    notificationFrequency: "Uko ubona ubutumwa",
    selectNotificationFreq: "Hitamo inshuro wajya ubona ubutumwa",
    IMMEDIATE: "Ako kanya",
    DAILY: "Buri munsi",
    WEEKLY: "Buri cyumweru",
    locationUpdatedSuccessfully: "Aho ubarizwa byahinduwe neza!",
    locationUpdateFailed: "GuhismsNndura aho ubarizwa byanze.",
    invalidInput: "Andika ibisobanuro byemewe.",
    techSupportDesc: "Mutubwire ubufasha bwa tekinike mukeneye.",
    reportIssue: "Tangaza ikibazo",
    checkStatus: "Reba uko sisitemu imeze",
    describeIssue: "Sobanura ikibazo cyawe:",
    issueReportedSuccess: "Ikibazo cyawe cyoherejwe neza!",
    issueReportFailed: "Kwohereza ikibazo byanze. Ongera ugerageze.",
    statusCheckFailed: "Kureba uko sisitemu imeze byanze.",
    faqFetchFailed: "Kubaza ibibazo byanze.",
    recentSubmissions: "Ibicuruzwa byohererejwe vuba aha:",
    status: "Imimerere",
    hectares: "hekari",
    years: "imyaka",
    cooperativeName: "Izina rya Koperative",
    cooperativeMember: "Umunyamuryango wa koperative",
    yes: "Yego",
    no: "Oya",
    profileFetchFailed: "Kureba umwirondoro byanze.",
    totalEarnings: "Amafaranga yose yakiriwe",
    monthlyAverage: "Ikigereranyo cy'amezi",
    regionalAverage: "Ikigereranyo mu karere",
    transactions: "Imicungiranyo",
    incomeFetchFailed: "Kureba amafaranga yakiriwe byanze.",
    noIncomeData: "Nta amafaranga yose yakiriwe kuri ibicuruzwa.",
    activityFetchFailed: "Kureba ibikorwa byanze.",
    languageChangeFailed: "Guhindura ururimi byanze.",
    pinsDoNotMatch: "PIN ntabwo zihuye. Ongera ugerageze.",
    pinChangedSuccess: "PIN yawe yahinduwe neza!",
    farmingProfile: "Umwirondoro w'ubuhinzi",
    primaryCrops: "Ibihingwa by'ibanze",
    farmInformation: "Amakuru y'umurima",
    businessPreferences: "Uburyo bw'ubucuruzi",
    viewProfile: "Kureba umwirondoro",
    enterPINForProfile: "Andika PIN kureba umwirondoro:",
    incorrectPinProfile: "PIN itari yo.",
    profileNotFound: "Umwirondoro ntiwabonetse.",
    farmingProfileDetails: "Amakuru y'umwirondoro w'ubuhinzi:",
    farmSize: "Ubunini bw'umurima",
    experience: "Uburambe",
    cooperative: "Koperative",
    primaryCropsCount: "Ibihingwa by'ibanze",
    updateCrops: "Guhindura ibihingwa",
    selectCrops: "Hitamo ibihingwa",
    cropSeasonality: "Uko ubona ubuhingwa",
    defaultQuantities: "Uko ubona ubunini",
    farmSizeInHectares: "Ubunini bw'umurima",
    yearsOfExperience: "Uko ubona uburambe",
    cooperativeMembership: "Uko ubona koperative",
    organicCertification: "Uko ubona ubugufi",
    preferredPaymentMethod: "Uko ubona ubugufi",
    minimumOrderQty: "Ingano ntoya y'ibyo ucuruza",
    deliveryPreferences: "Uko ubona ubugufi",
    earningsDashboard: "Imbonerahamwe y'inyungu",
    incomeSummary: "Inyungu zakorewe",
    performanceMetrics: "Ibipimo by'imikorere",
    comparisonAnalytics: "Kugereranya",
    paymentHistory: "Amateka y'ubwishyu",
    enterPINForEarnings: "Andika PIN kureba inyungu:",
    incorrectPinEarnings: "PIN itari yo.",
    earningsDataNotAvailable: "Amakuru y'inyungu ntahari.",
    incomeSummaryDetails: "Inyungu zakorewe:",
    thisMonth: "Uku kwezi",
    lastMonth: "Ukwezi gushize",
    yearToDate: "Kuva mu mwaka",
    avgPerSubmission: "Ikigereranyo kuri buri cohereza",
    enterPINForMetrics: "Andika PIN kureba ibipimo:",
    incorrectPinMetrics: "PIN itari yo.",
    metricsDataNotAvailable: "Amakuru y'ibipimo ntahari.",
    performanceMetricsDetails: "Ibipimo by'imikorere:",
    acceptanceRate: "Igipimo cy'kwemererwa",
    avgPricePerKg: "Igiciro rusange kuri kg",
    topProduct: "Igicuruzwa gikomeye",
    pendingPayments: "Ubwishyu butegere`",
    completedPayments: "Ubwishyu bwakozwe",
    paymentSchedule: "Igenamigambi ry'ubwishyu",
    regionalComparison: "Kugereranya mu karere",
    yearlyGrowth: "Iterambere ry'umwaka",
    marketPosition: "Umwanya ku isoko",
    technicalSupport: "Ubufasha bwa tekinike",
    submitTicket: "Kohereza ikibazo",
    ticketNumber: "Nomero y'ikibazo",
    issueCategory: "Icyiciro cy'ikibazo",
    issueDescription: "Ibisobanuro by'ikibazo",
    requestCallback: "Gusaba guhamagariwa",
    systemStatus: "Uko sisitemu imeze",
    faqSection: "Ibibazo bikunze kubazwa",
    contactSupport: "Kuvugana n'ubufasha",
    emergencySupport: "Ubufasha bw'ibanze",
    ticketSubmitted: "Ikibazo cyoherejwe",
    callbackRequested: "Gusaba guhamagarirwa",
    supportHours: "Igihe ubufasha buboneka",
    knownIssues: "Ibibazo bizwi",
    troubleshooting: "Igikorwa cy'ikibazo",
    videoTutorials: "Amasomo ya videwo",
    userGuide: "Inyandiko y'umukoresha",
    invalidSelection: "Ihitamo ritari ryo. Ongera ugerageze.",
    sessionExpired: "Icyiciro cyarangije igihe.",
    serviceUnavailable: "Serivisi ntiboneka.",
    tryAgainLater: "Ongera ugerageze nyuma.",
    actionCancelled: "Igikorwa cyahagaritswe.",
    confirmAction: "Emeza icyo ukora",
    dataUpdated: "Amakuru yahinduwe neza",
    operationFailed: "Igikorwa cyanze",
    accessDenied: "Uburenganzira bwanze",
    accountLocked: "Konti yafunzwe",
    suspiciousActivity: "Ibikorwa bya giteye amakenga",
    securityAlert: "Itangazo ry'umutekano",
    currentPhone: "Telefoni y'ubu",
    noDataAvailable: "Nta makuru ahari",
    userNotFound: "Nta konti yashonje",
    pinVerificationFailed: "Kugenzura PIN byanze",
    sessionExpiredPleaseRestart: "Icyiciro cyarangije. Ongera utangire",
    contactSupportForAssistance: "Hamagara ubufasha kuri +250796897823",
    overall: "Ubusanzwe",
    database: "Ububiko",
    sms: "Ubutumwa",
    payments: "Ubwishyu",
    systemError: "Habaye ikibazo muri sisitemu",
    pleaseRetry: "Ongera ugerageze mukanya.",
    priceHigherThanMarket: "Igiciro mwatanze kiri hejuru yicyemewe",
    marketPrice: "Igiciro kw' isoko",
    yourPrice: "Igiciro watanze",
    acceptAndContinue: "Emeza maze ukomeze",
    changePrice: "Hindura Igiciro",
    confirmLocationUpdate: "Emeza impinduka zaho ubarizwa",
    province: "Intara",
    district: "Akrere",
    sector: "Umurenge",
    cell: "Akagari",
    village: "Umudugudu",
    confirm: "Emeza",
    cancel: "Hagarika",
    none: "Nta na kimwe",
    cropsUpdated: "Ibihingwa byahinduwe neza!",
    enterFarmSize: "Andika ubunini bw'umurima (hekari):",
    invalidNumber: "Andika umubare wemewe.",
    enterExperience: "Andika uburambe (imyaka):",
    farmInfoUpdated: "Amakuru y'umurima yahinduwe neza!",
    selectPaymentMethod: "Hitamo uburyo bwo kwishyura:",
    MOBILE_MONEY: "Mobile Money",
    BANK_TRANSFER: "Kohereza muri banki",
    CASH: "Amafaranga yinkwi",
    enterMinOrderQty: "Andika ingano ntoya y'ibicuruzwa:",
    businessPrefsUpdated: "Uburyo bw'ubucuruzi bwahinduwe neza!",
    farmingMethod: "Uburyo bwo guhinga",
    showMainMenu: "Erekana menu nyamukuru",
    showAccountMenu: "Erekana menu ya konti",
    currentStep: "icyo ukora",
    stepData: "amakuru y'icyo ukora",
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
    submitProductsFirst: "Please submit your products first.",
    submissionFetchFailed:
      "Failed to fetch submissions. Please try again later.",
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
    securitySettings: "Security Settings",
    changePIN: "Change PIN",
    accountActivity: "Account Activity",
    privacySettings: "Privacy Settings",
    accountRecovery: "Account Recovery",
    enterCurrentPIN: "Enter your current PIN:",
    incorrectCurrentPIN: "Current PIN is incorrect. Try again.",
    enterNewPIN: "Enter new 4-digit PIN:",
    confirmNewPIN: "Confirm new PIN:",
    invalidPinFormat: "Please enter 4 digits only.",
    pinChangedSuccessfully: "PIN changed successfully!",
    pinChangeFailedTryAgain: "PIN change failed. Try again.",
    enterPINForActivity: "Enter PIN to view activity:",
    incorrectPinActivity: "Incorrect PIN. Cannot view activity.",
    recentActivity: "Recent Activity:",
    pinChangeHistory: "PIN Change History",
    securityQuestions: "Security Questions",
    emergencyContact: "Emergency Contact",
    updateProfile: "Update Profile",
    pleaseUpdateProfile: "Please update your profile.",
    changePhoneNumber: "Change Phone Number",
    updateLocation: "Update Location",
    communicationPrefs: "Communication Preferences",
    enterNewPhoneNumber: "Enter new phone number:",
    invalidPhoneFormat: "Invalid phone number format.",
    verificationCodeSent: "Verification code sent.",
    enterVerificationCode: "Enter verification code:",
    phoneNumberUpdated: "Phone number updated successfully!",
    phoneUpdateFailed: "Phone number update failed.",
    communicationUpdateSuccess:
      "Communication preferences updated successfully!",
    locationUpdatedSuccessfully: "Location updated successfully!",
    smsNotifications: "SMS Notifications",
    notificationFrequency: "Notification Frequency",
    selectNotificationFreq: "Select notification frequency:",
    IMMEDIATE: "IMMEDIATE",
    DAILY: "DAILY",
    WEEKLY: "WEEKLY",
    locationUpdateFailed: "Location update failed.",
    invalidInput: "Please enter valid input.",
    techSupportDesc: "Please let us know type of support you need.",
    reportIssue: "Report issue",
    checkStatus: "Check system status",
    describeIssue: "Describe your issue:",
    issueReportedSuccess: "Your issue has been reported successfully!",
    issueReportFailed: "Failed to report issue. Please try again.",
    statusCheckFailed: "Failed to check system status.",
    faqFetchFailed: "Failed to fetch FAQs.",
    recentSubmissions: "Recent submissions:",
    status: "Status",
    hectares: "hectares",
    years: "years",
    cooperativeName: "Cooperative Name",
    cooperativeMember: "Cooperative Member",
    yes: "Yes",
    no: "No",
    profileFetchFailed: "Failed to fetch profile.",
    totalEarnings: "Total earnings",
    monthlyAverage: "Monthly average",
    regionalAverage: "Regional average",
    transactions: "Transactions",
    incomeFetchFailed: "Failed to fetch income data.",
    noIncomeData: "No income data available at the moment.",
    activityFetchFailed: "Failed to fetch activities.",
    languageChangeFailed: "Failed to change language.",
    pinsDoNotMatch: "PINs do not match. Please try again.",
    pinChangedSuccess: "PIN changed successfully!",
    farmingProfile: "Farming Profile",
    primaryCrops: "Primary Crops",
    farmInformation: "Farm Information",
    businessPreferences: "Business Preferences",
    viewProfile: "View Profile",
    enterPINForProfile: "Enter PIN to view profile:",
    incorrectPinProfile: "Incorrect PIN.",
    profileNotFound: "Profile not found.",
    farmingProfileDetails: "Farming Profile Details:",
    farmSize: "Farm Size",
    experience: "Experience",
    cooperative: "Cooperative",
    primaryCropsCount: "Primary Crops Count",
    updateCrops: "Update Crops",
    selectCrops: "Select Crops",
    cropSeasonality: "Crop Seasonality",
    defaultQuantities: "Default Quantities",
    farmSizeInHectares: "Farm Size (in hectares)",
    yearsOfExperience: "Years of Experience",
    cooperativeMembership: "Cooperative Membership",
    organicCertification: "Organic Certification",
    preferredPaymentMethod: "Preferred Payment Method",
    minimumOrderQty: "Minimum Order Quantity",
    deliveryPreferences: "Delivery Preferences",
    earningsDashboard: "Earnings Dashboard",
    incomeSummary: "Income Summary",
    performanceMetrics: "Performance Metrics",
    comparisonAnalytics: "Comparison Analytics",
    paymentHistory: "Payment History",
    enterPINForEarnings: "Enter PIN to view earnings:",
    incorrectPinEarnings: "Incorrect PIN.",
    earningsDataNotAvailable: "Earnings data not available.",
    incomeSummaryDetails: "Income Summary Details:",
    thisMonth: "This Month",
    lastMonth: "Last Month",
    yearToDate: "Year to Date",
    avgPerSubmission: "Average per Submission",
    enterPINForMetrics: "Enter PIN to view metrics:",
    incorrectPinMetrics: "Incorrect PIN.",
    metricsDataNotAvailable: "Metrics data not available.",
    performanceMetricsDetails: "Performance Metrics Details:",
    acceptanceRate: "Acceptance Rate",
    avgPricePerKg: "Average Price per Kg",
    topProduct: "Top Product",
    pendingPayments: "Pending Payments",
    completedPayments: "Completed Payments",
    paymentSchedule: "Payment Schedule",
    regionalComparison: "Regional Comparison",
    yearlyGrowth: "Yearly Growth",
    marketPosition: "Market Position",
    technicalSupport: "Technical Support",
    submitTicket: "Submit Ticket",
    ticketNumber: "Ticket Number",
    issueCategory: "Issue Category",
    issueDescription: "Issue Description",
    requestCallback: "Request Callback",
    systemStatus: "System Status",
    faqSection: "FAQ Section",
    contactSupport: "Contact Support",
    emergencySupport: "Emergency Support",
    ticketSubmitted: "Ticket Submitted",
    callbackRequested: "Callback Requested",
    supportHours: "Support Hours",
    knownIssues: "Known Issues",
    troubleshooting: "Troubleshooting",
    videoTutorials: "Video Tutorials",
    userGuide: "User Guide",
    invalidSelection: "Invalid selection. Try again.",
    sessionExpired: "Session has expired.",
    serviceUnavailable: "Service is unavailable.",
    tryAgainLater: "Please try again later.",
    actionCancelled: "Action has been cancelled.",
    confirmAction: "Confirm Action",
    dataUpdated: "Data updated successfully",
    securityAlert: "Security alert",
    operationFailed: "Operation failed",
    accessDenied: "Access denied",
    accountLocked: "Account locked",
    suspiciousActivity: "Suspicious activity",
    currentPhone: "Current phone",
    noDataAvailable: "No data available",
    userNotFound: "Account not found",
    pinVerificationFailed: "PIN verification failed",
    sessionExpiredPleaseRestart: "Session expired. Please start again",
    contactSupportForAssistance: "Contact support at +250796897823",
    overall: "Overall",
    database: "Database",
    sms: "SMS",
    payments: "Payments",
    systemError: "System error",
    pleaseRetry: "Please try again later.",
    priceHigherThanMarket: "Your price is higher than the market price",
    marketPrice: "Market Price",
    yourPrice: "Your Price",
    acceptAndContinue: "Accept and Continue",
    changePrice: "Change Price",
    confirmLocationUpdate: "Confirm Location Update",
    province: "Province",
    district: "District",
    sector: "Sector",
    cell: "Cell",
    village: "Village",
    confirm: "Confirm",
    cancel: "Cancel",
    none: "None",
    cropsUpdated: "Crops updated successfully!",
    enterFarmSize: "Enter farm size (hectares):",
    invalidNumber: "Please enter a valid number.",
    enterExperience: "Enter farming experience (years):",
    farmInfoUpdated: "Farm information updated successfully!",
    selectPaymentMethod: "Select payment method:",
    MOBILE_MONEY: "Mobile Money",
    BANK_TRANSFER: "Bank Transfer",
    CASH: "Cash",
    enterMinOrderQty: "Enter minimum order quantity:",
    businessPrefsUpdated: "Business preferences updated successfully!",
    farmingMethod: "Farming Method",
    showMainMenu: "Show main menu",
    showAccountMenu: "Show account menu",
    currentStep: "current step",
    stepData: "step data",
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
    submitProductsFirst:
      "Veuillez soumettre des produits avant de voir les soumissions.",
    submissionFetchFailed: "Échec de la récupération des soumissions.",
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
    securitySettings: "Paramètres de sécurité",
    changePIN: "Changer le PIN",
    accountActivity: "Activité du compte",
    privacySettings: "Paramètres de confidentialité",
    accountRecovery: "Récupération de compte",
    enterCurrentPIN: "Entrez votre PIN actuel:",
    incorrectCurrentPIN: "PIN actuel incorrect. Réessayez.",
    enterNewPIN: "Entrez un nouveau PIN à 4 chiffres:",
    confirmNewPIN: "Confirmez le nouveau PIN:",
    invalidPinFormat: "Veuillez entrer 4 chiffres seulement.",
    pinChangedSuccessfully: "PIN changé avec succès!",
    pinChangeFailedTryAgain: "Échec du changement de PIN. Réessayez.",
    enterPINForActivity: "Entrez le PIN pour voir l'activité:",
    incorrectPinActivity: "PIN incorrect. Impossible de voir l'activité.",
    recentActivity: "Activité récente:",
    pinChangeHistory: "Historique des changements de PIN",
    securityQuestions: "Questions de sécurité",
    emergencyContact: "Contact d'urgence",
    updateProfile: "Mettre à jour le profil",
    pleaseUpdateProfile: "Veuillez mettre à jour votre profil.",
    changePhoneNumber: "Changer le numéro de téléphone",
    updateLocation: "Mettre à jour l'emplacement",
    communicationPrefs: "Préférences de communication",
    enterNewPhoneNumber: "Entrez le nouveau numéro de téléphone:",
    invalidPhoneFormat: "Format de numéro de téléphone invalide.",
    verificationCodeSent: "Code de vérification envoyé.",
    enterVerificationCode: "Entrez le code de vérification:",
    phoneNumberUpdated: "Numéro de téléphone mis à jour avec succès!",
    phoneUpdateFailed: "Échec de la mise à jour du numéro.",
    communicationUpdateSuccess:
      "Préférences de communication mis à jour avec succès!",
    locationUpdatedSuccessfully: "Emplacement mis à jour avec succès!",
    locationUpdateFailed: "Échec de la mise à jour de l'emplacement.",
    invalidInput: "Veuillez entrer une entrée valide.",
    techSupportDesc: "Support technique",
    reportIssue: "Signaler un problème",
    checkStatus: "Vérifier le statut du système",
    describeIssue: "Décrivez votre problème:",
    issueReportedSuccess: "Votre problème a été signalé avec succès!",
    issueReportFailed: "Échec du signalement du problème. Veuillez réessayer.",
    statusCheckFailed: "Échec de la vérification du statut du système.",
    faqFetchFailed: "Échec de la récupération des FAQ.",
    recentSubmissions: "Soumissions récentes:",
    status: "Statut",
    hectares: "hectares",
    years: "ans",
    cooperativeName: "Nom de la coopération:",
    cooperativeMember: "Membre de la coopération:",
    yes: "Oui",
    no: "Non",
    profileFetchFailed: "Échec de la récupération du profil.",
    totalEarnings: "Gains totaux",
    monthlyAverage: "Moyenne mensuelle",
    regionalAverage: "Moyenne régionale",
    transactions: "Transactions",
    incomeFetchFailed: "Échec de la récupération des données de revenus.",
    noIncomeData: "Aucune données de revenus disponibles pour le moment.",
    activityFetchFailed: "Échec de la récupération des activités.",
    languageChangeFailed: "Échec du changement de langue.",
    pinsDoNotMatch: "Les PIN ne correspondent pas. Veuillez réessayer.",
    pinChangedSuccess: "PIN changé avec succès!",
    smsNotifications: "Notifications SMS",
    notificationFrequency: "Fréquence des notifications",
    selectNotificationFreq: "Sélectionnez la fréquence des notifications:",
    IMMEDIATE: "Immédiat",
    DAILY: "Tous les jours",
    WEEKLY: "Hebdomadaire",
    farmingProfile: "Profil agricole",
    primaryCrops: "Cultures principales",
    farmInformation: "Informations sur la ferme",
    businessPreferences: "Préférences commerciales",
    viewProfile: "Voir le profil",
    enterPINForProfile: "Entrez le PIN pour voir le profil:",
    incorrectPinProfile: "PIN incorrect.",
    profileNotFound: "Profil non trouvé.",
    farmingProfileDetails: "Détails du profil agricole:",
    farmSize: "Taille de la ferme",
    experience: "Expérience",
    cooperative: "Coopérative",
    primaryCropsCount: "Nombre de cultures principales",
    updateCrops: "Mettre à jour les cultures",
    selectCrops: "Sélectionner les cultures",
    cropSeasonality: "Saisonnalité des cultures",
    defaultQuantities: "Quantités par défaut",
    farmSizeInHectares: "Taille de la ferme (en hectares)",
    yearsOfExperience: "Années d'expérience",
    cooperativeMembership: "Adhésion à une coopérative",
    organicCertification: "Certification biologique",
    preferredPaymentMethod: "Méthode de paiement préférée",
    minimumOrderQty: "Quantité minimale de commande",
    deliveryPreferences: "Préférences de livraison",
    earningsDashboard: "Tableau de bord des revenus",
    incomeSummary: "Résumé des revenus",
    performanceMetrics: "Métriques de performance",
    comparisonAnalytics: "Analyses comparatives",
    paymentHistory: "Historique des paiements",
    enterPINForEarnings: "Entrez le PIN pour voir les revenus:",
    incorrectPinEarnings: "PIN incorrect.",
    earningsDataNotAvailable: "Données de revenus non disponibles.",
    incomeSummaryDetails: "Détails du résumé des revenus:",
    thisMonth: "Ce mois-ci",
    lastMonth: "Le mois dernier",
    yearToDate: "Année en cours",
    avgPerSubmission: "Moyenne par soumission",
    enterPINForMetrics: "Entrez le PIN pour voir les métriques:",
    incorrectPinMetrics: "PIN incorrect.",
    metricsDataNotAvailable: "Données de métriques non disponibles.",
    performanceMetricsDetails: "Détails des métriques de performance:",
    acceptanceRate: "Taux d'acceptation",
    avgPricePerKg: "Prix moyen par Kg",
    topProduct: "Produit principal",
    pendingPayments: "Paiements en attente",
    completedPayments: "Paiements terminés",
    paymentSchedule: "Plan de paiement",
    regionalComparison: "Comparaison régionale",
    yearlyGrowth: "Croissance annuelle",
    marketPosition: "Position commerciale",
    technicalSupport: "Support technique",
    submitTicket: "Soumettre un ticket",
    ticketNumber: "Numéro de ticket",
    issueCategory: "Catégorie du problème",
    issueDescription: "Description du problème",
    requestCallback: "Demander un rappel",
    systemStatus: "État du système",
    faqSection: "Section FAQ",
    contactSupport: "Contacter le support",
    emergencySupport: "Support d'urgence",
    ticketSubmitted: "Ticket soumis",
    callbackRequested: "Rappel demandé",
    supportHours: "Heures de support",
    knownIssues: "Problèmes connus",
    troubleshooting: "Dépannage",
    videoTutorials: "Tutoriels vidéo",
    userGuide: "Guide de l'utilisateur",
    invalidSelection: "Sélection invalide. Réessayez.",
    sessionExpired: "La session a expiré.",
    serviceUnavailable: "Le service est indisponible.",
    tryAgainLater: "Veuillez réessayer plus tard.",
    actionCancelled: "L'action a été annulée.",
    confirmAction: "Confirmer l'action",
    dataUpdated: "Données mises à jour avec succès",
    operationFailed: "Opération échouée",
    accessDenied: "Accès refusé",
    accountLocked: "Compte verrouillé",
    suspiciousActivity: "Activité suspecte",
    securityAlert: "Alerte de sécurité",
    currentPhone: "Téléphone actuel",
    noDataAvailable: "Aucune donnée disponible",
    userNotFound: "Compte non trouvé",
    pinVerificationFailed: "Échec de la vérification du PIN",
    sessionExpiredPleaseRestart: "Session expirée. Veuillez recommencer",
    contactSupportForAssistance: "Contactez le support au +250796897823",
    overall: "Global",
    database: "Base de données",
    sms: "SMS",
    payments: "Paiements",
    systemError: "Erreur système",
    pleaseRetry: "Veuillez reessayer plus tard.",
    priceHigherThanMarket: "Votre prix est plus haut que le prix de marche",
    marketPrice: "Prix de marche",
    yourPrice: "Votre Prix",
    acceptAndContinue: "Accepter et Continuer",
    changePrice: "Modifier le Prix",
    confirmLocationUpdate: "Confirmer la mise à jour de la localisation",
    province: "Province",
    district: "District",
    sector: "Secteur",
    cell: "Cellule",
    village: "Village",
    confirm: "Confirmer",
    cancel: "Annuler",
    none: "Aucun",
    cropsUpdated: "Cultures mises à jour avec succès!",
    enterFarmSize: "Entrez la taille de la ferme (hectares):",
    invalidNumber: "Veuillez entrer un nombre valide.",
    enterExperience: "Entrez l'expérience agricole (années):",
    farmInfoUpdated: "Informations sur la ferme mises à jour avec succès!",
    selectPaymentMethod: "Sélectionnez le mode de paiement:",
    MOBILE_MONEY: "Mobile Money",
    BANK_TRANSFER: "Virement bancaire",
    CASH: "Espèces",
    enterMinOrderQty: "Entrez la quantité minimale de commande:",
    businessPrefsUpdated: "Préférences commerciales mises à jour avec succès!",
    farmingMethod: "Méthode d'agriculture",
    showMainMenu: "Afficher le menu principal",
    showAccountMenu: "Afficher le menu du compte",
    currentStep: "étape actuelle",
    stepData: "données d'étape",
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
