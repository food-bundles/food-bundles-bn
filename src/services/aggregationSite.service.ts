import prisma from "../prisma";
import { randomUUID } from "crypto";

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

/** marketName of a site an admin added by hand: unique, and never the name of a WFP market */
export const MANUAL_MARKET_PREFIX = "manual:";

export class SiteInputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

/** Centre of the active sites in a province, when the district has none to measure from */
async function provinceCenter(province?: string | null): Promise<Position | null> {
  if (!province?.trim()) return null;
  const sites = await prisma.aggregationSite.findMany({
    where: { isActive: true, province: { equals: province.trim(), mode: "insensitive" } },
    select: { latitude: true, longitude: true },
  });
  if (sites.length === 0) return null;
  return {
    latitude: sites.reduce((sum, s) => sum + s.latitude, 0) / sites.length,
    longitude: sites.reduce((sum, s) => sum + s.longitude, 0) / sites.length,
    source: "DISTRICT_CENTER",
  };
}

/**
 * Admin: add a collection point that is not in the WFP market list. It is active right away and the
 * WFP sync never touches it. People already on a site stay there; "assign all" places those without one.
 *
 * Coordinates are optional: without them the site is placed at the centre of its district (or province),
 * worked out from the other sites there, so nearest-site matching still works. An admin can correct the
 * exact point later by editing the site.
 */
export async function createSite(input: {
  name: unknown;
  district?: unknown;
  province?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  isActive?: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new SiteInputError("Give the site a name");
  if (input.isActive !== undefined && typeof input.isActive !== "boolean") {
    throw new SiteInputError("isActive must be true or false");
  }
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  const district = text(input.district);
  const province = text(input.province);

  const given = (value: unknown) => value !== undefined && value !== null && value !== "";
  let latitude: number;
  let longitude: number;
  let approximate = false;
  if (given(input.latitude) || given(input.longitude)) {
    latitude = Number(input.latitude);
    longitude = Number(input.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      throw new SiteInputError("latitude and longitude must be valid coordinates");
    }
  } else {
    const center = (await districtCenter(district)) ?? (await provinceCenter(province));
    if (!center) {
      throw new SiteInputError(
        "Add the coordinates, or a district or province that already has other sites, so farmers can be matched to it"
      );
    }
    latitude = center.latitude;
    longitude = center.longitude;
    approximate = true;
  }

  const duplicate = await prisma.aggregationSite.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new SiteInputError("A site with this name already exists", 409);

  const site = await prisma.aggregationSite.create({
    data: {
      name,
      marketName: `${MANUAL_MARKET_PREFIX}${randomUUID()}`,
      district,
      province,
      latitude,
      longitude,
      isActive: (input.isActive as boolean | undefined) ?? true,
    },
  });
  // approximate: placed at the district/province centre because no coordinates were given
  return { ...site, farmerCount: 0, aggregatorCount: 0, approximate };
}

/** Centre of the active sites in a district: the best guess for a farmer who never shared a pin. */
export async function districtCenter(district?: string | null): Promise<Position | null> {
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

/** Delivery day and time can be picked this far ahead, no further */
export const MAX_DELIVERY_DAYS_AHEAD = 14;

const siteCard = (
  site: { id: string; name: string; district: string | null; province: string | null; latitude: number; longitude: number },
  position: Position | null
): NearestSite => ({
  id: site.id,
  name: site.name,
  district: site.district,
  province: site.province,
  latitude: site.latitude,
  longitude: site.longitude,
  distanceKm: position
    ? Math.round(haversineKm(position.latitude, position.longitude, site.latitude, site.longitude) * 10) / 10
    : 0,
  approximate: position?.source === "DISTRICT_CENTER" || !position,
});

/**
 * Give a farmer the nearest active site (from their pin, else their district). A site an admin chose is
 * kept unless `force` is set. Returns the site id now assigned, or null when none could be worked out.
 */
export async function autoAssignFarmerSite(farmerId: string, options: { force?: boolean } = {}) {
  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { aggregationSiteId: true, siteAssignedByAdmin: true },
  });
  if (!farmer) return null;
  if (farmer.siteAssignedByAdmin && !options.force) return farmer.aggregationSiteId;

  const [nearest] = await nearestSitesForFarmer(farmerId, 1);
  if (!nearest) return farmer.aggregationSiteId;
  if (nearest.id !== farmer.aggregationSiteId || farmer.siteAssignedByAdmin) {
    await prisma.farmer.update({
      where: { id: farmerId },
      data: { aggregationSiteId: nearest.id, siteAssignedByAdmin: false },
    });
  }
  return nearest.id;
}

/** Same for an aggregator, from the centre of their district (they have no GPS pin). */
export async function autoAssignAggregatorSite(adminId: string, options: { force?: boolean } = {}) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { role: true, district: true, aggregationSiteId: true, siteAssignedByAdmin: true },
  });
  if (!admin || admin.role !== "AGGREGATOR") return null;
  if (admin.siteAssignedByAdmin && !options.force) return admin.aggregationSiteId;

  const position = await districtCenter(admin.district);
  const [nearest] = position ? await findNearestSites(position, 1) : [];
  if (!nearest) return admin.aggregationSiteId;
  if (nearest.id !== admin.aggregationSiteId || admin.siteAssignedByAdmin) {
    await prisma.admin.update({
      where: { id: adminId },
      data: { aggregationSiteId: nearest.id, siteAssignedByAdmin: false },
    });
  }
  return nearest.id;
}

/** Run an automatic assignment without ever failing the request that triggered it. */
export const tryAutoAssign = (kind: "farmer" | "aggregator", id: string) =>
  (kind === "farmer" ? autoAssignFarmerSite(id) : autoAssignAggregatorSite(id)).catch((error) => {
    console.error(`Failed to assign an aggregation site to the ${kind}:`, error);
    return null;
  });

async function requireActiveSite(siteId: string) {
  const site = await prisma.aggregationSite.findUnique({ where: { id: siteId } });
  if (!site) throw new Error("Aggregation site not found");
  if (!site.isActive) throw new Error("That aggregation site is switched off");
  return site;
}

/** Admin choice for a farmer. `null` hands the choice back to the automatic nearest-site rule. */
export async function setFarmerSite(farmerId: string, siteId: string | null) {
  const farmer = await prisma.farmer.findUnique({ where: { id: farmerId }, select: { id: true } });
  if (!farmer) throw new Error("Farmer not found");
  if (siteId === null) {
    await prisma.farmer.update({ where: { id: farmerId }, data: { siteAssignedByAdmin: false } });
    return autoAssignFarmerSite(farmerId, { force: true });
  }
  await requireActiveSite(siteId);
  await prisma.farmer.update({ where: { id: farmerId }, data: { aggregationSiteId: siteId, siteAssignedByAdmin: true } });
  return siteId;
}

/** Admin choice for an aggregator. `null` hands the choice back to the automatic rule. */
export async function setAggregatorSite(adminId: string, siteId: string | null) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { role: true } });
  if (!admin) throw new Error("User not found");
  if (admin.role !== "AGGREGATOR") throw new Error("Only aggregators work from an aggregation site");
  if (siteId === null) {
    await prisma.admin.update({ where: { id: adminId }, data: { siteAssignedByAdmin: false } });
    return autoAssignAggregatorSite(adminId, { force: true });
  }
  await requireActiveSite(siteId);
  await prisma.admin.update({ where: { id: adminId }, data: { aggregationSiteId: siteId, siteAssignedByAdmin: true } });
  return siteId;
}

/** Most people one bulk request may touch */
export const MAX_BULK_MEMBERS = 500;

const uniqueIds = (ids: unknown): string[] =>
  Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === "string" && !!id))] : [];

/**
 * Admin: put many farmers and/or aggregators on one site at once. Every one of them is marked as chosen by
 * an admin, so the automatic nearest-site rule leaves them there. Unknown ids and non-aggregators are skipped.
 */
export async function assignMembersToSite(siteId: string, input: { farmerIds?: unknown; aggregatorIds?: unknown }) {
  const farmerIds = uniqueIds(input.farmerIds);
  const aggregatorIds = uniqueIds(input.aggregatorIds);
  if (farmerIds.length + aggregatorIds.length === 0) throw new Error("Choose at least one farmer or aggregator");
  if (farmerIds.length + aggregatorIds.length > MAX_BULK_MEMBERS) {
    throw new Error(`Choose at most ${MAX_BULK_MEMBERS} people at a time`);
  }
  await requireActiveSite(siteId);

  const data = { aggregationSiteId: siteId, siteAssignedByAdmin: true };
  const [farmers, aggregators] = await prisma.$transaction([
    prisma.farmer.updateMany({ where: { id: { in: farmerIds }, deletedAt: null }, data }),
    prisma.admin.updateMany({ where: { id: { in: aggregatorIds }, role: "AGGREGATOR", deletedAt: null }, data }),
  ]);
  return { farmers: farmers.count, aggregators: aggregators.count };
}

/**
 * Admin: take people off an admin-chosen site by handing them back to the automatic rule. They then sit on
 * their nearest site, which can be this same one; `stillHere` counts those.
 */
export async function releaseMembersFromSite(siteId: string, input: { farmerIds?: unknown; aggregatorIds?: unknown }) {
  const farmerIds = uniqueIds(input.farmerIds);
  const aggregatorIds = uniqueIds(input.aggregatorIds);
  if (farmerIds.length + aggregatorIds.length === 0) throw new Error("Choose at least one farmer or aggregator");
  if (farmerIds.length + aggregatorIds.length > MAX_BULK_MEMBERS) {
    throw new Error(`Choose at most ${MAX_BULK_MEMBERS} people at a time`);
  }

  // Only people actually on this site
  const [farmers, aggregators] = await Promise.all([
    prisma.farmer.findMany({ where: { id: { in: farmerIds }, aggregationSiteId: siteId }, select: { id: true } }),
    prisma.admin.findMany({ where: { id: { in: aggregatorIds }, aggregationSiteId: siteId }, select: { id: true } }),
  ]);

  let stillHere = 0;
  let moved = 0;
  for (const { id } of farmers) {
    const now = await setFarmerSite(id, null).catch(() => siteId);
    now === siteId ? stillHere++ : moved++;
  }
  for (const { id } of aggregators) {
    const now = await setAggregatorSite(id, null).catch(() => siteId);
    now === siteId ? stillHere++ : moved++;
  }
  return { released: farmers.length + aggregators.length, moved, stillHere };
}

/** Admin: farmers or aggregators not on this site yet, to pick from when adding people to it. */
export async function siteCandidates(siteId: string, kind: "farmer" | "aggregator", search?: string, take = 30) {
  const needle = search?.trim();
  const notHere = [{ aggregationSiteId: null }, { aggregationSiteId: { not: siteId } }];
  const limit = Math.min(Math.max(take, 1), 100);

  if (kind === "farmer") {
    const rows = await prisma.farmer.findMany({
      where: {
        deletedAt: null,
        OR: notHere,
        ...(needle
          ? {
              AND: [
                {
                  OR: [
                    { name: { contains: needle, mode: "insensitive" as const } },
                    { phone: { contains: needle } },
                    { district: { contains: needle, mode: "insensitive" as const } },
                    { sector: { contains: needle, mode: "insensitive" as const } },
                  ],
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        district: true,
        sector: true,
        aggregationSite: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
    });
    return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, place: [r.sector, r.district].filter(Boolean).join(", "), currentSite: r.aggregationSite }));
  }

  const rows = await prisma.admin.findMany({
    where: {
      role: "AGGREGATOR",
      deletedAt: null,
      OR: notHere,
      ...(needle
        ? {
            AND: [
              {
                OR: [
                  { username: { contains: needle, mode: "insensitive" as const } },
                  { phone: { contains: needle } },
                  { email: { contains: needle, mode: "insensitive" as const } },
                  { district: { contains: needle, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      username: true,
      phone: true,
      email: true,
      district: true,
      aggregationSite: { select: { id: true, name: true } },
    },
    orderBy: { username: "asc" },
    take: limit,
  });
  return rows.map((r) => ({ id: r.id, name: r.username, phone: r.phone, place: r.district ?? "", currentSite: r.aggregationSite }));
}

/** Catch up farmers and aggregators that have no site yet (or all of them with `force`, keeping admin choices). */
export async function assignAllSites(options: { force?: boolean } = {}) {
  const where = options.force ? {} : { aggregationSiteId: null };
  const [farmers, aggregators] = await Promise.all([
    prisma.farmer.findMany({ where: { ...where, deletedAt: null }, select: { id: true } }),
    prisma.admin.findMany({ where: { ...where, role: "AGGREGATOR", deletedAt: null }, select: { id: true } }),
  ]);
  let farmersAssigned = 0;
  let aggregatorsAssigned = 0;
  for (const f of farmers) if (await tryAutoAssign("farmer", f.id)) farmersAssigned++;
  for (const a of aggregators) if (await tryAutoAssign("aggregator", a.id)) aggregatorsAssigned++;
  return { farmers: farmers.length, farmersAssigned, aggregators: aggregators.length, aggregatorsAssigned };
}

const aggregatorsAt = (siteId: string) =>
  prisma.admin.findMany({
    where: { aggregationSiteId: siteId, role: "AGGREGATOR", deletedAt: null },
    select: { id: true, username: true, phone: true, email: true, siteAssignedByAdmin: true },
    orderBy: { username: "asc" },
  });

/**
 * The farmer's own site with the aggregators who work from it, so both sides know where to meet.
 * A farmer who has none yet gets the nearest one now.
 */
export async function mySiteForFarmer(farmerId: string) {
  const load = () =>
    prisma.farmer.findUnique({
      where: { id: farmerId },
      select: { siteAssignedByAdmin: true, aggregationSite: true },
    });
  let farmer = await load();
  if (!farmer) return null;
  if (!farmer.aggregationSite) {
    await tryAutoAssign("farmer", farmerId);
    farmer = await load();
  }
  const site = farmer?.aggregationSite;
  if (!site) return null;

  const [position, aggregators] = await Promise.all([resolveFarmerPosition(farmerId), aggregatorsAt(site.id)]);
  return {
    ...siteCard(site, position),
    assignedByAdmin: farmer!.siteAssignedByAdmin,
    aggregators: aggregators.map((a) => ({ id: a.id, name: a.username, phone: a.phone })),
  };
}

/** Admin: every site with how many farmers and aggregators it serves. */
export async function listSitesWithCounts(filters: { active?: boolean; district?: string } = {}) {
  const sites = await prisma.aggregationSite.findMany({
    where: {
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      ...(filters.district ? { district: { equals: filters.district, mode: "insensitive" as const } } : {}),
    },
    orderBy: [{ district: "asc" }, { name: "asc" }],
    include: { _count: { select: { farmers: true, aggregators: true } } },
  });
  return sites.map(({ _count, ...site }) => ({
    ...site,
    farmerCount: _count.farmers,
    aggregatorCount: _count.aggregators,
  }));
}

/** Admin: who works from a site, who delivers to it, and who is coming on which day. */
export async function getSiteMembers(siteId: string) {
  const site = await prisma.aggregationSite.findUnique({ where: { id: siteId } });
  if (!site) return null;

  const [aggregators, farmers, deliveries] = await Promise.all([
    aggregatorsAt(siteId),
    prisma.farmer.findMany({
      where: { aggregationSiteId: siteId, deletedAt: null },
      select: { id: true, name: true, phone: true, district: true, sector: true, siteAssignedByAdmin: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.farmerSubmission.findMany({
      where: {
        aggregationSiteId: siteId,
        status: { in: ["PENDING", "NEGOTIATING", "APPROVED"] },
        deliveryDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
      select: {
        id: true,
        productName: true,
        submittedQty: true,
        status: true,
        deliveryDate: true,
        farmer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { deliveryDate: "asc" },
      take: 200,
    }),
  ]);
  return { site, aggregators, farmers, deliveries };
}

/** Admin: only the farmers who are on an aggregation site, each with their site. */
export async function listAssignedFarmers(filters: { search?: string; siteId?: string } = {}) {
  const needle = filters.search?.trim();
  const where = {
    deletedAt: null,
    aggregationSiteId: filters.siteId ? filters.siteId : { not: null },
    ...(needle
      ? {
          OR: [
            { name: { contains: needle, mode: "insensitive" as const } },
            { phone: { contains: needle } },
            { district: { contains: needle, mode: "insensitive" as const } },
            { sector: { contains: needle, mode: "insensitive" as const } },
            { aggregationSite: { name: { contains: needle, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, farmers] = await Promise.all([
    prisma.farmer.count({ where }),
    prisma.farmer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        district: true,
        sector: true,
        siteAssignedByAdmin: true,
        aggregationSite: { select: { id: true, name: true, district: true } },
      },
      orderBy: [{ aggregationSite: { name: "asc" } }, { name: "asc" }],
      take: 500,
    }),
  ]);
  return { total, farmers };
}

/** Admin: the site a farmer or aggregator is on now, and whether an admin chose it. */
export async function getAssignment(kind: "farmer" | "aggregator", id: string) {
  const select = { siteAssignedByAdmin: true, aggregationSite: true };
  const row =
    kind === "farmer"
      ? await prisma.farmer.findUnique({ where: { id }, select })
      : await prisma.admin.findUnique({ where: { id }, select });
  if (!row) return null;
  return { site: row.aggregationSite, assignedByAdmin: row.siteAssignedByAdmin };
}
