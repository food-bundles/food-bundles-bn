import prisma from "../prisma";

export const FARMER_LANGUAGES = ["KINY", "ENG", "FRE"] as const;
export type FarmerLanguage = (typeof FARMER_LANGUAGES)[number];

export interface FarmerPreferences {
  smsNotifications: boolean;
  preferredLanguage: string | null;
  phoneVerified: boolean;
}

const preferenceSelect = {
  smsNotifications: true,
  preferredLanguage: true,
  phoneVerified: true,
} as const;

export async function getFarmerPreferences(
  farmerId: string
): Promise<FarmerPreferences | null> {
  return prisma.farmer.findUnique({
    where: { id: farmerId },
    select: preferenceSelect,
  });
}

export async function updateFarmerPreferences(
  farmerId: string,
  changes: { smsNotifications?: boolean; preferredLanguage?: FarmerLanguage }
): Promise<FarmerPreferences> {
  return prisma.farmer.update({
    where: { id: farmerId },
    data: changes,
    select: preferenceSelect,
  });
}

// Local mobile numbers payouts accept: 072 / 073 (Airtel) and 078 / 079 (MTN), 10 digits
const RW_MOBILE = /^07[2389]\d{7}$/;

export class PhoneUpdateError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

/**
 * Lets a farmer who signed up with an email add a phone number later (needed for payouts).
 * Only works while the account has no phone; changing an existing phone is a login change
 * and goes through support. The number must not belong to any other account.
 */
export async function addFarmerPhone(
  farmerId: string,
  rawPhone: string
): Promise<{ phone: string; phoneVerified: boolean }> {
  let digits = String(rawPhone ?? "").replace(/\D/g, "");
  if (digits.startsWith("250")) digits = digits.slice(3);
  const phone = `0${digits.replace(/^0+/, "")}`;
  if (!RW_MOBILE.test(phone)) {
    throw new PhoneUpdateError(
      "Enter a valid mobile number starting with 078, 079, 072 or 073"
    );
  }

  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { phone: true },
  });
  if (!farmer) throw new PhoneUpdateError("Farmer not found", 404);

  if (farmer.phone) {
    if (farmer.phone === phone) return { phone, phoneVerified: false };
    throw new PhoneUpdateError(
      "Your account already has a phone number. To change it, contact support."
    );
  }

  const { checkExistingUser } = await import("./userServices");
  if (await checkExistingUser(phone, undefined)) {
    throw new PhoneUpdateError("This phone number is already used by another account");
  }

  try {
    const updated = await prisma.farmer.update({
      where: { id: farmerId },
      data: { phone, phoneVerified: false, phoneChangedAt: new Date() },
      select: { phone: true, phoneVerified: true },
    });
    await prisma.farmerSecurityEvent.create({
      data: {
        farmerId,
        eventType: "PHONE_CHANGE",
        description: "Phone number added to an email account",
      },
    });
    return { phone: updated.phone as string, phoneVerified: updated.phoneVerified };
  } catch (e: any) {
    if (e?.code === "P2002") {
      throw new PhoneUpdateError("This phone number is already used by another account");
    }
    throw e;
  }
}
