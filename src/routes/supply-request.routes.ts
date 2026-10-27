import { Router, Request, Response } from "express";
import { allow, checkPermission, isAuthenticated } from "../middleware/authMiddleware";
import prisma from "../prisma";
import {
  createSupplyRequest,
  getAggregatorCustomers,
  getSupplyRequest,
  listOpenRequestsForFarmers,
  listRequestCustomers,
  listSupplyRequests,
  setAggregatorCustomers,
  setSupplyRequestStatus,
  submitToSupplyRequest,
  SupplyRequestError,
  updateSupplyRequest,
} from "../services/supply-request.service";

// Supply requests: products a customer (school…) needs, posted by an
// aggregator for farmers to supply. See supply-request.service.ts.
const supplyRequestRoutes = Router();

const fail = (res: Response, error: any, fallback: string) =>
  res
    .status(error instanceof SupplyRequestError ? error.status : 500)
    .json({ success: false, message: error?.message || fallback });

const run =
  (handler: (req: Request) => Promise<unknown>, fallback: string, message?: string) =>
  async (req: Request, res: Response) => {
    try {
      res.json({ success: true, ...(message ? { message } : {}), data: await handler(req) });
    } catch (error) {
      fail(res, error, fallback);
    }
  };

const user = (req: Request) => (req as any).user;

// ── Farmers ──────────────────────────────────────────────────────────────────
/** GET /supply-requests/farmer/open — open requests with what is still missing */
supplyRequestRoutes.get(
  "/farmer/open",
  isAuthenticated,
  checkPermission("FARMER"),
  run(() => listOpenRequestsForFarmers(), "Failed to load requests"),
);

/** POST /supply-requests/farmer/items/:itemId/submit { date, quantity, price? } */
supplyRequestRoutes.post(
  "/farmer/items/:itemId/submit",
  isAuthenticated,
  checkPermission("FARMER"),
  run(
    (req) => submitToSupplyRequest(user(req).id, req.params.itemId as string, req.body ?? {}),
    "Failed to submit",
    "Submitted. Food Bundles will review your price.",
  ),
);

// ── Aggregators' customers ───────────────────────────────────────────────────
/** GET /supply-requests/customers — customers the user may create requests for */
supplyRequestRoutes.get(
  "/customers",
  isAuthenticated,
  allow("supply_requests"),
  run((req) => listRequestCustomers(user(req)), "Failed to load customers"),
);

/** GET /supply-requests/aggregators — aggregators and the customers assigned to them */
supplyRequestRoutes.get(
  "/aggregators",
  isAuthenticated,
  allow.to("supply_requests.assign_customers"),
  run(async () => {
    const aggregators = await prisma.admin.findMany({
      where: { role: "AGGREGATOR", deletedAt: null },
      select: { id: true, username: true, phone: true },
      orderBy: { username: "asc" },
    });
    return Promise.all(
      aggregators.map(async (a) => ({ ...a, customers: await getAggregatorCustomers(a.id) })),
    );
  }, "Failed to load aggregators"),
);

/** PUT /supply-requests/aggregators/:aggregatorId/customers { restaurantIds } */
supplyRequestRoutes.put(
  "/aggregators/:aggregatorId/customers",
  isAuthenticated,
  allow.to("supply_requests.assign_customers"),
  run(
    (req) =>
      setAggregatorCustomers(
        req.params.aggregatorId as string,
        Array.isArray(req.body?.restaurantIds) ? req.body.restaurantIds : [],
        user(req).id,
      ),
    "Failed to assign customers",
    "Customers assigned",
  ),
);

// ── Request lists ────────────────────────────────────────────────────────────
/** GET /supply-requests?status=OPEN */
supplyRequestRoutes.get(
  "/",
  isAuthenticated,
  allow("supply_requests"),
  run(
    (req) => listSupplyRequests(user(req), { status: (req.query.status as string) || undefined }),
    "Failed to load requests",
  ),
);

/** POST /supply-requests { restaurantId, title?, notes?, startDate, endDate, items[] } */
supplyRequestRoutes.post(
  "/",
  isAuthenticated,
  allow.to("supply_requests.create"),
  run((req) => createSupplyRequest(user(req), req.body ?? {}), "Failed to create request", "Request created"),
);

/** GET /supply-requests/:id — with what is needed, submitted and missing per day */
supplyRequestRoutes.get(
  "/:id",
  isAuthenticated,
  allow("supply_requests"),
  run((req) => getSupplyRequest(user(req), req.params.id as string), "Failed to load request"),
);

/** PATCH /supply-requests/:id { title?, notes?, endDate?, items? } */
supplyRequestRoutes.patch(
  "/:id",
  isAuthenticated,
  allow.to("supply_requests.edit"),
  run(
    (req) => updateSupplyRequest(user(req), req.params.id as string, req.body ?? {}),
    "Failed to update request",
    "Request updated",
  ),
);

/** PATCH /supply-requests/:id/status { status: OPEN | CLOSED | CANCELLED } */
supplyRequestRoutes.patch(
  "/:id/status",
  isAuthenticated,
  allow.to("supply_requests.close"),
  run(
    (req) => setSupplyRequestStatus(user(req), req.params.id as string, req.body?.status),
    "Failed to update request",
    "Request updated",
  ),
);

export default supplyRequestRoutes;
