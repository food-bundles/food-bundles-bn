"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Backend Index - Updated for Token-Based Auth
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const yamljs_1 = __importDefault(require("yamljs"));
const routes_1 = __importDefault(require("./routes"));
// Remove cookieParser import as we no longer use cookies
const config_1 = require("./config");
const swaggerBaseDoc = yamljs_1.default.load("./src/config/swagger.yaml");
const options = {
    swaggerDefinition: { ...swaggerBaseDoc },
    apis: [
        "./src/routes/**/*.ts",
        "./src/controllers/**/*.ts",
        "./src/docs/**/*.yaml",
        "./src/docs/**/*.yml",
        "./src/routes/**/*.js",
    ],
};
const specs = (0, swagger_jsdoc_1.default)(options);
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://food-bundles-fn.vercel.app",
        "https://food-bundle-bn.onrender.com",
    ],
    credentials: false, // Changed to false since we don't use cookies anymore
    allowedHeaders: ["Content-Type", "Authorization"], // Add Authorization header
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
// Remove cookieParser middleware
app.use("/", routes_1.default);
app.get("/health", (_req, res) => {
    res.status(200).json({ message: "Backend is healthy" });
});
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
app.get("/", (_req, res) => {
    res.status(200).json({ message: "FoodBundles Backend API is running!!!" });
});
const PORT = config_1.ENV.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
