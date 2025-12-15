import axios, { AxiosRequestConfig } from "axios";
require("dotenv").config();

const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const token = process.env.SMS_API_TOKEN;

export const cleanSMSPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.startsWith("07")) {
    cleaned = "+250" + cleaned.slice(1);
  } else if (cleaned.startsWith("2507")) {
    cleaned = "+" + cleaned;
  } else if (cleaned.startsWith("250")) {
    cleaned = "+" + cleaned;
  } else if (!cleaned.startsWith("+")) {
    // If it doesn't start with + and doesn't match Rwanda patterns, assume it's a local number
    if (cleaned.length === 9 && cleaned.startsWith("7")) {
      cleaned = "+250" + cleaned;
    }
  }
  
  console.log(`Final cleaned phone number: ${cleaned}`);
  return cleaned;
};

async function sendViaPindo(messageBody: string, phoneNumber: string) {
  const cleanedPhone = cleanSMSPhoneNumber(phoneNumber);
  const data = {
    to: cleanedPhone,
    text: `Hello from FoodBundles! ${messageBody}\n\nBuy Now Here ${process.env.CLIENT_PRODUCTION_URL}`,
    sender: process.env.SMS_SENDER_ID || "INFO",
  };

  const options: AxiosRequestConfig = {
    method: "POST",
    url: "https://api.pindo.io/v1/sms/",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: data,
  };

  const response = await axios(options);
  return response.data;
}

async function sendViaTwilio(messageBody: string, phoneNumber: string) {
  const cleanedPhone = cleanSMSPhoneNumber(phoneNumber);
  
  try {
    const message = await twilio.messages.create({
      body: `Hello from FoodBundles!\n${messageBody}`,
      from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
      to: cleanedPhone,
    });
    return message;
  } catch (error: any) {
    console.error('Twilio error details:', {
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo,
      status: error.status
    });
    throw error;
  }
}

export async function sendMessage(messageBody: string, phoneNumber: string) {
  
  // If Pindo is configured, try it first
  if (token) {
    try {
      const response = await sendViaPindo(messageBody, phoneNumber);
      console.log({ message: "SMS sent via Pindo", data: response });
      return response;
    } catch (error: any) {
      console.log("Pindo failed, falling back to Twilio:", error.message);
    }
  } else {
    console.log("Pindo not configured, using Twilio directly");
  }

  try {
    const response = await sendViaTwilio(messageBody, phoneNumber);
    console.log({
      message: token ? "SMS sent via Twilio (fallback)" : "SMS sent via Twilio (primary)",
      data: response,
    });
    return response;
  } catch (twilioError: any) {
    console.error("Twilio SMS failed:", twilioError);
    throw new Error(
      `SMS sending failed: ${twilioError.message}`
    );
  }
}
