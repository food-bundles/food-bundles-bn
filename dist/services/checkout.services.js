"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaymentStatus = exports.processPaymentService = exports.cancelCheckoutService = exports.updateCheckoutService = exports.getAllCheckoutsService = exports.getRestaurantCheckoutsService = exports.getCheckoutByIdService = exports.createCheckoutService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const prisma_1 = __importDefault(require("../prisma"));
const wallet_service_1 = require("./wallet.service");
const emailTemplates_1 = require("../utils/emailTemplates");
const cart_service_1 = require("./cart.service");
dotenv_1.default.config();
const Flutterwave = require("flutterwave-node-v3");
// Initialize Flutterwave
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY);
/**
 * Enhanced service to create a new checkout from cart
 */
const createCheckoutService = async (data) => {
    const { cartId, restaurantId, paymentMethod, billingName, billingEmail, billingPhone, billingAddress, notes, deliveryDate, clientIp, deviceFingerprint, narration, currency = "RWF", } = data;
    // Validate cart exists and belongs to restaurant
    const cart = await prisma_1.default.cart.findUnique({
        where: { id: cartId },
        include: {
            cartItems: {
                include: {
                    product: true,
                },
            },
            restaurant: true,
        },
    });
    if (!cart) {
        throw new Error("Cart not found");
    }
    if (cart.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Cart does not belong to this restaurant");
    }
    if (cart.status !== "ACTIVE") {
        throw new Error("Cart is not active");
    }
    if (cart.cartItems.length === 0) {
        throw new Error("Cart is empty");
    }
    // Validate all products are still available
    for (const item of cart.cartItems) {
        if (item.product.status !== "ACTIVE") {
            throw new Error(`Product ${item.product.productName} is no longer available`);
        }
        if (item.product.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${item.product.productName}. Available: ${item.product.quantity}, Required: ${item.quantity}`);
        }
    }
    // Check if checkout already exists for this cart
    const existingCheckout = await prisma_1.default.cHECKOUT.findUnique({
        where: { cartId },
    });
    let checkout;
    if (existingCheckout) {
        // Update existing checkout
        checkout = await prisma_1.default.cHECKOUT.update({
            where: { id: existingCheckout.id },
            data: {
                orderId: null,
                totalAmount: cart.totalAmount || existingCheckout.totalAmount,
                paymentMethod: paymentMethod || existingCheckout.paymentMethod,
                billingName: billingName || existingCheckout.billingName,
                billingEmail: billingEmail || existingCheckout.billingEmail,
                billingPhone: billingPhone || existingCheckout.billingPhone,
                billingAddress: billingAddress || existingCheckout.billingAddress,
                notes: notes || existingCheckout.notes,
                deliveryDate: deliveryDate || existingCheckout.deliveryDate,
                paymentStatus: "PENDING",
                currency: currency || existingCheckout.currency,
                clientIp: clientIp || existingCheckout.clientIp,
                deviceFingerprint: deviceFingerprint || existingCheckout.deviceFingerprint,
                narration: narration ||
                    existingCheckout.narration ||
                    `Payment for ${cart.restaurant.name} order`,
            },
            include: {
                cart: {
                    include: {
                        cartItems: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    else {
        // Create new checkout
        // Generate transaction reference
        const txRef = `${restaurantId}_${cartId}_${Date.now()}`;
        const txOrderId = `ORDER_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        // Create checkout
        checkout = await prisma_1.default.cHECKOUT.create({
            data: {
                cartId,
                restaurantId,
                totalAmount: cart.totalAmount,
                paymentMethod,
                billingName,
                billingEmail,
                billingPhone,
                billingAddress,
                notes,
                deliveryDate,
                paymentStatus: "PENDING",
                txRef,
                txOrderId,
                currency,
                clientIp,
                deviceFingerprint,
                narration: narration || `Payment for ${cart.restaurant.name} order`,
            },
            include: {
                cart: {
                    include: {
                        cartItems: {
                            include: {
                                product: true,
                            },
                        },
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });
    }
    return checkout;
};
exports.createCheckoutService = createCheckoutService;
/**
 * Enhanced service to get checkout by ID
 */
const getCheckoutByIdService = async (checkoutId, restaurantId) => {
    const checkout = await prisma_1.default.cHECKOUT.findUnique({
        where: { id: checkoutId },
        include: {
            cart: {
                include: {
                    cartItems: {
                        include: {
                            product: true,
                        },
                    },
                },
            },
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            order: true,
        },
    });
    if (!checkout) {
        throw new Error("Checkout not found");
    }
    if (restaurantId && checkout.restaurantId !== restaurantId) {
        throw new Error("Unauthorized: Checkout does not belong to this restaurant");
    }
    return checkout;
};
exports.getCheckoutByIdService = getCheckoutByIdService;
/**
 * Enhanced service to get all checkouts for a restaurant
 */
const getRestaurantCheckoutsService = async (restaurantId, { page = 1, limit = 10, status, paymentMethod, }) => {
    const skip = (page - 1) * limit;
    const where = { restaurantId };
    if (status)
        where.paymentStatus = status;
    if (paymentMethod)
        where.paymentMethod = paymentMethod;
    const [checkouts, total] = await Promise.all([
        prisma_1.default.cHECKOUT.findMany({
            where,
            skip,
            take: limit,
            include: {
                cart: {
                    include: {
                        _count: {
                            select: {
                                cartItems: true,
                            },
                        },
                    },
                },
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.cHECKOUT.count({ where }),
    ]);
    return {
        checkouts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getRestaurantCheckoutsService = getRestaurantCheckoutsService;
/**
 * Enhanced service to get all checkouts (Admin only)
 */
const getAllCheckoutsService = async ({ page = 1, limit = 10, status, paymentMethod, }) => {
    const skip = (page - 1) * limit;
    const where = {};
    if (status)
        where.paymentStatus = status;
    if (paymentMethod)
        where.paymentMethod = paymentMethod;
    const [checkouts, total] = await Promise.all([
        prisma_1.default.cHECKOUT.findMany({
            where,
            skip,
            take: limit,
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                cart: {
                    include: {
                        _count: {
                            select: {
                                cartItems: true,
                            },
                        },
                    },
                },
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        }),
        prisma_1.default.cHECKOUT.count({ where }),
    ]);
    return {
        checkouts,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.getAllCheckoutsService = getAllCheckoutsService;
/**
 * Enhanced service to update checkout
 */
const updateCheckoutService = async (checkoutId, data, restaurantId) => {
    const existingCheckout = await (0, exports.getCheckoutByIdService)(checkoutId, restaurantId);
    if (existingCheckout.paymentStatus === "COMPLETED") {
        throw new Error("Cannot update checkout after payment is completed");
    }
    const updatedCheckout = await prisma_1.default.cHECKOUT.update({
        where: { id: checkoutId },
        data: {
            ...data,
            updatedAt: new Date(),
            paidAt: data.paymentStatus === "COMPLETED"
                ? new Date()
                : existingCheckout.paidAt,
        },
        include: {
            cart: {
                include: {
                    cartItems: {
                        include: {
                            product: true,
                        },
                    },
                },
            },
            restaurant: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                },
            },
            order: true,
        },
    });
    return updatedCheckout;
};
exports.updateCheckoutService = updateCheckoutService;
/**
 * Enhanced service to cancel/delete checkout
 */
const cancelCheckoutService = async (checkoutId, restaurantId) => {
    const checkout = await (0, exports.getCheckoutByIdService)(checkoutId, restaurantId);
    if (checkout.paymentStatus === "COMPLETED") {
        throw new Error("Cannot cancel completed checkout");
    }
    if (checkout.order) {
        throw new Error("Cannot cancel checkout that has been converted to order");
    }
    await prisma_1.default.$transaction([
        prisma_1.default.cHECKOUT.delete({
            where: { id: checkoutId },
        }),
        prisma_1.default.cart.update({
            where: { id: checkout.cartId },
            data: { status: "ACTIVE" },
        }),
    ]);
    return { message: "Checkout cancelled successfully" };
};
exports.cancelCheckoutService = cancelCheckoutService;
/**
 * Enhanced service to process payment for checkout with all 3 payment methods
 */
const processPaymentService = async (checkoutId, paymentData) => {
    const checkout = await (0, exports.getCheckoutByIdService)(checkoutId);
    if (checkout.paymentStatus === "COMPLETED") {
        throw new Error("Payment already completed");
    }
    // Update payment status to processing
    await (0, exports.updateCheckoutService)(checkoutId, {
        paymentStatus: "PROCESSING",
        paymentMethod: paymentData.paymentMethod,
    });
    try {
        let paymentResult;
        switch (paymentData.paymentMethod) {
            case "MOBILE_MONEY":
                paymentResult = await processMobileMoneyPayment({
                    amount: checkout.totalAmount,
                    phoneNumber: paymentData.phoneNumber,
                    txRef: checkout.txRef,
                    orderId: checkout.txOrderId,
                    email: checkout.restaurant.email,
                    fullname: checkout.restaurant.name,
                    currency: checkout.currency || "RWF",
                });
                break;
            case "CARD":
                paymentResult = await processCardPayment({
                    amount: checkout.totalAmount,
                    txRef: checkout.txRef,
                    email: checkout.billingEmail || checkout.restaurant.email,
                    fullname: checkout.billingName || checkout.restaurant.name,
                    phoneNumber: paymentData.phoneNumber || checkout.billingPhone || "",
                    currency: checkout.currency || "RWF",
                    cardDetails: paymentData.cardDetails,
                });
                break;
            case "BANK_TRANSFER":
                paymentResult = await processBankTransfer({
                    amount: checkout.totalAmount,
                    txRef: checkout.txRef,
                    email: checkout.billingEmail || checkout.restaurant.email,
                    phoneNumber: paymentData.phoneNumber || checkout.billingPhone || "",
                    currency: checkout.currency || "RWF",
                    clientIp: paymentData.bankDetails?.clientIp ||
                        checkout.clientIp ||
                        "127.0.0.1",
                    deviceFingerprint: checkout.deviceFingerprint || "62wd23423rq324323qew1",
                    narration: checkout.narration || "Order payment",
                });
                break;
            case "CASH":
                try {
                    // Get restaurant's wallet
                    const wallet = await (0, wallet_service_1.getWalletByRestaurantIdService)(checkout.restaurantId);
                    if (!wallet.isActive) {
                        throw new Error("Wallet is inactive. Please contact support.");
                    }
                    // Check if wallet has sufficient balance
                    if (wallet.balance < checkout.totalAmount) {
                        throw new Error(`Insufficient wallet balance. Available: ${wallet.balance} ${wallet.currency}, Required: ${checkout.totalAmount} ${checkout.currency || "RWF"}`);
                    }
                    // Debit wallet for the payment
                    const walletDebitResult = await (0, wallet_service_1.debitWalletService)({
                        walletId: wallet.id,
                        amount: checkout.totalAmount,
                        description: `Payment for checkout ${checkoutId} - Order ${checkout.txOrderId}`,
                        reference: checkoutId,
                        checkoutId: checkoutId,
                    });
                    paymentResult = {
                        success: true,
                        transactionId: `WALLET_${checkout.txRef}_${Date.now()}`,
                        reference: checkout.txRef ?? "",
                        flwRef: `WALLET_${checkout.txRef}`,
                        status: "successful",
                        message: "Payment completed using wallet balance",
                        walletDetails: {
                            previousBalance: walletDebitResult.transaction.previousBalance,
                            newBalance: walletDebitResult.newBalance,
                            transactionId: walletDebitResult.transaction.id,
                        },
                    };
                }
                catch (walletError) {
                    // If wallet payment fails, return appropriate error
                    paymentResult = {
                        success: false,
                        transactionId: "",
                        reference: checkout.txRef ?? "",
                        flwRef: "",
                        status: "failed",
                        message: walletError.message || "Wallet payment failed",
                        error: walletError.message,
                    };
                }
                break;
            default:
                throw new Error("Unsupported payment method");
        }
        console.log("Payment result:", paymentResult);
        // Clear the cart by setting its status to COMPLETED
        await (0, cart_service_1.clearCartService)(checkout.restaurantId);
        if (paymentResult.success) {
            const updateData = {
                paymentStatus: paymentResult.status === "successful" ? "COMPLETED" : "PROCESSING",
                transactionId: paymentResult.transactionId,
                paymentReference: paymentResult.reference,
                flwRef: paymentResult.flwRef,
                flwStatus: paymentResult.status,
                flwMessage: paymentResult.message,
            };
            // Handle card payment specific data
            if (paymentData.paymentMethod === "CARD" &&
                "cardPaymentData" in paymentResult &&
                paymentResult.cardPaymentData) {
                const cardData = paymentResult.cardPaymentData;
                updateData.chargedAmount = cardData.chargedAmount;
                updateData.appFee = cardData.appFee;
                updateData.merchantFee = cardData.merchantFee;
                updateData.processorResponse = cardData.processorResponse;
                updateData.authModel = cardData.authModel;
                updateData.deviceFingerprint = cardData.deviceFingerprint;
                updateData.fraudStatus = cardData.fraudStatus;
                updateData.paymentType = cardData.paymentType;
                updateData.chargeType = cardData.chargeType;
                updateData.narration = cardData.narration;
                // Store card data (Note: need to add these fields to UpdateCheckoutData interface)
                updateData.cardFirst6Digits = cardData.cardFirst6Digits;
                updateData.cardLast4Digits = cardData.cardLast4Digits;
                updateData.cardType = cardData.cardType;
                updateData.cardExpiry = cardData.cardExpiry;
                updateData.customerId = cardData.customerId?.toString();
                updateData.customerName = cardData.customerName;
                updateData.customerEmail = cardData.customerEmail;
                updateData.customerPhone = cardData.customerPhone;
            }
            // Handle payment method specific data with type guards
            if ("transferDetails" in paymentResult && paymentResult.transferDetails) {
                updateData.transferReference =
                    paymentResult.transferDetails.transferReference;
                updateData.transferAccount =
                    paymentResult.transferDetails.transferAccount;
                updateData.transferBank = paymentResult.transferDetails.transferBank;
                updateData.transferAmount =
                    paymentResult.transferDetails.transferAmount;
                updateData.transferNote = paymentResult.transferDetails.transferNote;
                updateData.accountExpiration =
                    paymentResult.transferDetails.accountExpiration ?? undefined;
            }
            if ("authorizationDetails" in paymentResult &&
                paymentResult.authorizationDetails) {
                updateData.authorizationMode = paymentResult.authorizationDetails.mode;
                updateData.redirectUrl = paymentResult.authorizationDetails.redirectUrl;
                updateData.authorizationUrl =
                    paymentResult.authorizationDetails.redirectUrl;
            }
            const updatedCheckout = await (0, exports.updateCheckoutService)(checkoutId, updateData);
            // Send notification email for successful payments
            if (paymentResult.status === "successful" && checkout.billingEmail) {
                const products = checkout.cart.cartItems.map((item) => ({
                    name: item.product.productName,
                    quantity: item.quantity,
                    price: item.product.unitPrice * item.quantity,
                    unitPrice: item.product.unitPrice,
                }));
                (0, emailTemplates_1.sendPaymentNotificationEmail)({
                    amount: checkout.totalAmount,
                    phoneNumber: paymentData.phoneNumber || checkout.billingPhone || "",
                    restaurantName: checkout.restaurant.name,
                    products,
                    customer: {
                        name: checkout.billingName || checkout.restaurant.name,
                        email: checkout.billingEmail,
                    },
                    checkoutId: checkoutId,
                    paymentMethod: paymentData.paymentMethod,
                    walletDetails: "walletDetails" in paymentResult
                        ? paymentResult.walletDetails
                        : undefined,
                });
            }
            return {
                success: true,
                checkout: updatedCheckout,
                transactionId: paymentResult.transactionId,
                redirectUrl: "authorizationDetails" in paymentResult
                    ? paymentResult.authorizationDetails?.redirectUrl
                    : undefined,
                transferDetails: "transferDetails" in paymentResult
                    ? paymentResult.transferDetails
                    : undefined,
                walletDetails: "walletDetails" in paymentResult
                    ? paymentResult.walletDetails
                    : undefined,
                status: paymentResult.status,
                message: paymentResult.message,
            };
        }
        else {
            await (0, exports.updateCheckoutService)(checkoutId, {
                paymentStatus: "FAILED",
                flwStatus: "failed",
                flwMessage: paymentResult.error || "Payment failed",
            });
            return {
                success: false,
                error: paymentResult.error || "Payment failed",
            };
        }
    }
    catch (error) {
        console.log("Error processing payment:", error);
        await (0, exports.updateCheckoutService)(checkoutId, {
            paymentStatus: "FAILED",
            flwStatus: "failed",
            flwMessage: error.message,
        });
        throw new Error(`Payment processing failed: ${error.message}`);
    }
};
exports.processPaymentService = processPaymentService;
/**
 * Service to verify payment status
 */
const verifyPaymentStatus = async (transactionId) => {
    try {
        const response = await flw.Transaction.verify({ id: transactionId });
        if (response.status === "success" &&
            response.data.status === "successful") {
            return {
                success: true,
                data: response.data,
                amount: response.data.amount,
                currency: response.data.currency,
                status: response.data.status,
                flwRef: response.data.flw_ref,
                txRef: response.data.tx_ref,
                chargedAmount: response.data.charged_amount,
                appFee: response.data.app_fee,
                merchantFee: response.data.merchant_fee,
                processorResponse: response.data.processor_response,
            };
        }
        else {
            return {
                success: false,
                error: "Payment verification failed",
                data: response.data,
                status: response.data?.status,
            };
        }
    }
    catch (error) {
        console.log("Error verifying payment:", error);
        return {
            success: false,
            error: "Payment verification failed  " + error.message,
        };
    }
};
exports.verifyPaymentStatus = verifyPaymentStatus;
/**
 * Process Rwanda Mobile Money Payment
 */
async function processMobileMoneyPayment({ amount, phoneNumber, txRef, orderId, email, fullname, currency = "RWF", }) {
    try {
        // Clean and validate phone number
        const cleanedPhoneNumber = (0, emailTemplates_1.cleanPhoneNumber)(phoneNumber);
        if (!(0, emailTemplates_1.isValidRwandaPhone)(cleanedPhoneNumber)) {
            throw new Error("Invalid mobile number. Please use format: 078XXXXXXX, 079XXXXXXX, 072XXXXXXX, or 073XXXXXXX");
        }
        console.log(`Processing mobile money payment: ${amount} ${currency} to ${cleanedPhoneNumber}`);
        const payload = {
            tx_ref: txRef,
            order_id: orderId,
            amount: amount.toString(),
            currency: currency,
            email: email,
            phone_number: cleanedPhoneNumber,
            fullname: fullname,
        };
        const response = await flw.MobileMoney.rwanda(payload);
        console.log("Mobile Money Response:", response);
        if (response.status === "success") {
            return {
                success: true,
                transactionId: response.data?.flw_ref || txRef,
                reference: response.data?.tx_ref || txRef,
                flwRef: response.data?.flw_ref || txRef,
                status: response.data?.status || "pending",
                message: response.message || "Mobile money payment initiated",
                authorizationDetails: response.meta?.authorization && {
                    mode: response.meta.authorization.mode,
                    redirectUrl: response.meta.authorization.redirect,
                },
            };
        }
        else {
            return {
                success: false,
                error: response.message || "Mobile money payment failed",
                transactionId: "",
                reference: "",
                flwRef: "",
                status: "failed",
                message: response.message || "Mobile money payment failed",
            };
        }
    }
    catch (error) {
        console.log("Mobile money payment failed:", error);
        let errorMessage = "Mobile money payment processing failed";
        if (error.message.includes("Invalid") || error.message.includes("phone")) {
            errorMessage = "Invalid phone number format";
        }
        else if (error.message.includes("insufficient")) {
            errorMessage = "Insufficient balance";
        }
        return {
            success: false,
            transactionId: "",
            reference: "",
            flwRef: "",
            status: "failed",
            message: errorMessage,
            error: errorMessage,
            details: error.message,
        };
    }
}
/**
 * Process Card Payment
 */
async function processCardPayment({ amount, txRef, email, fullname, phoneNumber, currency = "RWF", cardDetails, }) {
    try {
        console.log(`Processing card payment: ${amount} ${currency} for ${email}`);
        const payload = {
            card_number: cardDetails.cardNumber,
            cvv: cardDetails.cvv,
            expiry_month: cardDetails.expiryMonth,
            expiry_year: cardDetails.expiryYear,
            currency: currency,
            amount: amount.toString(),
            redirect_url: `${process.env.CLIENT_PRODUCTION_URL}/payments/flutterwave/callback`,
            fullname: fullname,
            email: email,
            phone_number: phoneNumber,
            enckey: process.env.FLW_ENCRYPTION_KEY,
            tx_ref: txRef,
        };
        // Add PIN if provided
        if (cardDetails.pin) {
            payload.authorization = {
                mode: "pin",
                pin: cardDetails.pin,
            };
        }
        const response = await flw.Charge.card(payload);
        console.log("Card Payment Response:", response);
        if (response.status === "success") {
            let authorizationDetails = undefined;
            // Handle different authorization modes
            if (response.meta?.authorization?.mode === "pin") {
                authorizationDetails = {
                    mode: "pin",
                    redirectUrl: "",
                    message: "Please enter your card PIN",
                };
            }
            else if (response.meta?.authorization?.mode === "redirect") {
                authorizationDetails = {
                    mode: "redirect",
                    redirectUrl: response.meta.authorization.redirect,
                    message: "Redirecting to bank for authorization",
                };
            }
            else if (response.meta?.authorization?.mode === "otp") {
                authorizationDetails = {
                    mode: "otp",
                    redirectUrl: response.meta.authorization.endpoint,
                    message: "Please enter the OTP sent to your phone/email",
                };
            }
            return {
                success: true,
                transactionId: response.data?.id?.toString() || response.data?.flw_ref || txRef,
                reference: response.data?.tx_ref || txRef,
                flwRef: response.data?.flw_ref || txRef,
                status: response.data?.status || "pending",
                message: response.message || "Card payment initiated",
                authorizationDetails,
                // Additional data to store in database
                cardPaymentData: {
                    transactionId: response.data?.id,
                    flwRef: response.data?.flw_ref,
                    deviceFingerprint: response.data?.device_fingerprint,
                    amount: response.data?.amount,
                    chargedAmount: response.data?.charged_amount,
                    appFee: response.data?.app_fee,
                    merchantFee: response.data?.merchant_fee,
                    processorResponse: response.data?.processor_response,
                    authModel: response.data?.auth_model,
                    currency: response.data?.currency,
                    ip: response.data?.ip,
                    narration: response.data?.narration,
                    status: response.data?.status,
                    authUrl: response.data?.auth_url,
                    paymentType: response.data?.payment_type,
                    fraudStatus: response.data?.fraud_status,
                    chargeType: response.data?.charge_type,
                    // Card specific data
                    cardFirst6Digits: response.data?.card?.first_6digits,
                    cardLast4Digits: response.data?.card?.last_4digits,
                    cardCountry: response.data?.card?.country,
                    cardType: response.data?.card?.type,
                    cardExpiry: response.data?.card?.expiry,
                    // Customer data
                    customerId: response.data?.customer?.id,
                    customerName: response.data?.customer?.name,
                    customerEmail: response.data?.customer?.email,
                    customerPhone: response.data?.customer?.phone_number,
                },
            };
        }
        else {
            return {
                success: false,
                error: response.message || "Card payment initialization failed",
                transactionId: "",
                reference: "",
                flwRef: "",
                status: "failed",
                message: "Card payment initialization failed",
            };
        }
    }
    catch (error) {
        console.log("Card payment failed:", error.message);
        return {
            success: false,
            error: "Card payment processing failed: " + error.message,
            details: error.message,
            transactionId: "",
            reference: "",
            flwRef: "",
            status: "failed",
            message: "Card payment processing failed: " + error.message,
        };
    }
}
/**
 * Process Bank Transfer
 */
async function processBankTransfer({ amount, txRef, email, phoneNumber, currency = "RWF", clientIp = "127.0.0.1", deviceFingerprint = "62wd23423rq324323qew1", narration = "Order payment", }) {
    try {
        console.log(`Processing bank transfer: ${amount} ${currency} for ${email}`);
        const payload = {
            tx_ref: txRef,
            amount: amount.toString(),
            email: email,
            phone_number: phoneNumber,
            currency: currency,
            client_ip: clientIp,
            device_fingerprint: deviceFingerprint,
            narration: narration,
            is_permanent: false,
            expires: 3600, // 1 hour expiration
        };
        const response = await flw.Charge.bank_transfer(payload);
        console.log("Bank Transfer Response:", response);
        if (response.status === "success") {
            const transferDetails = response.meta?.authorization && {
                transferReference: response.meta.authorization.transfer_reference,
                transferAccount: response.meta.authorization.transfer_account,
                transferBank: response.meta.authorization.transfer_bank,
                transferAmount: parseFloat(response.meta.authorization.transfer_amount || "0"),
                transferNote: response.meta.authorization.transfer_note,
                accountExpiration: response.meta.authorization.account_expiration
                    ? new Date(response.meta.authorization.account_expiration)
                    : null,
            };
            return {
                success: true,
                transactionId: response.data?.flw_ref || txRef,
                reference: response.data?.tx_ref || txRef,
                flwRef: response.data?.flw_ref || txRef,
                status: response.data?.status || "pending",
                message: response.message || "Bank transfer initiated",
                transferDetails,
            };
        }
        else {
            return {
                success: false,
                transactionId: "",
                reference: "",
                flwRef: "",
                status: "failed",
                message: response.message || "Bank transfer initialization failed",
                error: response.message || "Bank transfer initialization failed",
            };
        }
    }
    catch (error) {
        console.log("Bank transfer failed:", error);
        return {
            success: false,
            transactionId: "",
            reference: "",
            flwRef: "",
            status: "failed",
            message: "Bank transfer initialization failed  " + error.message,
            error: "Bank transfer initialization failed  " + error.message,
        };
    }
}
