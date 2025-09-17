"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ussdControllers_1 = require("../controllers/ussdControllers");
const ussdRoutes = (0, express_1.Router)();
ussdRoutes.post("/farmer/ussd", ussdControllers_1.ussdHandler);
ussdRoutes.get("/farmers/ussd", (req, res) => {
    res.send("USSD endpoint is working! Use POST method.");
});
exports.default = ussdRoutes;
