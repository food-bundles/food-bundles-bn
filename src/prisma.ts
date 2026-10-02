import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
dotenv.config();

const DATABASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.DATABASE_URL_PROD
    : process.env.DATABASE_URL_DEV;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;