import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_DEV,
    },
  },
});

const PASSWORD = "Test@12345";

async function main() {
  console.log("🌱 Seeding development database:", process.env.DATABASE_URL_DEV);

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // Admin
  await prisma.admin.upsert({
    where: { email: "admin@food.rw" },
    update: {},
    create: {
      username: "Admin",
      email: "admin@food.rw",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin created: admin@food.rw");

  // Superuser
  await prisma.admin.upsert({
    where: { email: "superuser@food.rw" },
    update: {},
    create: {
      username: "Superuser",
      email: "superuser@food.rw",
      password: hashedPassword,
      role: "SUPERUSER",
    },
  });
  console.log("✅ Superuser created: superuser@food.rw");

  // Trader
  await prisma.admin.upsert({
    where: { email: "trader@food.rw" },
    update: {},
    create: {
      username: "Trader",
      email: "trader@food.rw",
      password: hashedPassword,
      role: "TRADER",
    },
  });
  console.log("✅ Trader created: trader@food.rw");

  // Logistics
  await prisma.admin.upsert({
    where: { email: "logistics@food.rw" },
    update: {},
    create: {
      username: "Logistics",
      email: "logistics@food.rw",
      password: hashedPassword,
      role: "LOGISTICS",
    },
  });
  console.log("✅ Logistics created: logistics@food.rw");

  // Aggregator
  await prisma.admin.upsert({
    where: { email: "aggregator@food.rw" },
    update: {},
    create: {
      username: "Aggregator",
      email: "aggregator@food.rw",
      password: hashedPassword,
      role: "AGGREGATOR",
    },
  });
  console.log("✅ Aggregator created: aggregator@food.rw");

  // Farmer
  await prisma.farmer.upsert({
    where: { email: "farmer@food.rw" },
    update: {},
    create: {
      name: "Farmer",
      email: "farmer@food.rw",
      phone: "0780000001",
      password: hashedPassword,
      role: "FARMER",
    },
  });
  console.log("✅ Farmer created: farmer@food.rw");

  // Restaurant
  await prisma.restaurant.upsert({
    where: { email: "restaurant@food.rw" },
    update: {},
    create: {
      name: "Restaurant",
      email: "restaurant@food.rw",
      phone: "0780000002",
      tin: "000000000",
      password: hashedPassword,
      role: "RESTAURANT",
      verified: true,
      agreed: true,
    },
  });
  console.log("✅ Restaurant created: restaurant@food.rw");

  // Affiliator needs a restaurant first — use the one above
  const restaurant = await prisma.restaurant.findUnique({
    where: { email: "restaurant@food.rw" },
  });

  await prisma.affiliator.upsert({
    where: { email: "affiliator@food.rw" },
    update: {},
    create: {
      name: "Affiliator",
      email: "affiliator@food.rw",
      phone: "0780000003",
      password: hashedPassword,
      role: "AFFILIATOR",
      restaurantId: restaurant!.id,
    },
  });
  console.log("✅ Affiliator created: affiliator@food.rw");

  console.log("\n🎉 Seeding complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("All users password: Test@12345");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("admin@food.rw        → ADMIN");
  console.log("superuser@food.rw    → SUPERUSER");
  console.log("trader@food.rw       → TRADER");
  console.log("logistics@food.rw    → LOGISTICS");
  console.log("aggregator@food.rw   → AGGREGATOR");
  console.log("farmer@food.rw       → FARMER");
  console.log("restaurant@food.rw   → RESTAURANT");
  console.log("affiliator@food.rw   → AFFILIATOR");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
