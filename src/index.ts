import express from "express";
import http from "http";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import YAML from "yamljs";
import { IncomingMessage } from "http";
import routes from "./routes";
import { ENV } from "./config";
import WebSocketManager from "./utils/websocket_manager";

interface CustomIncomingMessage extends IncomingMessage {
  rawBody: Buffer;
}

const swaggerBaseDoc = YAML.load("./src/config/swagger.yaml");

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

const specs = swaggerJSDoc(options);

const app = express();

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize WebSocket Manager
export const wsManager = new WebSocketManager();
wsManager.initialize(httpServer);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());
app.use(
  express.json({
    verify: (req: CustomIncomingMessage, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

app.use("/", routes);

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "Backend is healthy" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.get("/", (_req, res) => {
  res.status(200).json({ message: "FoodBundles Backend API is running!!!" });
});

// WebSocket stats endpoint
app.get("/ws/stats", (_req, res) => {
  const stats = wsManager.getStats();
  res.status(200).json(stats);
});

const PORT = ENV.PORT || 4000;

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
  wsManager.cleanup();
  httpServer.close(() => {
    console.log("Server shut down gracefully");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  wsManager.cleanup();
  httpServer.close(() => {
    process.exit(0);
  });
});
