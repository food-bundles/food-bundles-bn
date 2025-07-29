import { Router } from "express";
import { ussdHandler } from "../controllers/ussdControllers";

const ussdRoutes = Router();

ussdRoutes.post("/user/ussd", ussdHandler);

export default ussdRoutes;
