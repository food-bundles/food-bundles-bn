/**
 * Create the starting customer types (business types customers pick at signup).
 * Safe to run more than once: existing types are left untouched.
 *
 *   Local:       npm run seed:customer-types:dev
 *   Production:  npm run build && npm run seed:customer-types
 *
 * Optional: pass your own names
 *   npm run seed:customer-types:dev -- Restaurant Hotel School "Catering Company"
 *
 * The database comes from NODE_ENV (production → DATABASE_URL_PROD, otherwise
 * DATABASE_URL_DEV), same as the API server. More types can be added any time
 * in the dashboard: Stock → Customer Types.
 */
import prisma from "../prisma";

const DEFAULT_TYPES = ["Restaurant", "Hotel"];

async function main() {
  const target =
    process.env.NODE_ENV === "production" ? "PRODUCTION (DATABASE_URL_PROD)" : "DEVELOPMENT (DATABASE_URL_DEV)";
  console.log(`Database: ${target}`);

  const names = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const wanted = (names.length > 0 ? names : DEFAULT_TYPES).map((n) => n.trim()).filter(Boolean);

  for (const name of wanted) {
    // Names are unique ignoring case ("HOTEL" and "Hotel" are the same type)
    const existing = await prisma.customerType.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { name: true, isActive: true },
    });
    if (existing) {
      console.log(`• ${existing.name} already exists${existing.isActive ? "" : " (inactive)"}`);
      continue;
    }
    await prisma.customerType.create({ data: { name } });
    console.log(`✔ Created ${name}`);
  }
}

main()
  .catch((error) => {
    console.error("✖ Failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
