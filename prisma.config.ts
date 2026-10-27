import "dotenv/config";

const DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL;

export default {
  datasource: {
    url: DATABASE_URL,
  },
};
