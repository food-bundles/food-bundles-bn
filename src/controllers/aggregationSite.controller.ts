import { NextFunction, Request, Response } from "express";
import prisma from "../prisma";
import errorHandler, { catchAsyncError } from "../utils/errorhandler.utlity";
import {
  isValidCoordinate,
  nearestSitesForFarmer,
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

// Farmer: save the farm position (GPS pin) the nearest site is worked out from
export const updateFarmerLocationController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const farmerId = (req as any).user.id;
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);
    if (!isValidCoordinate(latitude, longitude)) {
      return next(new errorHandler({ message: "latitude and longitude must be valid coordinates", statusCode: 400 }));
    }

    await prisma.farmer.update({
      where: { id: farmerId },
      data: { latitude, longitude, locationUpdatedAt: new Date() },
    });
    const sites = await nearestSitesForFarmer(farmerId, 1);
    res.status(200).json({ success: true, message: "Location saved", data: sites });
  }
);

// Admin: list sites
export const listSitesController = catchAsyncError(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = {};
  if (req.query.active === "true") where.isActive = true;
  if (req.query.active === "false") where.isActive = false;
  if (typeof req.query.district === "string" && req.query.district) {
    where.district = { equals: req.query.district, mode: "insensitive" };
  }
  const data = await prisma.aggregationSite.findMany({ where, orderBy: [{ district: "asc" }, { name: "asc" }] });
  res.status(200).json({ success: true, message: "Aggregation sites retrieved", data });
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
