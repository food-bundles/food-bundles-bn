import express from "express";
import cors from "cors";
import routes from "./routes";
import cookieParser from "cookie-parser";
import { ENV } from "./config";


const app = express();

app.use(
  cors({
    origin: "http://localhost:3000", 
    credentials: true, 
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false })); 
app.use(cookieParser());

app.use("/", routes);
app.get("/health", (_req, res) => {
  res.status(200).json({ message: "Backend is healthy" });
});

const PORT = ENV.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
