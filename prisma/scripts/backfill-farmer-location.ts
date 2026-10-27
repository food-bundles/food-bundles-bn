import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
});

interface SplitLocation {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
}

function splitLocation(location: string): SplitLocation | null {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length !== 5) return null;

  const [province, district, sector, cell, village] = parts;
  return { province, district, sector, cell, village };
}

async function main() {
  console.log("Backfilling Farmer location fields from:", DATABASE_URL);

  const farmers = await prisma.farmer.findMany({
    where: {
      location: { not: null },
      OR: [
        { province: null },
        { district: null },
        { sector: null },
        { cell: null },
        { village: null },
      ],
    },
    select: { id: true, location: true },
  });

  console.log(`Scanned ${farmers.length} farmer(s) needing backfill.`);

  let updated = 0;
  let skipped = 0;
  const skippedReasons: Array<{ id: string; location: string | null; reason: string }> = [];

  for (const farmer of farmers) {
    if (!farmer.location) {
      skipped++;
      skippedReasons.push({ id: farmer.id, location: farmer.location, reason: "empty location" });
      continue;
    }

    const split = splitLocation(farmer.location);
    if (!split) {
      skipped++;
      skippedReasons.push({
        id: farmer.id,
        location: farmer.location,
        reason: "did not split into exactly 5 non-empty parts",
      });
      continue;
    }

    await prisma.farmer.update({
      where: { id: farmer.id },
      data: {
        province: split.province,
        district: split.district,
        sector: split.sector,
        cell: split.cell,
        village: split.village,
        locationUpdatedAt: new Date(),
      },
    });
    updated++;
  }

  console.log("\n--- Backfill summary ---");
  console.log(`Scanned: ${farmers.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  if (skippedReasons.length > 0) {
    console.log("\nSkipped records:");
    for (const entry of skippedReasons) {
      console.log(`  farmerId=${entry.id} location=${JSON.stringify(entry.location)} reason=${entry.reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
