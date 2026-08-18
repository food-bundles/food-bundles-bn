import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL as string,
  PORT: parseInt(process.env.PORT || "4000", 10),
  AT_USERNAME: process.env.AT_USERNAME as string,
  AT_API_KEY: process.env.AT_API_KEY as string,
  JWT_SECRET: process.env.JWT_SECRET || "qwertyuiopasdfghjklzxcvbnm1234567890",
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || "24h",
};

/**
 * Currencies supported on the Food Bundles platform.
 * These reflect the currencies already used across the application
 * (wallets and orders default to RWF; vouchers support RWF, USD and EUR).
 * Keep this list in sync with Flutterwave's enabled settlement currencies.
 */
export const SUPPORTED_CURRENCIES = ["RWF", "USD", "EUR"] as const;

export const DEFAULT_CURRENCY = "RWF";

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(currency);
}
