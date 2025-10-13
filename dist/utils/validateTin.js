"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTIN = validateTIN;
function validateTIN(tin) {
    const tinRegex = /^[0-9]{9}$/;
    return tinRegex.test(tin) && tin !== "000000000";
}
