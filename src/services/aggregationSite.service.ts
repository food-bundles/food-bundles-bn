import prisma from "../prisma";

export type PositionSource = "SUBMISSION_PIN" | "FARMER_PIN" | "DISTRICT_CENTER";

export interface Position {
  latitude: number;
  longitude: number;
  /** DISTRICT_CENTER is approximate; the others are exact */
  source: PositionSource;
}

export interface NearestSite {
  id: string;
  name: string;
  district: string | null;
  province: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  approximate: boolean;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line (great-circle) distance in km. */
export const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

export const isValidCoordinate = (lat: unknown, lng: unknown): boolean =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

/**
 * Add the markets of WfpMarketPrice that are not in AggregationSite yet, as active sites (a market that
 * stopped reporting prices still exists, so price age is not held against it). Sites already in the table
 * are never touched, so an admin's edits and on/off choices are kept.
 */
export async function syncSitesFromWfp() {
  const markets = await prisma.$queryRaw<
    {
      marketName: string;
      province: string | null;
      district: string | null;
      latitude: number;
      longitude: number;
      lastPriceDate: Date;
    }[]
  >`
    SELECT "marketName",
           MAX("province") AS province,
           MAX("district") AS district,
           AVG("latitude") AS latitude,
           AVG("longitude") AS longitude,
           MAX("date") AS "lastPriceDate"
    FROM "WfpMarketPrice"
    WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
    GROUP BY "marketName"
  `;

  const existing = new Set(
    (await prisma.aggregationSite.findMany({ select: { marketName: true } })).map((s) => s.marketName)
  );

  let created = 0;
  for (const m of markets) {
    const latitude = Number(m.latitude);
    const longitude = Number(m.longitude);
    if (!isValidCoordinate(latitude, longitude)) continue;
    if (existing.has(m.marketName)) continue;
    await prisma.aggregationSite.create({
      data: {
        name: m.marketName,
        marketName: m.marketName,
        province: m.province,
        district: m.district,
        latitude,
        longitude,
        lastPriceDate: m.lastPriceDate,
      },
    });
    created++;
  }
  return { markets: markets.length, created };
}

/** Centre of the active sites in a district: the best guess for a farmer who never shared a pin. */
async function districtCenter(district?: string | null): Promise<Position | null> {
  if (!district?.trim()) return null;
  const sites = await prisma.aggregationSite.findMany({
    where: { isActive: true, district: { equals: district.trim(), mode: "insensitive" } },
    select: { latitude: true, longitude: true },
  });
  if (sites.length === 0) return null;
  return {
    latitude: sites.reduce((sum, s) => sum + s.latitude, 0) / sites.length,
    longitude: sites.reduce((sum, s) => sum + s.longitude, 0) / sites.length,
    source: "DISTRICT_CENTER",
  };
}

/** Where a farmer is: this harvest's pin, else their saved position, else their district. */
export async function resolveFarmerPosition(
  farmerId: string,
  pin?: { latitude?: number | null; longitude?: number | null }
): Promise<Position | null> {
  if (pin && isValidCoordinate(pin.latitude, pin.longitude)) {
    return { latitude: pin.latitude as number, longitude: pin.longitude as number, source: "SUBMISSION_PIN" };
  }
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { latitude: true, longitude: true, district: true },
  });
  if (!farmer) return null;
  if (isValidCoordinate(farmer.latitude, farmer.longitude)) {
    return { latitude: farmer.latitude as number, longitude: farmer.longitude as number, source: "FARMER_PIN" };
  }
  return districtCenter(farmer.district);
}

/** The closest active sites to a position, nearest first. */
export async function findNearestSites(position: Position, limit = 1): Promise<NearestSite[]> {
  const sites = await prisma.aggregationSite.findMany({ where: { isActive: true } });
  return sites
    .map((s) => ({
      id: s.id,
      name: s.name,
      district: s.district,
      province: s.province,
      latitude: s.latitude,
      longitude: s.longitude,
      distanceKm:
        Math.round(haversineKm(position.latitude, position.longitude, s.latitude, s.longitude) * 10) / 10,
      approximate: position.source === "DISTRICT_CENTER",
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(1, limit));
}

export async function nearestSitesForFarmer(
  farmerId: string,
  limit = 1,
  pin?: { latitude?: number | null; longitude?: number | null }
): Promise<NearestSite[]> {
  const position = await resolveFarmerPosition(farmerId, pin);
  return position ? findNearestSites(position, limit) : [];
}

/**
 * The aggregation site that goes with a submission/offer: the one assigned when it was submitted,
 * otherwise the nearest to the farmer now (older submissions have none). Distance is measured from
 * the harvest's pin, the farmer's saved position, or their district, in that order.
 */
export async function siteForSubmission(
  farmerId: string,
  submission: {
    latitude: number | null;
    longitude: number | null;
    aggregationSite?: { id: string; name: string; district: string | null; province: string | null; latitude: number; longitude: number } | null;
  }
): Promise<NearestSite | null> {
  const position = await resolveFarmerPosition(farmerId, submission);
  const assigned = submission.aggregationSite;
  if (assigned) {
    return {
      id: assigned.id,
      name: assigned.name,
      district: assigned.district,
      province: assigned.province,
      latitude: assigned.latitude,
      longitude: assigned.longitude,
      distanceKm: position
        ? Math.round(haversineKm(position.latitude, position.longitude, assigned.latitude, assigned.longitude) * 10) / 10
        : 0,
      approximate: position?.source === "DISTRICT_CENTER" || !position,
    };
  }
  return position ? (await findNearestSites(position, 1))[0] ?? null : null;
}
