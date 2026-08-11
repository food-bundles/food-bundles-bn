import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL_DEV;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
