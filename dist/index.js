"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wsManager = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const yamljs_1 = __importDefault(require("yamljs"));
const routes_1 = __importDefault(require("./routes"));
const config_1 = require("./config");
const websocket_manager_1 = __importDefault(require("./utils/websocket_manager"));
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
// Create HTTP server
const httpServer = http_1.default.createServer(app);
// Initialize WebSocket Manager
exports.wsManager = new websocket_manager_1.default();
exports.wsManager.initialize(httpServer);
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
}));
app.use(express_1.default.json());
app.use(express_1.default.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: false }));
app.use("/", routes_1.default);
app.get("/health", (_req, res) => {
    res.status(200).json({ message: "Backend is healthy" });
});
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
app.get("/", (_req, res) => {
    res.status(200).json({ message: "FoodBundles Backend API is running!!!" });
});
// WebSocket stats endpoint
app.get("/ws/stats", (_req, res) => {
    const stats = exports.wsManager.getStats();
    res.status(200).json(stats);
});
const PORT = config_1.ENV.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`
====================================
🚀 FoodBundles API Server running on port ${PORT}
📡 WebSocket endpoint: ws://localhost:${PORT}/api/ws
📚 API Documentation: http://localhost:${PORT}/api-docs
====================================
  `);
});
// Graceful shutdown
process.on("SIGINT", () => {
    exports.wsManager.cleanup();
    httpServer.close(() => {
        console.log("Server shut down gracefully");
        process.exit(0);
    });
});
process.on("SIGTERM", () => {
    exports.wsManager.cleanup();
    httpServer.close(() => {
        process.exit(0);
    });
});
