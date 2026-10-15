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

export const getDeliverySettings = async (): Promise<DeliveryFeeSettings> => {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  return { ...DEFAULT_DELIVERY_SETTINGS, ...((row?.value as Partial<DeliveryFeeSettings>) ?? {}) };
};

export const updateDeliverySettings = async (
  input: Partial<DeliveryFeeSettings>,
  adminId?: string,
): Promise<DeliveryFeeSettings> => {
  const current = await getDeliverySettings();
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

  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: next as any, updatedBy: adminId ?? null },
    create: { key: SETTINGS_KEY, value: next as any, updatedBy: adminId ?? null },
  });
  return next;
};

/** Delete the saved settings: back to the defaults (fee on, 5,000 / 150,000 / next day). */
export const resetDeliverySettings = async (): Promise<DeliveryFeeSettings> => {
  await prisma.appSetting.deleteMany({ where: { key: SETTINGS_KEY } });
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
