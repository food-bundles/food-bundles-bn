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
    cleaned = "+2507" + cleaned.slice(2);
  } else if (cleaned.startsWith("2507")) {
    cleaned = "+2507" + cleaned.slice(4);
  }
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
  const message = await twilio.messages.create({
    body: `Hello from FoodBundles!\n\n${messageBody}\n\nBuy Now Here ${process.env.CLIENT_PRODUCTION_URL}`,
    from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
    to: cleanedPhone,
  });
  return message;
}

export async function sendMessage(messageBody: string, phoneNumber: string) {
  // Primary: Try Pindo first
  try {
    if (token) {
      const response = await sendViaPindo(messageBody, phoneNumber);
      console.log({ message: "SMS sent via Pindo", data: response });
      return response;
    } else {
      throw new Error("Pindo token not configured");
    }
  } catch (error: any) {
    console.log("Pindo failed, falling back to Twilio:", error.message);

    // Fallback: Try Twilio
    try {
      const response = await sendViaTwilio(messageBody, phoneNumber);
      console.log({
        message: "SMS sent via Twilio (fallback)",
        data: response,
      });
      return response;
    } catch (twilioError: any) {
      console.error("Both SMS providers failed:", twilioError);
      throw new Error(
        `SMS sending failed: Pindo - ${error.message}, Twilio - ${twilioError.message}`
      );
    }
  }
}
