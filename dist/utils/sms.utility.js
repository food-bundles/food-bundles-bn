"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanTwilioPhoneNumber = void 0;
exports.sendMessage = sendMessage;
exports.makeCall = makeCall;
require("dotenv").config();
const twilio = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
// Clean and format phone number for Rwanda
const cleanTwilioPhoneNumber = (phone) => {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, "");
    // Replace 07 or 2507 with +2507
    if (cleaned.startsWith("07")) {
        cleaned = "+2507" + cleaned.slice(2);
    }
    else if (cleaned.startsWith("2507")) {
        cleaned = "+2507" + cleaned.slice(4);
    }
    return cleaned;
};
exports.cleanTwilioPhoneNumber = cleanTwilioPhoneNumber;
async function sendMessage(messageBody, phoneNumber) {
    const message = await twilio.messages.create({
        body: `Hello from FoodBundles!  
    ${messageBody}`,
        from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
        to: process.env.TWILIO_SENDER_PHONE_NUMBER,
    });
}
async function makeCall(messageBody, phoneNumber) {
    const call = await twilio.calls.create({
        // url: 'link to a .mp3 file or TwiML .xml file',
        // method: 'get',
        twiml: `
            <Response>
                <Say>Hello from FoodBundles! ${messageBody}</Say>
                <Pause length='3'></Pause>
                <Say>Thank you for waiting</Say>
            </Response>
        `,
        from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
        to: process.env.TWILIO_SENDER_PHONE_NUMBER,
    });
    console.log(call);
}
