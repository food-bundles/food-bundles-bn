// Backend Index - Updated for Token-Based Auth
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import YAML from "yamljs";
import routes from "./routes";
// Remove cookieParser import as we no longer use cookies
import { ENV } from "./config";

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

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://food-bundles-fn.vercel.app",
      "https://food-bundle-bn.onrender.com",
    ],
    credentials: false, // Changed to false since we don't use cookies anymore
    allowedHeaders: ["Content-Type", "Authorization"], // Add Authorization header
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Remove cookieParser middleware

app.use("/api", routes);

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "Backend is healthy" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

app.get("/", (_req, res) => {
  res.status(200).json({ message: "FoodBundles Backend API is running!!!" });
});

const PORT = ENV.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
