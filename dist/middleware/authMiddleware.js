"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.isAuthenticated = void 0;
const jwt_1 = require("../utils/jwt");
const userGets_1 = require("../services/userGets");
const isAuthenticated = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = (0, jwt_1.verifyToken)(token);
        const user = (0, userGets_1.getUserById)(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};
exports.isAuthenticated = isAuthenticated;
const checkPermission = (...allowedRoles) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }
        next();
    };
};
exports.checkPermission = checkPermission;
