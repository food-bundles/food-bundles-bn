"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.isAuthenticated = void 0;
const jwt_1 = require("../utils/jwt");
const userGets_1 = require("../services/userGets");
const isAuthenticated = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized: No token found" });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = (0, jwt_1.verifyToken)(token);
        const user = await (0, userGets_1.getUserById)(decoded.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        req.user = user;
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
