require("dotenv").config();
const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Valid Rwanda mobile prefixes
const RWANDA_PREFIXES = ["078", "079", "072", "073"];
const RWANDA_COUNTRY_CODE = "250";

/**
 * Clean and format phone number to E.164 format for Twilio
 * Converts Rwanda phone numbers to +250XXXXXXXXX format
 */
export const cleanTwilioPhoneNumber = (phone: string): string => {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  // Remove + temporarily for processing
  cleaned = cleaned.replace(/\+/g, "");

  // Handle different input formats
  if (cleaned.startsWith("250")) {
    // Already has country code (250XXXXXXXXX)
    cleaned = cleaned.slice(3); // Remove country code for validation
  }

  // Now cleaned should be either 8 or 9 digits
  // Handle format: 78XXXXXXXX (9 digits) or 078XXXXXXXX (already has 0)
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1); // Remove leading 0
  }

  // Validate length (should be 9 digits now: 78XXXXXXXX)
  if (cleaned.length !== 9) {
    throw new Error(
      `Invalid phone number length. Expected 9 digits (78XXXXXXXX), got ${cleaned.length}. Original input may be malformed.`
    );
  }

  // Validate it starts with valid prefix (7X)
  const prefix = "0" + cleaned.substring(0, 2); // Reconstruct 07X format for validation
  if (!RWANDA_PREFIXES.some((p) => p === prefix)) {
    throw new Error(
      `Invalid Rwanda phone prefix. Number should start with ${RWANDA_PREFIXES.join(
        ", "
      )}`
    );
  }

  // Return in E.164 format: +2507XXXXXXXXX
  return `+${RWANDA_COUNTRY_CODE}${cleaned}`;
};

/**
 * Clean phone number to local Rwanda format (07XXXXXXXX)
 */
export const cleanPhoneNumber = (phone: string): string => {
  if (!phone) {
    throw new Error("Phone number is required");
  }

  // Remove all non-digit characters except leading +
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  // Remove + if present
  cleaned = cleaned.replace(/\+/g, "");

  // Handle country code format
  if (cleaned.startsWith("250")) {
    cleaned = "0" + cleaned.slice(3);
  } else if (!cleaned.startsWith("0")) {
    // If it doesn't start with 0 or 250, assume it's missing the 0
    cleaned = "0" + cleaned;
  }

  return cleaned;
};

/**
 * Validate Rwanda phone number
 */
export const isValidRwandaPhone = (phone: string): boolean => {
  try {
    const cleanPhone = cleanPhoneNumber(phone);

    // Check length (should be 10 digits: 07XXXXXXXX)
    if (cleanPhone.length !== 10) {
      return false;
    }

    // Check if it starts with a valid prefix
    return RWANDA_PREFIXES.some((prefix) => cleanPhone.startsWith(prefix));
  } catch (error) {
    return false;
  }
};

/**
 * Send SMS message with validation
 */
export async function sendMessage(messageBody: string, phoneNumber: string) {
  // Validate phone number first
  if (!isValidRwandaPhone(phoneNumber)) {
    throw new Error(`Invalid Rwanda phone number: ${phoneNumber}`);
  }

  // Format to E.164
  const formattedPhone = cleanTwilioPhoneNumber(phoneNumber);

  console.log(`Sending SMS to: ${formattedPhone}`);

  const message = await twilio.messages.create({
    body: `Greetings from Food Bundles Ltd!  
    ${messageBody}`,
    from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
    to: formattedPhone,
  });

  console.log("Message sent successfully", message.sid);
  return message;
}

/**
 * Make phone call with validation
 */
export async function makeCall(messageBody: string, phoneNumber: string) {
  // Validate phone number first
  if (!isValidRwandaPhone(phoneNumber)) {
    throw new Error(`Invalid Rwanda phone number: ${phoneNumber}`);
  }

  // Format to E.164
  const formattedPhone = cleanTwilioPhoneNumber(phoneNumber);

  console.log(`Making call to: ${formattedPhone}`);

  const call = await twilio.calls.create({
    twiml: `
      <Response>
        <Say>Hello from FoodBundles! ${messageBody}</Say>
        <Pause length='3'></Pause>
        <Say>Thank you for waiting</Say>
      </Response>
    `,
    from: process.env.TWILIO_TRIAL_PHONE_NUMBER,
    to: formattedPhone,
  });

  console.log("Call initiated successfully", call.sid);
  return call;
}
