/**
 * Create (or promote) a super admin account. Safe to run more than once.
 *
 *   Local:       npx ts-node src/scripts/create-superadmin.ts
 *   Production:  npm run build && node dist/scripts/create-superadmin.js
 *
 * Options (all optional):
 *   --email=you@example.com   default: SUPERADMIN_EMAIL env or supperadmin@food.rw
 *   --password=Secret123!     default: SUPERADMIN_PASSWORD env or Test@12345
 *   --name="Super Admin"      username for a new account
 *   --reset-password          also set the password if the account already exists
 *
 * The database comes from NODE_ENV (production → DATABASE_URL_PROD, otherwise
 * DATABASE_URL_DEV), same as the API server.
 */
import prisma from "../prisma";
import { hashPassword } from "../utils/password";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const email = (arg("email") || process.env.SUPERADMIN_EMAIL || "supperadmin@food.rw")
  .trim()
  .toLowerCase();
const password = arg("password") || process.env.SUPERADMIN_PASSWORD || "Test@12345";
const username = arg("name") || "Super Admin";
const resetPassword = process.argv.includes("--reset-password");

async function main() {
  const target =
    process.env.NODE_ENV === "production" ? "PRODUCTION (DATABASE_URL_PROD)" : "DEVELOPMENT (DATABASE_URL_DEV)";
  console.log(`Database: ${target}`);

  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  // The email must not belong to a restaurant, farmer or affiliator
  const [restaurant, farmer, affiliator] = await Promise.all([
    prisma.restaurant.findFirst({ where: { email }, select: { id: true } }),
    prisma.farmer.findFirst({ where: { email }, select: { id: true } }),
    prisma.affiliator.findFirst({ where: { email }, select: { id: true } }),
  ]);
  if (restaurant || farmer || affiliator) {
    throw new Error(`${email} is already used by a non-admin account`);
  }

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    await prisma.admin.update({
      where: { email },
      data: {
        role: "SUPERUSER",
        ...(resetPassword && { password: await hashPassword(password) }),
      },
    });
    console.log(
      `✔ ${email} is now a super admin` +
        (resetPassword ? " (password reset)" : " (password unchanged — add --reset-password to set it)"),
    );
    return;
  }

  await prisma.admin.create({
    data: {
      email,
      username,
      password: await hashPassword(password),
      role: "SUPERUSER",
      agreed: true,
    },
  });
  console.log(`✔ Super admin created: ${email}`);
  console.log("  Log in and change this password right away if this is production.");
}

main()
  .catch((error) => {
    console.error("✖ Failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
