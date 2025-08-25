"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.capturePayment = capturePayment;
const axios = require("axios");
async function generatePayPalAccessToken() {
    const response = await axios({
        url: process.env.PAYPAL_BASE_URL + "/v1/oauth2/token",
        method: "post",
        data: "grant_type=client_credentials",
        auth: {
            username: process.env.PAYPAL_CLIENT_ID,
            password: process.env.PAYPAL_SECRET,
        },
    });
    return response.data.access_token;
}
async function createOrder() {
    const accessToken = await generatePayPalAccessToken();
    const response = await axios({
        url: process.env.PAYPAL_BASE_URL + "/v2/checkout/orders",
        method: "post",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
        },
        data: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
                {
                    items: [
                        {
                            name: "Node.js Complete Course",
                            description: "Node.js Complete Course with Express and MongoDB",
                            quantity: 1,
                            unit_amount: {
                                currency_code: "USD",
                                value: "100.00",
                            },
                        },
                    ],
                    amount: {
                        currency_code: "USD",
                        value: "100.00",
                        breakdown: {
                            item_total: {
                                currency_code: "USD",
                                value: "100.00",
                            },
                        },
                    },
                },
            ],
            application_context: {
                return_url: process.env.BASE_URL + "/complete-order",
                cancel_url: process.env.BASE_URL + "/cancel-order",
                shipping_preference: "NO_SHIPPING",
                user_action: "PAY_NOW",
                brand_name: "FoodBundles",
            },
        }),
    });
    console.log("====================================");
    console.log("Received order response from PayPal", response.data.links);
    console.log("====================================");
    return response.data.links.find((link) => link.rel === "approve").href;
}
async function capturePayment(orderId) {
    const accessToken = await generatePayPalAccessToken();
    const response = await axios({
        url: process.env.PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`,
        method: "post",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + accessToken,
        },
    });
    console.log("====================================");
    console.log("Received payment response from PayPal", response);
    console.log("====================================");
    return response.data;
}
