import prisma from "../prisma";
import { SubscriptionStatus } from "@prisma/client";

/**
 * Delivery fee rules (admin-editable in the dashboard: Settings → Delivery Fees).
 *
 * The fee is charged when EITHER is true:
 *   - the order amount is below `freeDeliveryMinOrder`, or
 *   - delivery is wanted sooner than `freeDeliveryMinDaysAhead` days after the
 *     order is placed (0 = same day, 1 = next day, 2 = two days later…).
 * Otherwise delivery is free. A subscription plan with free delivery always wins.
 *
 * Example with the defaults (5,000 / 150,000 / next day):
 *   same-day delivery           → 5,000 whatever the amount
 *   next day or later, < 150k   → 5,000
 *   next day or later, ≥ 150k   → free
 */
export interface DeliveryFeeSettings {
  /** Off = delivery is free for every order (saved values are kept) */
  enabled: boolean;
  deliveryFee: number;
  freeDeliveryMinOrder: number;
  freeDeliveryMinDaysAhead: number;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliveryFeeSettings = {
  enabled: true,
  deliveryFee: 5000,
  freeDeliveryMinOrder: 150000,
  freeDeliveryMinDaysAhead: 1,
};

const SETTINGS_KEY = "delivery_fee";
// Calendar days are counted in Rwanda time, not the server's time zone
const BUSINESS_TIME_ZONE = "Africa/Kigali";

/**
 * Stored setting: the default rules plus optional rules per customer type
 * (schools, hotels…). A customer type without its own rules pays the default.
 */
interface StoredDeliveryConfig extends DeliveryFeeSettings {
  byCustomerType?: Record<string, DeliveryFeeSettings>;
}

const pickRules = (value: Partial<DeliveryFeeSettings> | undefined): DeliveryFeeSettings => ({
  enabled: value?.enabled ?? DEFAULT_DELIVERY_SETTINGS.enabled,
  deliveryFee: value?.deliveryFee ?? DEFAULT_DELIVERY_SETTINGS.deliveryFee,
  freeDeliveryMinOrder: value?.freeDeliveryMinOrder ?? DEFAULT_DELIVERY_SETTINGS.freeDeliveryMinOrder,
  freeDeliveryMinDaysAhead: value?.freeDeliveryMinDaysAhead ?? DEFAULT_DELIVERY_SETTINGS.freeDeliveryMinDaysAhead,
});

/** Default rules and the customer types that have their own. */
export const getDeliveryConfig = async () => {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const stored = (row?.value as StoredDeliveryConfig | null) ?? null;
  const byCustomerType: Record<string, DeliveryFeeSettings> = {};
  for (const [id, rules] of Object.entries(stored?.byCustomerType ?? {})) {
    byCustomerType[id] = pickRules(rules);
  }
  return { default: pickRules(stored ?? undefined), byCustomerType };
};

const saveDeliveryConfig = async (
  config: { default: DeliveryFeeSettings; byCustomerType: Record<string, DeliveryFeeSettings> },
  adminId?: string,
) => {
  const value = { ...config.default, byCustomerType: config.byCustomerType } as any;
  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value, updatedBy: adminId ?? null },
    create: { key: SETTINGS_KEY, value, updatedBy: adminId ?? null },
  });
};

/** Default rules (customers whose type has no rules of its own). */
export const getDeliverySettings = async (): Promise<DeliveryFeeSettings> =>
  (await getDeliveryConfig()).default;

/** Rules for a customer of this type: its own rules, else the default. */
export const getDeliverySettingsFor = async (
  customerTypeId?: string | null,
): Promise<DeliveryFeeSettings> => {
  const config = await getDeliveryConfig();
  return (customerTypeId && config.byCustomerType[customerTypeId]) || config.default;
};

/** Rules for a customer (by restaurant id), following their customer type. */
export const getDeliverySettingsForCustomer = async (restaurantId: string) => {
  const customer = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { customerTypeId: true },
  });
  return getDeliverySettingsFor(customer?.customerTypeId);
};

/**
 * Update the default rules, or one customer type's own rules when
 * customerTypeId is given (starting from what that type pays today).
 */
export const updateDeliverySettings = async (
  input: Partial<DeliveryFeeSettings>,
  adminId?: string,
  customerTypeId?: string,
): Promise<DeliveryFeeSettings> => {
  const config = await getDeliveryConfig();
  if (customerTypeId) {
    const type = await prisma.customerType.findUnique({ where: { id: customerTypeId }, select: { id: true } });
    if (!type) throw new Error("Customer type not found");
  }
  const current = customerTypeId
    ? config.byCustomerType[customerTypeId] ?? config.default
    : config.default;
  const next: DeliveryFeeSettings = { ...current };

  const asWholeNumber = (value: unknown, field: string, max = Number.MAX_SAFE_INTEGER) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > max || Math.floor(n) !== n) {
      throw new Error(`${field} must be a whole number between 0 and ${max.toLocaleString()}`);
    }
    return n;
  };

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") throw new Error("enabled must be true or false");
    next.enabled = input.enabled;
  }
  if (input.deliveryFee !== undefined) {
    next.deliveryFee = asWholeNumber(input.deliveryFee, "Delivery fee");
  }
  if (input.freeDeliveryMinOrder !== undefined) {
    next.freeDeliveryMinOrder = asWholeNumber(input.freeDeliveryMinOrder, "Free delivery minimum order");
  }
  if (input.freeDeliveryMinDaysAhead !== undefined) {
    next.freeDeliveryMinDaysAhead = asWholeNumber(input.freeDeliveryMinDaysAhead, "Free delivery timing", 30);
  }

  if (customerTypeId) config.byCustomerType[customerTypeId] = next;
  else config.default = next;
  await saveDeliveryConfig(config, adminId);
  return next;
};

/** A customer type goes back to paying the default rules. */
export const removeCustomerTypeDeliverySettings = async (customerTypeId: string, adminId?: string) => {
  const config = await getDeliveryConfig();
  delete config.byCustomerType[customerTypeId];
  await saveDeliveryConfig(config, adminId);
  return config;
};

/**
 * Default rules back to the defaults (fee on, 5,000 / 150,000 / next day).
 * Customer types with their own rules keep them.
 */
export const resetDeliverySettings = async (): Promise<DeliveryFeeSettings> => {
  const config = await getDeliveryConfig();
  if (Object.keys(config.byCustomerType).length === 0) {
    await prisma.appSetting.deleteMany({ where: { key: SETTINGS_KEY } });
  } else {
    await saveDeliveryConfig({ default: { ...DEFAULT_DELIVERY_SETTINGS }, byCustomerType: config.byCustomerType });
  }
  return { ...DEFAULT_DELIVERY_SETTINGS };
};

// YYYY-MM-DD of a moment, in Rwanda time
const businessDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

/** Whole calendar days between when the order is placed and when it should arrive (never negative). */
export const daysAhead = (placedAt: Date, requestedDelivery?: Date | null) => {
  if (!requestedDelivery || Number.isNaN(requestedDelivery.getTime())) return 0;
  const diff =
    (Date.parse(businessDay(requestedDelivery)) - Date.parse(businessDay(placedAt))) / 86_400_000;
  return Math.max(0, Math.round(diff));
};

export const calculateDeliveryFee = (params: {
  orderAmount: number; // products total (after promo, before fees)
  placedAt: Date;
  requestedDelivery?: Date | null; // missing → treated as same day
  hasFreeDeliveryPlan: boolean;
  settings: DeliveryFeeSettings;
}): number => {
  const { orderAmount, placedAt, requestedDelivery, hasFreeDeliveryPlan, settings } = params;
  if (hasFreeDeliveryPlan || !settings.enabled) return 0;
  const tooSmall = orderAmount < settings.freeDeliveryMinOrder;
  const tooSoon = daysAhead(placedAt, requestedDelivery) < settings.freeDeliveryMinDaysAhead;
  return tooSmall || tooSoon ? settings.deliveryFee : 0;
};

/** True when the restaurant's active subscription plan includes free delivery. */
export const hasFreeDeliveryPlan = async (restaurantId: string) => {
  const subscription = await prisma.restaurantSubscription.findFirst({
    where: {
      restaurantId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: new Date() },
    },
    select: { plan: { select: { freeDelivery: true } } },
  });
  return !!subscription?.plan?.freeDelivery;
};
