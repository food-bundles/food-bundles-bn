import axios, { AxiosRequestConfig } from "axios";
require("dotenv").config();

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

export async function sendMessage(messageBody: string, phoneNumber: string) {
  try {
    const cleanedPhone = cleanSMSPhoneNumber(phoneNumber);

    const data = {
      to: cleanedPhone,
      text: `Hello from FoodBundles! ${messageBody}`,
      sender: process.env.SMS_SENDER_ID,
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

    axios(options)
      .then((response) => {
        console.log({ message: "SMS message sent", data: response.data });

        return response.data;
      })
      .catch((error) => {
        console.error("SMS sending failed:", error);
        throw error;
      });
  } catch (error) {
    console.error("SMS sending failed:", error);
    throw error;
  }
}
