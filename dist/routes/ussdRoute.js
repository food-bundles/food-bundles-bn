"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ussdControllers_1 = require("../controllers/ussdControllers");
const authMiddleware_1 = require("../middleware/authMiddleware");
const ussdRoutes = (0, express_1.Router)();
ussdRoutes.post("/farmer/ussd", ussdControllers_1.ussdHandler);
ussdRoutes.post("/farmer/web", authMiddleware_1.isAuthenticated, ussdControllers_1.submitProductController);
ussdRoutes.get("/farmers/ussd", (req, res) => {
    res.send("USSD endpoint is working! Use POST method.");
});
exports.default = ussdRoutes;
