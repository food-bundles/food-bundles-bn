import { Router } from "express";
import {
  submitProductController,
  ussdHandler,
} from "../controllers/ussdControllers";
import { isAuthenticated } from "../middleware/authMiddleware";

const ussdRoutes = Router();

ussdRoutes.post("/farmer/ussd", ussdHandler);
ussdRoutes.post("/farmer/web", isAuthenticated, submitProductController);
ussdRoutes.get("/farmers/ussd", (req, res) => {
  res.send("USSD endpoint is working! Use POST method.");
});

export default ussdRoutes;
