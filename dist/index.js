"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const yamljs_1 = __importDefault(require("yamljs"));
const routes_1 = __importDefault(require("./routes"));
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
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use("/", routes_1.default);
app.get("/", (_req, res) => {
    res.send("API is working");
});
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
