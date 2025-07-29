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
