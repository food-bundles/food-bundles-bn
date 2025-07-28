import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import ussdRoutes from "./routes/ussdRoute";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false })); 

app.use("/api", ussdRoutes);

app.get("/", (_req, res) => {
  res.send("API is working");
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
