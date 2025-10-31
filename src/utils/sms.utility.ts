require("dotenv").config();
const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const cleanPhoneNumber = (phone: string): string => {
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
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    const message = await twilio.messages.create({
      body: `Hello from FoodBundles! ${messageBody}`,
      from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
      to: cleanedPhone,
    });
    console.log("SMS sent successfully:", message);
    return message;
  } catch (error) {
    console.error("SMS sending failed:", error);
    throw error;
  }
}
