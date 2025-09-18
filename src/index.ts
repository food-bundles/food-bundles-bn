import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import YAML from "yamljs";
import routes from "./routes";
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
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Remove cookieParser middleware

app.use("/", routes);

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
