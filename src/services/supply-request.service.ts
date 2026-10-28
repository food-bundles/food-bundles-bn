import prisma from "../prisma";
import { userCan } from "../middleware/authMiddleware";
import { canSeeCustomerType } from "./access.service";
import { generateOrderNumber } from "./order.services";
import { createNotificationService } from "./notification.services";
import { tryAutoAssign } from "./aggregationSite.service";

/**
 * Supply requests: an aggregator lists the products a customer (e.g. a school)
 * needs, on a weekly timetable between two dates. Farmers submit against its
 * lines; submissions follow the normal flow (approve → verify → pay, with the
 * request price as the reference). When a submission is paid its quantity is
 * added to stock and then moved out again into the customer's order for that
 * day — one order per request per day, bought on the customer's behalf.
 */

export class SupplyRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const TIME_ZONE = "Africa/Kigali";
export const WEEKDAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Calendar day (YYYY-MM-DD) of a moment, in Rwanda time
const dayKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

// 1 = Monday … 7 = Sunday, for a YYYY-MM-DD day
const weekdayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Days (YYYY-MM-DD) in [from, to] that fall on the weekday. */
const occurrences = (weekday: number, from: string, to: string, max = 60) => {
  const days: string[] = [];
  for (let day = from; day <= to && days.length < max; day = addDays(day, 1)) {
    if (weekdayOf(day) === weekday) days.push(day);
  }
  return days;
};

const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);

// ─── Customers an aggregator buys for ────────────────────────────────────────

/** Customers the user may create requests for. */
export const listRequestCustomers = async (user: any) => {
  const select = { id: true, name: true, district: true, customerType: { select: { id: true, name: true } } };
  if (userCan(user, "supply_requests.view_all")) {
    const customers = await prisma.restaurant.findMany({
      where: {
        deletedAt: null,
        ...(user?.customerTypeScope ? { customerTypeId: { in: user.customerTypeScope } } : {}),
      },
      select,
      orderBy: { name: "asc" },
    });
    return customers;
  }
  const links = await prisma.aggregatorCustomer.findMany({
    where: { aggregatorId: user.id, restaurant: { deletedAt: null } },
    select: { restaurant: { select } },
  });
  return links.map((l) => l.restaurant);
};

/** Customers assigned to one aggregator. */
export const getAggregatorCustomers = async (aggregatorId: string) => {
  const links = await prisma.aggregatorCustomer.findMany({
    where: { aggregatorId },
    select: { restaurant: { select: { id: true, name: true, customerType: { select: { name: true } } } } },
  });
  return links.map((l) => l.restaurant);
};

/** Replace the customers assigned to an aggregator. */
export const setAggregatorCustomers = async (aggregatorId: string, restaurantIds: string[], actorId: string) => {
  const aggregator = await prisma.admin.findUnique({ where: { id: aggregatorId }, select: { id: true, deletedAt: true } });
  if (!aggregator || aggregator.deletedAt) throw new SupplyRequestError("User not found", 404);
  const ids = [...new Set(restaurantIds.filter(Boolean))];
  const found = await prisma.restaurant.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new SupplyRequestError("One of the customers no longer exists");

  await prisma.$transaction([
    prisma.aggregatorCustomer.deleteMany({ where: { aggregatorId, restaurantId: { notIn: ids } } }),
    ...ids.map((restaurantId) =>
      prisma.aggregatorCustomer.upsert({
        where: { aggregatorId_restaurantId: { aggregatorId, restaurantId } },
        update: {},
        create: { aggregatorId, restaurantId, assignedBy: actorId },
      }),
    ),
  ]);
  return getAggregatorCustomers(aggregatorId);
};

const assertCustomerAllowed = async (user: any, restaurantId: string) => {
  const customer = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, deletedAt: true, customerTypeId: true },
  });
  if (!customer || customer.deletedAt) throw new SupplyRequestError("Customer not found", 404);
  if (userCan(user, "supply_requests.view_all")) {
    if (!canSeeCustomerType(user, customer.customerTypeId)) {
      throw new SupplyRequestError("This customer is outside your customer types", 403);
    }
    return;
  }
  const link = await prisma.aggregatorCustomer.findUnique({
    where: { aggregatorId_restaurantId: { aggregatorId: user.id, restaurantId } },
  });
  if (!link) throw new SupplyRequestError("This customer is not assigned to you", 403);
};

// ─── Request lists ────────────────────────────────────────────────────────────

type ItemInput = { id?: string; productId: string; weekday: number; quantity: number; price?: number };

const cleanItems = async (items: ItemInput[]) => {
  if (!Array.isArray(items) || items.length === 0) throw new SupplyRequestError("Add at least one product");
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, purchasePrice: true },
  });
  const purchase = new Map(products.map((p) => [p.id, p.purchasePrice]));
  return items.map((item) => {
    if (!purchase.has(item.productId)) throw new SupplyRequestError("A product in the list no longer exists");
    const weekday = Number(item.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new SupplyRequestError("Pick a day for every product");
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new SupplyRequestError("Every product needs a quantity");
    // Starts at the Food Bundles purchase price; the aggregator may set their own
    const price = item.price !== undefined && item.price !== null ? Number(item.price) : purchase.get(item.productId)!;
    if (!Number.isFinite(price) || price <= 0) throw new SupplyRequestError("Every product needs a price above 0");
    return { id: item.id, productId: item.productId, weekday, quantity, price };
  });
};

const parseDay = (value: unknown, field: string) => {
  const day = typeof value === "string" ? value.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new SupplyRequestError(`${field} is required`);
  return day;
};

export const createSupplyRequest = async (
  user: any,
  input: { restaurantId: string; title?: string; notes?: string; startDate: string; endDate: string; items: ItemInput[] },
) => {
  await assertCustomerAllowed(user, input.restaurantId);
  const start = parseDay(input.startDate, "Start date");
  const end = parseDay(input.endDate, "End date");
  if (end < start) throw new SupplyRequestError("The end date must be after the start date");
  const items = await cleanItems(input.items);

  const request = await prisma.supplyRequest.create({
    data: {
      restaurantId: input.restaurantId,
      createdById: user.id,
      title: input.title?.trim() || null,
      notes: input.notes?.trim() || null,
      startDate: dayToDate(start),
      endDate: dayToDate(end),
      items: { create: items.map(({ id: _id, ...item }) => item) },
    },
  });
  return getSupplyRequest(user, request.id);
};

/** Who may see a request: everyone with "see all", else its creator or the customer's aggregators. */
const assertCanSeeRequest = async (user: any, request: { createdById: string; restaurantId: string; restaurant?: { customerTypeId: string | null } | null }) => {
  if (userCan(user, "supply_requests.view_all")) {
    if (request.restaurant && !canSeeCustomerType(user, request.restaurant.customerTypeId)) {
      throw new SupplyRequestError("Request not found", 404);
    }
    return;
  }
  if (request.createdById === user.id) return;
  const link = await prisma.aggregatorCustomer.findUnique({
    where: { aggregatorId_restaurantId: { aggregatorId: user.id, restaurantId: request.restaurantId } },
  });
  if (!link) throw new SupplyRequestError("Request not found", 404);
};

export const updateSupplyRequest = async (
  user: any,
  requestId: string,
  input: { title?: string; notes?: string; endDate?: string; items?: ItemInput[] },
) => {
  const request = await prisma.supplyRequest.findUnique({
    where: { id: requestId },
    include: { restaurant: { select: { customerTypeId: true } }, items: { include: { _count: { select: { submissions: true } } } } },
  });
  if (!request) throw new SupplyRequestError("Request not found", 404);
  await assertCanSeeRequest(user, request);
  if (request.status !== "OPEN") throw new SupplyRequestError("Only open requests can be edited");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title?.trim() || null;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
  if (input.endDate !== undefined) {
    const end = parseDay(input.endDate, "End date");
    if (dayToDate(end) < request.startDate) throw new SupplyRequestError("The end date must be after the start date");
    data.endDate = dayToDate(end);
  }

  await prisma.$transaction(async (tx) => {
    await tx.supplyRequest.update({ where: { id: requestId }, data });
    if (input.items) {
      const items = await cleanItems(input.items);
      const keep = new Set(items.filter((i) => i.id).map((i) => i.id));
      for (const existing of request.items) {
        if (!keep.has(existing.id)) {
          if (existing._count.submissions > 0) {
            throw new SupplyRequestError("A product farmers already submitted can't be removed; set its quantity instead");
          }
          await tx.supplyRequestItem.delete({ where: { id: existing.id } });
        }
      }
      for (const { id, ...item } of items) {
        if (id && request.items.some((e) => e.id === id)) {
          await tx.supplyRequestItem.update({ where: { id }, data: { quantity: item.quantity, price: item.price, weekday: item.weekday } });
        } else {
          await tx.supplyRequestItem.create({ data: { ...item, requestId } });
        }
      }
    }
  });
  return getSupplyRequest(user, requestId);
};

export const setSupplyRequestStatus = async (user: any, requestId: string, status: "OPEN" | "CLOSED" | "CANCELLED") => {
  if (!["OPEN", "CLOSED", "CANCELLED"].includes(status)) throw new SupplyRequestError("Unknown status");
  const request = await prisma.supplyRequest.findUnique({
    where: { id: requestId },
    include: { restaurant: { select: { customerTypeId: true } } },
  });
  if (!request) throw new SupplyRequestError("Request not found", 404);
  await assertCanSeeRequest(user, request);
  await prisma.supplyRequest.update({ where: { id: requestId }, data: { status } });
  return getSupplyRequest(user, requestId);
};

export const listSupplyRequests = async (user: any, filters: { status?: string } = {}) => {
  const where: any = {};
  if (filters.status) where.status = filters.status;
  if (userCan(user, "supply_requests.view_all")) {
    if (user?.customerTypeScope) where.restaurant = { customerTypeId: { in: user.customerTypeScope } };
  } else {
    const links = await prisma.aggregatorCustomer.findMany({ where: { aggregatorId: user.id }, select: { restaurantId: true } });
    where.OR = [{ createdById: user.id }, { restaurantId: { in: links.map((l) => l.restaurantId) } }];
  }
  const requests = await prisma.supplyRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { id: true, name: true, customerType: { select: { name: true } } } },
      createdBy: { select: { id: true, username: true } },
      _count: { select: { items: true, orders: true } },
    },
  });
  return requests;
};

/**
 * One request with, for each upcoming day (today → +13 days, inside the
 * request dates), every product: needed, submitted by farmers, received
 * (verified/paid) and still missing.
 */
export const getSupplyRequest = async (user: any, requestId: string) => {
  const request = await prisma.supplyRequest.findUnique({
    where: { id: requestId },
    include: {
      restaurant: { select: { id: true, name: true, district: true, customerTypeId: true, customerType: { select: { name: true } } } },
      createdBy: { select: { id: true, username: true } },
      items: {
        orderBy: [{ weekday: "asc" }, { createdAt: "asc" }],
        include: {
          product: { select: { id: true, productName: true, unit: true, purchasePrice: true } },
          submissions: {
            where: { status: { not: "REJECTED" } },
            select: {
              id: true,
              status: true,
              submittedQty: true,
              acceptedQty: true,
              supplyDate: true,
              farmer: { select: { name: true, phone: true } },
            },
          },
        },
      },
      orders: { select: { id: true, orderNumber: true, supplyDate: true, totalAmount: true, status: true, paymentStatus: true } },
    },
  });
  if (!request) throw new SupplyRequestError("Request not found", 404);
  await assertCanSeeRequest(user, request);

  const today = dayKey(new Date());
  const from = dayKey(request.startDate) > today ? dayKey(request.startDate) : today;
  const to = [addDays(from, 13), dayKey(request.endDate)].sort()[0];

  const days = new Map<string, any[]>();
  for (const item of request.items) {
    for (const day of occurrences(item.weekday, from, to)) {
      const forDay = item.submissions.filter((s) => s.supplyDate && dayKey(s.supplyDate) === day);
      const submitted = forDay.reduce((sum, s) => sum + (s.submittedQty ?? 0), 0);
      const received = forDay
        .filter((s) => s.status === "VERIFIED" || s.status === "PAID")
        .reduce((sum, s) => sum + (s.acceptedQty ?? 0), 0);
      const line = {
        itemId: item.id,
        productId: item.productId,
        productName: item.product.productName,
        unit: item.product.unit,
        price: item.price,
        needed: item.quantity,
        submitted,
        received,
        missing: Math.max(0, item.quantity - submitted),
        submissions: forDay,
      };
      days.set(day, [...(days.get(day) || []), line]);
    }
  }

  return {
    ...request,
    schedule: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, lines]) => ({ date, weekday: WEEKDAYS[weekdayOf(date)], lines })),
  };
};

// ─── Farmers ──────────────────────────────────────────────────────────────────

/**
 * Where one farmer can supply: their crops, their aggregation site (assigned now if they have none)
 * and their district. Used to keep a farmer's list to requests for what they grow, near them.
 */
const farmerSupplyScope = async (farmerId: string) => {
  const load = () =>
    prisma.farmer.findUnique({
      where: { id: farmerId },
      select: {
        district: true,
        aggregationSite: { select: { id: true, name: true, district: true } },
        FarmerPrimaryCrop: { select: { productId: true } },
      },
    });
  let farmer = await load();
  if (farmer && !farmer.aggregationSite) {
    await tryAutoAssign("farmer", farmerId);
    farmer = await load();
  }
  if (!farmer) return null;
  const districts = [farmer.district, farmer.aggregationSite?.district]
    .filter((d): d is string => !!d)
    .map((d) => d.toLowerCase());
  return {
    productIds: farmer.FarmerPrimaryCrop.map((c) => c.productId),
    site: farmer.aggregationSite,
    districts: [...new Set(districts)],
  };
};

/**
 * Open requests farmers can supply: each product with its next days (up to
 * two weeks) and how much is still missing on each.
 *
 * With a farmer id, only the lines for the crops they grow, on requests near them: posted by an
 * aggregator of their site, or for a customer in their district (or their site's district). A farmer
 * whose place is not known yet sees every request for their crops. Each request then also says where
 * to deliver (their site).
 */
export const listOpenRequestsForFarmers = async (farmerId?: string) => {
  const today = dayKey(new Date());
  const scope = farmerId ? await farmerSupplyScope(farmerId) : null;
  if (farmerId && (!scope || scope.productIds.length === 0)) return [];

  const requests = await prisma.supplyRequest.findMany({
    where: { status: "OPEN", endDate: { gte: dayToDate(today) } },
    orderBy: { startDate: "asc" },
    include: {
      restaurant: { select: { district: true, customerType: { select: { name: true } } } },
      createdBy: { select: { aggregationSiteId: true } },
      items: {
        ...(scope ? { where: { productId: { in: scope.productIds } } } : {}),
        include: {
          product: { select: { productName: true, unit: true, images: true } },
          submissions: {
            where: { status: { not: "REJECTED" } },
            select: { submittedQty: true, supplyDate: true },
          },
        },
      },
    },
  });

  const isNear = (request: (typeof requests)[number]) => {
    if (!scope) return true;
    const placeKnown = !!scope.site || scope.districts.length > 0;
    if (!placeKnown) return true;
    if (scope.site && request.createdBy?.aggregationSiteId === scope.site.id) return true;
    const district = request.restaurant.district?.toLowerCase();
    return !!district && scope.districts.includes(district);
  };

  return requests
    .filter(isNear)
    .map((request) => {
      const from = dayKey(request.startDate) > today ? dayKey(request.startDate) : today;
      const to = [addDays(from, 13), dayKey(request.endDate)].sort()[0];
      const lines = request.items.flatMap((item) =>
        occurrences(item.weekday, from, to).map((day) => {
          const submitted = item.submissions
            .filter((s) => s.supplyDate && dayKey(s.supplyDate) === day)
            .reduce((sum, s) => sum + (s.submittedQty ?? 0), 0);
          return {
            itemId: item.id,
            date: day,
            weekday: WEEKDAYS[item.weekday],
            productName: item.product.productName,
            unit: item.product.unit,
            image: item.product.images?.[0] ?? null,
            price: item.price,
            needed: item.quantity,
            missing: Math.max(0, item.quantity - submitted),
          };
        }),
      );
      return {
        id: request.id,
        title: request.title,
        // Farmers see who buys in general terms, not the customer's name
        customerType: request.restaurant.customerType?.name ?? "Customer",
        district: request.restaurant.district,
        startDate: request.startDate,
        endDate: request.endDate,
        ...(scope ? { deliveryPoint: scope.site?.name ?? null } : {}),
        lines: lines.filter((l) => l.missing > 0).sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .filter((r) => r.lines.length > 0);
};

/** A farmer submits products for one line and day of a request. */
export const submitToSupplyRequest = async (
  farmerId: string,
  itemId: string,
  input: { date: string; quantity: number; price?: number },
) => {
  const item = await prisma.supplyRequestItem.findUnique({
    where: { id: itemId },
    include: { request: true, product: { select: { productName: true, categoryId: true } } },
  });
  if (!item) throw new SupplyRequestError("This request no longer exists", 404);
  if (item.request.status !== "OPEN") throw new SupplyRequestError("This request is closed");

  const day = parseDay(input.date, "Delivery day");
  const today = dayKey(new Date());
  if (day < today) throw new SupplyRequestError("Pick today or a later day");
  if (day < dayKey(item.request.startDate) || day > dayKey(item.request.endDate)) {
    throw new SupplyRequestError("That day is outside the request dates");
  }
  if (weekdayOf(day) !== item.weekday) {
    throw new SupplyRequestError(`This product is needed on ${WEEKDAYS[item.weekday]}s`);
  }

  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new SupplyRequestError("Enter how much you can bring");
  const price = input.price !== undefined && input.price !== null && input.price !== ("" as any) ? Number(input.price) : item.price;
  if (!Number.isFinite(price) || price <= 0) throw new SupplyRequestError("Enter your price per unit");

  const farmer = await prisma.farmer.findUnique({
    where: { id: farmerId },
    select: { id: true, location: true, province: true, district: true, sector: true, cell: true, village: true },
  });
  if (!farmer) throw new SupplyRequestError("Farmer not found", 404);

  return prisma.farmerSubmission.create({
    data: {
      farmerId,
      productName: item.product.productName,
      categoryId: item.product.categoryId,
      submittedQty: quantity,
      wishedPrice: price,
      status: "PENDING",
      supplyRequestItemId: item.id,
      supplyDate: dayToDate(day),
      deliveryDate: dayToDate(day),
      location: farmer.location,
      province: farmer.province,
      district: farmer.district,
      sector: farmer.sector,
      cell: farmer.cell,
      village: farmer.village,
    },
  });
};

// ─── Paid submission → customer's order for that day ─────────────────────────

/** Reference price for deciding a submission: the request price when it came from a request. */
export const requestPriceFor = async (submission: { supplyRequestItemId: string | null }) => {
  if (!submission.supplyRequestItemId) return null;
  const item = await prisma.supplyRequestItem.findUnique({
    where: { id: submission.supplyRequestItemId },
    select: { price: true },
  });
  return item?.price ?? null;
};

/**
 * After a request submission is paid: its quantity (added to stock when it was
 * verified) moves out of stock into the customer's order for that day, priced
 * at the customer's price (customer type price, else the normal selling price).
 */
export const fulfillSupplyRequestSubmission = async (submissionId: string) => {
  const submission = await prisma.farmerSubmission.findUnique({
    where: { id: submissionId },
    include: { supplyRequestItem: { include: { request: { include: { restaurant: true, createdBy: true } }, product: true } } },
  });
  const item = submission?.supplyRequestItem;
  if (!submission || !item || submission.status !== "PAID" || !submission.acceptedQty) return null;

  const request = item.request;
  const customer = request.restaurant;
  const product = item.product;
  const quantity = submission.acceptedQty;
  const day = submission.supplyDate ? dayKey(submission.supplyDate) : dayKey(new Date());

  // Customer's price for this product
  const typePrice = customer.customerTypeId
    ? await prisma.productCustomerPrice.findUnique({
        where: { productId_customerTypeId: { productId: product.id, customerTypeId: customer.customerTypeId } },
        select: { price: true },
      })
    : null;
  const unitPrice = typePrice?.price ?? product.unitPrice;

  const order = await prisma.$transaction(async (tx) => {
    let dayOrder = await tx.order.findFirst({
      where: { supplyRequestId: request.id, supplyDate: dayToDate(day) },
      include: { orderItems: true },
    });
    if (!dayOrder) {
      dayOrder = await tx.order.create({
        data: {
          orderNumber: await generateOrderNumber(),
          restaurantId: customer.id,
          totalAmount: 0,
          status: "CONFIRMED",
          supplyRequestId: request.id,
          supplyDate: dayToDate(day),
          requestedDelivery: dayToDate(day),
          billingName: customer.name,
          billingEmail: customer.email,
          billingPhone: customer.phone,
          billingAddress: customer.location,
          notes: `Bought on your behalf by ${request.createdBy.username} (supply request${request.title ? `: ${request.title}` : ""}, ${WEEKDAYS[weekdayOf(day)]} ${day})`,
        },
        include: { orderItems: true },
      });
    }

    const line = dayOrder.orderItems.find((l) => l.productId === product.id);
    if (line) {
      const newQty = line.quantity + quantity;
      await tx.orderItem.update({
        where: { id: line.id },
        data: { quantity: newQty, subtotal: newQty * line.unitPrice },
      });
    } else {
      await tx.orderItem.create({
        data: {
          orderId: dayOrder.id,
          productId: product.id,
          productName: product.productName,
          quantity,
          unitPrice,
          subtotal: quantity * unitPrice,
          unit: product.unit,
          images: product.images,
        },
      });
    }

    // Out of stock again: the goods go straight to the customer
    await tx.product.update({ where: { id: product.id }, data: { quantity: { decrement: quantity } } });

    const lines = await tx.orderItem.findMany({ where: { orderId: dayOrder.id }, select: { subtotal: true } });
    const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
    return tx.order.update({ where: { id: dayOrder.id }, data: { totalAmount: total, originalAmount: total } });
  });

  try {
    await createNotificationService({
      title: "Order from your supply request",
      message: `${quantity} ${product.productName} added to order ${order.orderNumber} for ${day}.`,
      eventType: "ORDER_CREATED",
      targetType: "SPECIFIC_USER",
      targetId: customer.id,
      metadata: { orderId: order.id, supplyRequestId: request.id },
    });
  } catch (error) {
    console.error("Failed to notify customer of supply request order:", error);
  }
  return order;
};
