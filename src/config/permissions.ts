/**
 * Dashboard permission catalog — the single source of truth.
 *
 * Every dashboard feature is a module with its own list of actions. A
 * permission key is `<module>.<action>`, e.g. "orders.update_payment_status".
 * Every module has a `view` action (open the page, read data); any other action
 * implies `view`.
 *
 * Roles (AdminRole rows) store lists of these keys. Adding a feature or an
 * action = add it here; the "Administrator" system role picks it up
 * automatically on the next server start (see ensureSystemRoles).
 *
 * Legacy keys: roles saved before actions existed hold `<module>.manage`. It is
 * expanded to every action of that module (see normalizePermissions), so no one
 * loses access.
 */

type ActionDef = { key: string; label: string };

const VIEW: ActionDef = { key: "view", label: "View" };
const CREATE: ActionDef = { key: "create", label: "Create" };
const EDIT: ActionDef = { key: "edit", label: "Edit" };
const DELETE: ActionDef = { key: "delete", label: "Delete" };
const CHANGE_STATUS: ActionDef = { key: "change_status", label: "Activate / deactivate" };
const EXPORT: ActionDef = { key: "export", label: "Export" };

const crud = (...extra: ActionDef[]): ActionDef[] => [VIEW, CREATE, EDIT, DELETE, ...extra];

export const PERMISSION_MODULES = [
  // General
  { key: "dashboard", label: "Dashboard statistics", group: "General", actions: [VIEW] },

  // Farmers & supply
  {
    key: "farmer_submissions",
    label: "Farmer submissions",
    group: "Farmers & supply",
    actions: [
      VIEW,
      { key: "create", label: "Create on behalf of a farmer" },
      { key: "approve", label: "Approve / send counter offer" },
      { key: "set_price", label: "Set price (change the Food Bundles price)" },
      { key: "verify", label: "Verify face to face (record quantity)" },
      { key: "edit", label: "Edit / clear a submission" },
      { key: "reject", label: "Reject" },
      { key: "reverse_status", label: "Move status back" },
      { key: "force_complete", label: "Force complete" },
      { key: "create_product", label: "Create product from submission" },
      { key: "update_stock", label: "Add to product stock" },
      { key: "request_payout", label: "Pay farmer (MoMo or cash)" },
      { key: "confirm_payout", label: "Confirm payout" },
      DELETE,
      EXPORT,
    ],
  },
  {
    key: "farmers",
    label: "Farmers",
    group: "Farmers & supply",
    actions: [VIEW, { key: "create", label: "Register farmers" }, EDIT, DELETE, EXPORT],
  },

  // Orders & delivery
  {
    key: "orders",
    label: "Restaurant orders",
    group: "Orders & delivery",
    actions: [
      VIEW,
      { key: "create", label: "Create order for a restaurant" },
      { key: "edit", label: "Edit order items" },
      { key: "update_status", label: "Update order status" },
      { key: "update_payment_status", label: "Update payment status" },
      { key: "send_payment_link", label: "Send payment link" },
      { key: "generate_invoice", label: "Generate EBM invoice" },
      { key: "cancel", label: "Cancel orders" },
      DELETE,
      EXPORT,
    ],
  },
  {
    key: "deliveries",
    label: "Deliveries",
    group: "Orders & delivery",
    actions: [
      VIEW,
      { key: "update_status", label: "Update delivery status" },
      { key: "confirm_delivery", label: "Confirm delivery (customer OTP)" },
    ],
  },
  {
    key: "delivery_settings",
    label: "Delivery fees",
    group: "Orders & delivery",
    actions: [VIEW, EDIT, { key: "reset", label: "Reset to defaults" }],
  },

  // Stock
  { key: "products", label: "Products", group: "Stock", actions: crud(CHANGE_STATUS, EXPORT) },
  { key: "categories", label: "Categories", group: "Stock", actions: crud(CHANGE_STATUS) },
  { key: "units", label: "Units", group: "Stock", actions: crud(CHANGE_STATUS) },
  { key: "payment_methods", label: "Payment methods", group: "Stock", actions: crud(CHANGE_STATUS) },
  {
    key: "customer_types",
    label: "Customer types",
    group: "Stock",
    actions: crud(
      CHANGE_STATUS,
      { key: "assign", label: "Assign to restaurants" },
      { key: "swap_pricing", label: "Swap pricing" },
    ),
  },
  { key: "sales_reports", label: "Sales reports", group: "Stock", actions: [VIEW, EXPORT] },

  // Finance
  {
    key: "subscriptions",
    label: "Subscriptions",
    group: "Finance",
    actions: [
      VIEW,
      { key: "create_plan", label: "Create plans" },
      { key: "edit_plan", label: "Edit plans" },
      { key: "delete_plan", label: "Delete plans" },
      { key: "assign", label: "Subscribe a restaurant" },
      { key: "check_expired", label: "Run expiry check" },
      EXPORT,
    ],
  },
  {
    key: "loan_access",
    label: "Loan access",
    group: "Finance",
    actions: [
      VIEW,
      { key: "approve", label: "Approve requests" },
      { key: "reject", label: "Reject requests" },
      { key: "enable_disable", label: "Enable / disable access" },
      { key: "manage_providers", label: "Manage loan providers" },
      { key: "manage_traders", label: "Manage loan traders (fees, policies)" },
    ],
  },
  {
    key: "vouchers",
    label: "Voucher management",
    group: "Finance",
    actions: [
      VIEW,
      CREATE,
      EDIT,
      DELETE,
      { key: "approve_sessions", label: "Approve / reject voucher sessions" },
      { key: "approve_loans", label: "Approve / reject loan applications" },
      { key: "disburse", label: "Disburse loans" },
      { key: "issue_cards", label: "Issue voucher cards" },
      { key: "approve_kyc", label: "Approve / reject card KYC" },
      { key: "admin_repay", label: "Repay a voucher for a restaurant" },
      { key: "penalties", label: "Calculate / waive penalties" },
      { key: "send_reminders", label: "Send repayment reminders" },
      { key: "process_existing", label: "Process existing vouchers" },
      EXPORT,
    ],
  },
  {
    key: "deposits",
    label: "Deposits & wallets",
    group: "Finance",
    actions: [
      VIEW,
      { key: "admin_deposit", label: "Deposit for a customer" },
      { key: "adjust_wallet", label: "Adjust wallet balance" },
      { key: "edit_wallet", label: "Edit wallet settings" },
      { key: "transfer", label: "Transfer between wallets" },
      EXPORT,
    ],
  },
  {
    key: "traders",
    label: "Traders",
    group: "Finance",
    actions: [
      VIEW,
      { key: "approve_withdrawals", label: "Approve withdrawals" },
      { key: "complete_withdrawals", label: "Complete withdrawals" },
      { key: "manage_commission", label: "Set commission" },
      { key: "process_commission", label: "Process commission payouts" },
      { key: "manage_delegations", label: "Approve / revoke delegations" },
      { key: "approve_loans", label: "Approve trader loans" },
    ],
  },
  {
    key: "promo_codes",
    label: "Promo codes",
    group: "Finance",
    actions: crud({ key: "manage_restaurants", label: "Include / exclude restaurants" }),
  },

  // Markets
  {
    key: "markets",
    label: "Markets & prices",
    group: "Markets",
    actions: [
      VIEW,
      { key: "create", label: "Create markets" },
      { key: "edit", label: "Edit markets" },
      { key: "delete", label: "Delete markets" },
      { key: "update_prices", label: "Add / edit prices" },
      { key: "delete_prices", label: "Delete prices" },
      { key: "upload_wfp", label: "Upload WFP price list" },
      { key: "clear_wfp", label: "Clear WFP prices" },
      { key: "send_price_update", label: "Send price update notifications" },
      EXPORT,
    ],
  },
  { key: "intelligence", label: "Intelligence reports", group: "Markets", actions: [VIEW] },

  // Users
  {
    key: "restaurant_kyc",
    label: "Restaurant KYC",
    group: "Users",
    actions: [VIEW, { key: "review", label: "Approve / reject KYC" }],
  },
  { key: "user_lookup", label: "User lookup", group: "Users", actions: [VIEW] },
  { key: "restaurants", label: "Restaurants", group: "Users", actions: crud(EXPORT) },
  { key: "affiliators", label: "Affiliators", group: "Users", actions: [VIEW, EDIT, DELETE, EXPORT] },
  { key: "admins", label: "Administration (team accounts)", group: "Users", actions: crud(EXPORT) },
  {
    key: "invitations",
    label: "Invitations",
    group: "Users",
    actions: [VIEW, CREATE, { key: "resend", label: "Resend" }, DELETE],
  },

  // Communication
  {
    key: "newsletter",
    label: "Newsletter",
    group: "Communication",
    actions: crud({ key: "send", label: "Send campaigns" }),
  },
  {
    key: "messages",
    label: "Messages & support",
    group: "Communication",
    actions: [VIEW, { key: "respond", label: "Respond" }, DELETE],
  },
  {
    key: "sms_recipients",
    label: "SMS recipients & notifications",
    group: "Communication",
    actions: [VIEW, CREATE, EDIT, DELETE],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  group: string;
  actions: ReadonlyArray<ActionDef>;
}>;

type ModuleDef = (typeof PERMISSION_MODULES)[number];
export type PermissionModule = ModuleDef["key"];
export type Permission = {
  [M in ModuleDef as M["key"]]: `${M["key"]}.${M["actions"][number]["key"]}`;
}[PermissionModule];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a.key}` as Permission),
);

const VALID = new Set<string>(ALL_PERMISSIONS);

export const isValidPermission = (key: string): key is Permission => VALID.has(key);

/** Every permission of one module, e.g. all "orders.*" keys. */
export const modulePermissions = (module: string): Permission[] =>
  ALL_PERMISSIONS.filter((p) => p.startsWith(`${module}.`));

// Modules split out of older ones: a role that had the old module keeps the
// same access on the new one (loan access was under "subscriptions" and
// "vouchers"; traders were under "deposits").
const LEGACY_MODULE_SPLITS: Record<string, string[]> = {
  subscriptions: ["loan_access"],
  vouchers: ["loan_access"],
  deposits: ["traders"],
};

/**
 * Keep only known keys; expand legacy `<module>.manage` to every action of the
 * module; add `<module>.view` for any other action (actions imply view).
 */
export const normalizePermissions = (keys: string[]): Permission[] => {
  const result = new Set<Permission>();
  for (const key of keys) {
    const [module, action] = key.split(".");
    if (action === "manage") {
      for (const m of [module, ...(LEGACY_MODULE_SPLITS[module] || [])]) {
        modulePermissions(m).forEach((p) => result.add(p));
      }
      continue;
    }
    if (!isValidPermission(key)) continue;
    result.add(key);
    if (action !== "view") result.add(`${module}.view` as Permission);
    // Legacy view of a split module carries over too
    if (action === "view") {
      for (const m of LEGACY_MODULE_SPLITS[module] || []) {
        if (isValidPermission(`${m}.view`)) result.add(`${m}.view` as Permission);
      }
    }
  }
  return ALL_PERMISSIONS.filter((p) => result.has(p));
};

/**
 * Office roles with full data scope on the dashboard (they see every order,
 * every submission…). Business logic uses this to decide data scope.
 */
export const DASHBOARD_ROLES = ["ADMIN", "SUPERUSER", "STAFF", "MARKET_PRICES"] as const;

export const isDashboardRole = (role?: string | null) =>
  !!role && (DASHBOARD_ROLES as readonly string[]).includes(role);

/**
 * Field roles that also sign in to the dashboard, but only see their own data
 * (an aggregator sees the submissions assigned to them). What they can open
 * and do is decided by their role's permissions, like everyone else.
 */
export const FIELD_ROLES = ["AGGREGATOR", "LOGISTICS"] as const;

/** Everyone who signs in to /dashboard and is governed by permissions. */
export const hasDashboardAccess = (role?: string | null) =>
  isDashboardRole(role) || (!!role && (FIELD_ROLES as readonly string[]).includes(role));

// What field roles could already do before they moved into the dashboard;
// their default roles start from exactly this so nobody loses access.
const FIELD_SHARED = [
  "products.view",
  "categories.view",
  "units.view",
  "payment_methods.view",
  "markets.view",
  "markets.create",
  "markets.edit",
  "markets.update_prices",
  "markets.upload_wfp",
  "markets.send_price_update",
  "markets.export",
];

/** System roles created/kept in sync at startup. */
export const SYSTEM_ROLES = {
  ADMINISTRATOR: {
    name: "Administrator",
    description: "Full access to every dashboard feature (default for existing admins).",
    permissions: ALL_PERMISSIONS,
    userRole: "ADMIN",
  },
  MARKET_PRICES_MANAGER: {
    name: "Market Prices Manager",
    description: "Manages market prices only (default for existing market price users).",
    permissions: modulePermissions("markets"),
    userRole: "MARKET_PRICES",
  },
  AGGREGATOR: {
    name: "Aggregator",
    description:
      "Field aggregator: verifies the farmer submissions assigned to them and registers farmers.",
    permissions: normalizePermissions([
      "farmer_submissions.view",
      "farmer_submissions.approve",
      "farmer_submissions.verify",
      "farmer_submissions.edit",
      "farmer_submissions.request_payout",
      "farmers.create",
      ...FIELD_SHARED,
    ]),
    userRole: "AGGREGATOR",
  },
  LOGISTICS: {
    name: "Logistics",
    description: "Delivery team: sees orders to deliver, updates delivery status and confirms delivery.",
    permissions: normalizePermissions([
      "deliveries.view",
      "deliveries.update_status",
      "deliveries.confirm_delivery",
      "orders.create",
      ...FIELD_SHARED,
    ]),
    userRole: "LOGISTICS",
  },
} as const;

/** Account role (Role enum) a system role maps to; custom roles map to STAFF. */
export const userRoleForAdminRole = (roleName: string): string => {
  const system = Object.values(SYSTEM_ROLES).find((r) => r.name === roleName);
  return system ? system.userRole : "STAFF";
};
