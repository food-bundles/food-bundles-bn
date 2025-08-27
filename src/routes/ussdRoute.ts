import { Router } from "express";
import { ussdHandler } from "../controllers/ussdControllers";

const ussdRoutes = Router();

ussdRoutes.post("/farmer/ussd", ussdHandler);
ussdRoutes.get("/farmers/ussd", (req, res) => {
  res.send("USSD endpoint is working! Use POST method.");
});

export default ussdRoutes;
