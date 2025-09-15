"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const userRoutes = (0, express_1.Router)();
userRoutes.post("/login", userController_1.UserController.login);
userRoutes.get("/me", userController_1.UserController.me);
exports.default = userRoutes;
