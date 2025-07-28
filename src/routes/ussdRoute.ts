import { Router } from "express";
import { ussdHandler } from "../controllers/ussdControllers";

const ussdRoutes = Router();

ussdRoutes.post("/ussd", ussdHandler);

export default ussdRoutes;
