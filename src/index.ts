import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import YAML from "yamljs";
import routes from "./routes";

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

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", routes);

app.get("/", (_req, res) => {
  res.send("API is working");
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
