import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import { LocationValidationService } from "../services/location.service";
import errorHandler, { catchAsyncError } from "../utils/errorhandler.utlity";
import {
  assignAllSites,
  listAssignedFarmers,
  assignMembersToSite,
  releaseMembersFromSite,
  siteCandidates,
  autoAssignFarmerSite,
  createSite,
  SiteInputError,
  getAssignment,
  getSiteMembers,
  isValidCoordinate,
  listSitesWithCounts,
  mySiteForFarmer,
  nearestSitesForFarmer,
  setAggregatorSite,
  setFarmerSite,
  syncSitesFromWfp,
} from "../services/aggregationSite.service";

// Farmer: closest aggregation sites to the farmer's position
export const getNearestSitesController = catchAsyncError(async (req: Request, res: Response) => {
  const farmerId = (req as any).user.id;
  const rawLimit = parseInt(req.query.limit as string, 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 10) : 1;

  const sites = await nearestSitesForFarmer(farmerId, limit);
  res.status(200).json({
    success: true,
    message: sites.length ? "Nearest aggregation sites retrieved" : "No position or site found for this farmer",
    data: sites,
  });
});

// Farmer: save the farm location the nearest site is worked out from. Send the GPS pin (latitude and
// longitude), the place (province, district and sector), or both.
export const updateFarmerLocationController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const farmerId = (req as any).user.id;
    const { province, district, sector } = req.body ?? {};
    const hasPin = req.body?.latitude !== undefined || req.body?.longitude !== undefined;
    const hasPlace = province !== undefined || district !== undefined || sector !== undefined;
    if (!hasPin && !hasPlace) {
      return next(
        new errorHandler({ message: "Send a GPS position or a province, district and sector", statusCode: 400 })
      );
    }

    const data: Record<string, unknown> = { locationUpdatedAt: new Date() };

    if (hasPin) {
      const latitude = Number(req.body.latitude);
      const longitude = Number(req.body.longitude);
      if (!isValidCoordinate(latitude, longitude)) {
        return next(new errorHandler({ message: "latitude and longitude must be valid coordinates", statusCode: 400 }));
      }
      data.latitude = latitude;
      data.longitude = longitude;
    }

    if (hasPlace) {
      if (![province, district, sector].every((v) => typeof v === "string" && v.trim())) {
        return next(new errorHandler({ message: "province, district and sector are all needed", statusCode: 400 }));
      }
      const check = LocationValidationService.validateLocationHierarchy({ province, district, sector } as any);
      if (!check.isValid) {
        return next(new errorHandler({ message: check.errors.join(", "), statusCode: 400 }));
      }
      data.province = province;
      data.district = district;
      data.sector = sector;
      // The cell and village belonged to the old sector
      data.cell = null;
      data.village = null;
      // A GPS pin from the old place would keep pointing at the old site, so drop it unless a new one came along
      if (!hasPin) {
        data.latitude = null;
        data.longitude = null;
      }
    }

    await prisma.farmer.update({ where: { id: farmerId }, data });
    // The site follows the farm: work it out again from the new position (an admin's choice is kept)
    await autoAssignFarmerSite(farmerId).catch((error) =>
      console.error("Failed to re-assign the farmer's aggregation site:", error)
    );
    const sites = await nearestSitesForFarmer(farmerId, 1);
    res.status(200).json({ success: true, message: "Location saved", data: sites });
  }
);

// Admin: add a collection point by hand (one that is not in the WFP market list)
export const createSiteController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site = await createSite(req.body ?? {});
      res.status(201).json({ success: true, message: "Aggregation site added", data: site });
    } catch (error) {
      if (error instanceof SiteInputError) {
        return next(new errorHandler({ message: error.message, statusCode: error.status }));
      }
      throw error;
    }
  }
);

// Admin: list sites with how many farmers and aggregators each one serves
export const listSitesController = catchAsyncError(async (req: Request, res: Response) => {
  const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
  const district = typeof req.query.district === "string" && req.query.district ? req.query.district : undefined;
  const data = await listSitesWithCounts({ active, district });
  res.status(200).json({ success: true, message: "Aggregation sites retrieved", data });
});

// Farmer: the site the farmer delivers to, with the aggregators who work from it
export const getMySiteController = catchAsyncError(async (req: Request, res: Response) => {
  const data = await mySiteForFarmer((req as any).user.id);
  res.status(200).json({
    success: true,
    message: data ? "Your aggregation site retrieved" : "No aggregation site could be found for you yet",
    data,
  });
});

// Admin: aggregators, farmers and expected deliveries of one site
export const getSiteMembersController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await getSiteMembers(req.params.id);
    if (!data) return next(new errorHandler({ message: "Aggregation site not found", statusCode: 404 }));
    res.status(200).json({ success: true, message: "Aggregation site members retrieved", data });
  }
);

const siteIdFrom = (body: any, next: NextFunction): string | null | undefined => {
  if (body?.siteId === null) return null;
  if (typeof body?.siteId === "string" && body.siteId) return body.siteId;
  next(new errorHandler({ message: "siteId must be a site id, or null to use the nearest site", statusCode: 400 }));
  return undefined;
};

// Admin: the site a farmer or aggregator is on now
export const getAssignmentController = (kind: "farmer" | "aggregator") =>
  catchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const data = await getAssignment(kind, req.params.farmerId ?? req.params.adminId);
    if (!data) return next(new errorHandler({ message: "User not found", statusCode: 404 }));
    res.status(200).json({ success: true, message: "Aggregation site retrieved", data });
  });

// Admin: choose a farmer's site (siteId null = back to the nearest site)
export const assignFarmerSiteController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const siteId = siteIdFrom(req.body, next);
    if (siteId === undefined) return;
    try {
      const assigned = await setFarmerSite(req.params.farmerId, siteId);
      res.status(200).json({ success: true, message: "Farmer's aggregation site updated", data: { siteId: assigned } });
    } catch (error: any) {
      next(new errorHandler({ message: error.message, statusCode: 400 }));
    }
  }
);

// Admin: choose an aggregator's site (siteId null = back to the nearest site)
export const assignAggregatorSiteController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const siteId = siteIdFrom(req.body, next);
    if (siteId === undefined) return;
    try {
      const assigned = await setAggregatorSite(req.params.adminId, siteId);
      res.status(200).json({ success: true, message: "Aggregator's aggregation site updated", data: { siteId: assigned } });
    } catch (error: any) {
      next(new errorHandler({ message: error.message, statusCode: 400 }));
    }
  }
);

// Admin: put many farmers and/or aggregators on one site
export const addSiteMembersController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await assignMembersToSite(req.params.id, req.body ?? {});
      res.status(200).json({ success: true, message: "People added to the aggregation site", data });
    } catch (error: any) {
      next(new errorHandler({ message: error.message, statusCode: 400 }));
    }
  }
);

// Admin: take many farmers and/or aggregators off an admin-chosen site (they go back to their nearest one)
export const removeSiteMembersController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await releaseMembersFromSite(req.params.id, req.body ?? {});
      res.status(200).json({ success: true, message: "People removed from the aggregation site", data });
    } catch (error: any) {
      next(new errorHandler({ message: error.message, statusCode: 400 }));
    }
  }
);

// Admin: farmers or aggregators that could be added to this site (search by name, phone or place)
export const getSiteCandidatesController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const kind = req.query.kind === "aggregator" ? "aggregator" : req.query.kind === "farmer" ? "farmer" : null;
    if (!kind) return next(new errorHandler({ message: "kind must be farmer or aggregator", statusCode: 400 }));
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const data = await siteCandidates(req.params.id, kind, search);
    res.status(200).json({ success: true, message: "Candidates retrieved", data });
  }
);

// Admin: only the farmers who are assigned to an aggregation site, each with their site
export const listAssignedFarmersController = catchAsyncError(async (req: Request, res: Response) => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const siteId = typeof req.query.siteId === "string" && req.query.siteId ? req.query.siteId : undefined;
  const data = await listAssignedFarmers({ search, siteId });
  res.status(200).json({ success: true, message: "Assigned farmers retrieved", data });
});

// Admin: give every farmer and aggregator without a site their nearest one (force = work all out again)
export const assignAllSitesController = catchAsyncError(async (req: Request, res: Response) => {
  const data = await assignAllSites({ force: req.body?.force === true });
  res.status(200).json({ success: true, message: "Aggregation sites assigned", data });
});

// Admin: pull new markets in from WfpMarketPrice
export const syncSitesController = catchAsyncError(async (_req: Request, res: Response) => {
  const result = await syncSitesFromWfp();
  res.status(200).json({ success: true, message: "Aggregation sites synced from WFP markets", data: result });
});

// Admin: rename, correct coordinates or switch a site on/off
export const updateSiteController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, district, province, latitude, longitude, isActive } = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = String(name).trim();
    if (district !== undefined) data.district = district;
    if (province !== undefined) data.province = province;
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return next(new errorHandler({ message: "isActive must be true or false", statusCode: 400 }));
      }
      data.isActive = isActive;
    }
    if (latitude !== undefined || longitude !== undefined) {
      if (!isValidCoordinate(Number(latitude), Number(longitude))) {
        return next(new errorHandler({ message: "latitude and longitude must be valid coordinates", statusCode: 400 }));
      }
      data.latitude = Number(latitude);
      data.longitude = Number(longitude);
    }
    if (Object.keys(data).length === 0) {
      return next(new errorHandler({ message: "Nothing to update", statusCode: 400 }));
    }

    const existing = await prisma.aggregationSite.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return next(new errorHandler({ message: "Aggregation site not found", statusCode: 404 }));
    }
    const updated = await prisma.aggregationSite.update({ where: { id: req.params.id }, data });
    res.status(200).json({ success: true, message: "Aggregation site updated", data: updated });
  }
);
