/**
 * Dashboard permission catalog — the single source of truth.
 *
 * Every dashboard feature (one per admin sidebar item) is a module with two
 * permissions: `<module>.view` (open the page, read data) and `<module>.manage`
 * (create / edit / delete). `manage` implies `view`.
 *
 * Roles (AdminRole rows) store lists of these keys. Adding a feature = add a
 * module here; the "Administrator" system role picks it up automatically on
 * the next server start (see ensureSystemRoles).
 */

export const PERMISSION_MODULES = [
  { key: "dashboard", label: "Dashboard statistics", group: "General" },
  { key: "farmer_submissions", label: "Farmer submissions", group: "Operations" },
  { key: "orders", label: "Restaurant orders", group: "Operations" },
  { key: "products", label: "Products", group: "Stock" },
  { key: "categories", label: "Categories", group: "Stock" },
  { key: "units", label: "Units", group: "Stock" },
  { key: "payment_methods", label: "Payment methods", group: "Stock" },
  { key: "customer_types", label: "Customer types", group: "Stock" },
  { key: "sales_reports", label: "Sales reports", group: "Stock" },
  { key: "subscriptions", label: "Subscriptions & loan access", group: "Finance" },
  { key: "vouchers", label: "Voucher management", group: "Finance" },
  { key: "deposits", label: "Deposits, wallets & traders", group: "Finance" },
  { key: "promo_codes", label: "Promo codes", group: "Finance" },
  { key: "markets", label: "Market prices", group: "Markets" },
  { key: "intelligence", label: "Intelligence reports", group: "Markets" },
  { key: "restaurant_kyc", label: "Restaurant KYC", group: "Users" },
  { key: "user_lookup", label: "User lookup", group: "Users" },
  { key: "farmers", label: "Farmers", group: "Users" },
  { key: "restaurants", label: "Restaurants", group: "Users" },
  { key: "affiliators", label: "Affiliators", group: "Users" },
  { key: "admins", label: "Administration (admin users)", group: "Users" },
  { key: "invitations", label: "Invitations", group: "Users" },
  { key: "newsletter", label: "Newsletter", group: "Communication" },
  { key: "messages", label: "Messages & support", group: "Communication" },
  { key: "sms_recipients", label: "SMS recipients & notifications", group: "Communication" },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];
export type PermissionAction = "view" | "manage";
export type Permission = `${PermissionModule}.${PermissionAction}`;

export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap((m) => [
  `${m.key}.view` as Permission,
  `${m.key}.manage` as Permission,
]);

const VALID = new Set<string>(ALL_PERMISSIONS);

export const isValidPermission = (key: string): key is Permission => VALID.has(key);

/** Keep only known keys, and add `.view` for every `.manage` (manage implies view). */
export const normalizePermissions = (keys: string[]): Permission[] => {
  const result = new Set<Permission>();
  for (const key of keys) {
    if (!isValidPermission(key)) continue;
    result.add(key);
    if (key.endsWith(".manage")) {
      result.add(key.replace(/\.manage$/, ".view") as Permission);
    }
  }
  return ALL_PERMISSIONS.filter((p) => result.has(p));
};

/** Roles that sign in to the admin dashboard (as opposed to their own apps). */
export const DASHBOARD_ROLES = ["ADMIN", "SUPERUSER", "STAFF", "MARKET_PRICES"] as const;

export const isDashboardRole = (role?: string | null) =>
  !!role && (DASHBOARD_ROLES as readonly string[]).includes(role);

/** System roles created/kept in sync at startup. */
export const SYSTEM_ROLES = {
  ADMINISTRATOR: {
    name: "Administrator",
    description: "Full access to every dashboard feature (default for existing admins).",
    permissions: ALL_PERMISSIONS,
  },
  MARKET_PRICES_MANAGER: {
    name: "Market Prices Manager",
    description: "Manages market prices only (default for existing market price users).",
    permissions: ["markets.view", "markets.manage"] as Permission[],
  },
} as const;
