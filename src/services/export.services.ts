import prisma from "../prisma";
import * as ExcelJS from "exceljs";
import PDFDocument from "pdfkit-table";
import { formatDate } from "../utils/date-formatter.utils";
import path from "path";

export type ExportFormat = "pdf" | "csv" | "excel" | "html";
export type ExportType =
  | "users"
  | "orders"
  | "restaurants"
  | "payments"
  | "products"
  | "farmers"
  | "logistics"
  | "aggregators"
  | "subscriptions"
  | "wallets"
  | "loans"
  | "deposits"
  | "transactions";

interface ExportHeader {
  title: string;
  description: string;
  logo: string;
}

export interface ExportOptions {
  orientation?: "landscape" | "portrait";
  dateFormat?: "iso" | "local";
}

export interface ExportFilterOptions extends ExportOptions {
  startDate?: string;
  endDate?: string;
  status?: string;
  category?: string;
  role?: string;
  search?: string;
  ids?: string;
  restaurantId?: string;
  farmerId?: string;
  province?: string;
  district?: string;
  type?: string;
  columns?: string;
}

const buildDateRangeFilter = (startDate?: string, endDate?: string) => {
  if (!startDate && !endDate) return undefined;
  const range: any = {};
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) range.gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
  }
  return Object.keys(range).length > 0 ? range : undefined;
};

const formatHeaderTitle = (key: string): string => {
  const customMap: Record<string, string> = {
    rowNumber: "No.",
    orderNumber: "Order Number",
    totalAmount: "Total Amount (RWF)",
    paymentStatus: "Payment Status",
    paymentMethod: "Payment Method",
    createdAt: "Created Date",
    updatedAt: "Updated Date",
    restaurantName: "Restaurant Name",
    restaurantEmail: "Restaurant Email",
    restaurantTIN: "Restaurant TIN",
    restaurantPhone: "Restaurant Phone",
    farmerName: "Farmer Name",
    farmerPhone: "Farmer Phone",
    farmerEmail: "Farmer Email",
    unitPrice: "Unit Price (RWF)",
    purchasePrice: "Purchase Price (RWF)",
    amountPaid: "Amount Paid (RWF)",
    paidAmount: "Paid Amount (RWF)",
    balance: "Balance (RWF)",
    creditLimit: "Credit Limit (RWF)",
    usedCredit: "Used Credit (RWF)",
    remainingCredit: "Remaining Credit (RWF)",
    requestedAmount: "Requested Amount (RWF)",
    approvedAmount: "Approved Amount (RWF)",
    amountCharged: "Amount Charged (RWF)",
    serviceFee: "Service Fee (RWF)",
    totalDeducted: "Total Deducted (RWF)",
    totalOrders: "Total Orders",
    totalSubscriptions: "Total Subscriptions",
    totalSubmissions: "Total Submissions",
    phoneVerified: "Phone Verified",
    isActive: "Is Active",
    tableTronicProductId: "TableTronic ID",
    productName: "Product Name",
    categoryName: "Category Name",
    createdBy: "Created By",
    disbursementDate: "Disbursement Date",
    repaymentDueDate: "Repayment Due Date",
    voucherCode: "Voucher Code",
    voucherType: "Voucher Type",
    discountPercentage: "Discount (%)",
    transactionDate: "Transaction Date",
    transactionId: "Transaction ID",
    transactionRef: "Transaction Ref",
    amount: "Amount (RWF)",
    previousBalance: "Previous Balance (RWF)",
    newBalance: "New Balance (RWF)",
    verified: "Verified Status",
  };

  if (customMap[key]) return customMap[key];
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const formatPossibleDate = (
  val: any,
  dateFormat: ExportOptions["dateFormat"] = "iso"
) => {
  if (val == null) return val;
  if (val instanceof Date) {
    const d = val as Date;
    if (dateFormat === "local") return d.toLocaleString();
    return d.toISOString().replace("T", " ").replace(/\.[0-9]+Z$/, " UTC");
  }
  if (
    typeof val === "string" &&
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)
  ) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      if (dateFormat === "local") return d.toLocaleString();
      return d.toISOString().replace("T", " ").replace(/\.[0-9]+Z$/, " UTC");
    }
  }
  return val;
};

const normalizeDataDates = (
  data: any[],
  dateFormat?: ExportOptions["dateFormat"]
) => {
  const dateKeyPatterns = [
    /date/i,
    /at$/i,
    /created/i,
    /updated/i,
    /start/i,
    /end/i,
    /paid/i,
    /time/i,
  ];
  return data.map((row) => {
    const out: any = {};
    Object.entries(row).forEach(([k, v]) => {
      const isDateKey = dateKeyPatterns.some((rx) => rx.test(k));
      if (
        isDateKey ||
        v instanceof Date ||
        (typeof v === "string" && /\d{4}-\d{2}-\d{2}T/.test(v))
      ) {
        out[k] = formatPossibleDate(v, dateFormat);
      } else if (typeof v === "boolean") {
        out[k] = v ? "Yes" : "No";
      } else {
        out[k] = v ?? "-";
      }
    });
    return out;
  });
};

const EXPORT_HEADERS: Record<ExportType, ExportHeader> = {
  users: {
    title: "Restaurant Users Export",
    description:
      "Complete list of registered restaurant users with verification status and contact information",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  orders: {
    title: "Orders Export",
    description:
      "Comprehensive order data including payment status, amounts, and restaurant information",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  restaurants: {
    title: "Restaurants Export",
    description:
      "Restaurant directory with verification status, contact details, and activity metrics",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  payments: {
    title: "Payments Export",
    description:
      "Financial transaction records for completed payments with restaurant and order details",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  products: {
    title: "Products Export",
    description:
      "Product catalog with pricing, inventory, categories, and administrative information",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  farmers: {
    title: "Farmers Export",
    description:
      "Farmer network directory with contact information, locations, and submission statistics",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  logistics: {
    title: "Logistics Personnel Export",
    description:
      "Logistics team members with contact information and operational details",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  aggregators: {
    title: "Aggregators Export",
    description:
      "Aggregator network with administrative access and contact information",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  subscriptions: {
    title: "Subscriptions Export",
    description:
      "Subscription records for restaurants and farmers including plan, status, and payment details",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  wallets: {
    title: "Wallets Export",
    description:
      "Wallet balances for restaurants along with transaction counts and activity status",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  loans: {
    title: "Loans & Vouchers Export",
    description:
      "Loan applications and voucher credit history with status and repayment details",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  deposits: {
    title: "Wallet Deposits Export",
    description: "Wallet top-up and deposit transaction records",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
  transactions: {
    title: "Wallet Transactions Export",
    description: "Detailed financial transactions log for all wallet activities",
    logo: "https://res.cloudinary.com/dzxyelclu/image/upload/v1760111270/Food_bundle_logo_cfsnsw.png",
  },
};

interface ExportConfig {
  modelName: keyof typeof prisma;
  buildWhere: (options: ExportFilterOptions | undefined, dateFilter: any) => any;
  select: any;
  formatRecord: (record: any) => any;
  calculateStats: (records: any[], formattedRecords: any[]) => any;
}

const EXPORT_CONFIG: Record<ExportType, ExportConfig> = {
  users: {
    modelName: "restaurant",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
          { phone: { contains: options.search, mode: "insensitive" } },
          { tin: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (options?.province) where.province = options.province;
      if (options?.district) where.district = options.district;
      if (options?.status === "verified") where.verified = true;
      if (options?.status === "unverified") where.verified = false;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      name: true,
      email: true,
      phone: true,
      tin: true,
      location: true,
      province: true,
      district: true,
      verified: true,
      createdAt: true,
    },
    formatRecord: (u) => u,
    calculateStats: (records) => ({
      total: records.length,
      verified: records.filter((u) => u.verified).length,
      unverified: records.filter((u) => !u.verified).length,
      provinces: new Set(records.map((u) => u.province).filter(Boolean)).size,
    }),
  },
  orders: {
    modelName: "order",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.restaurantId) {
        where.restaurantId = options.restaurantId;
      }
      if (options?.search) {
        where.OR = [
          { orderNumber: { contains: options.search, mode: "insensitive" } },
          { restaurant: { name: { contains: options.search, mode: "insensitive" } } },
        ];
      }
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      orderNumber: true,
      totalAmount: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      restaurant: {
        select: { name: true, email: true, tin: true, phone: true },
      },
    },
    formatRecord: (order) => ({
      orderNumber: order.orderNumber,
      restaurantName: order.restaurant?.name || "-",
      totalAmount: order.totalAmount || 0,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod || "-",
      createdAt: order.createdAt,
      restaurantPhone: order.restaurant?.phone || "-",
      restaurantTIN: order.restaurant?.tin || "-",
    }),
    calculateStats: (records) => ({
      total: records.length,
      delivered: records.filter((o) => o.status === "DELIVERED").length,
      pending: records.filter((o) => o.status === "PENDING").length,
      totalRevenue: records.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
      paidOrders: records.filter((o) => o.paymentStatus === "COMPLETED").length,
    }),
  },
  restaurants: {
    modelName: "restaurant",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.ids) {
        where.id = { in: options.ids.split(",") };
      }
      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
          { phone: { contains: options.search, mode: "insensitive" } },
          { tin: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (options?.status === "verified") where.verified = true;
      if (options?.status === "unverified") where.verified = false;
      if (options?.province) where.province = options.province;
      if (options?.district) where.district = options.district;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      name: true,
      email: true,
      phone: true,
      tin: true,
      location: true,
      province: true,
      district: true,
      verified: true,
      createdAt: true,
      _count: {
        select: { orders: true, subscriptions: true },
      },
    },
    formatRecord: (r) => ({
      name: r.name,
      email: r.email || "-",
      phone: r.phone || "-",
      tin: r.tin,
      location: r.location || "-",
      province: r.province || "-",
      district: r.district || "-",
      verified: r.verified,
      createdAt: r.createdAt,
      totalOrders: r._count.orders,
      totalSubscriptions: r._count.subscriptions,
    }),
    calculateStats: (records) => ({
      total: records.length,
      verified: records.filter((r) => r.verified).length,
      totalOrders: records.reduce((sum, r) => sum + r._count.orders, 0),
      totalSubscriptions: records.reduce((sum, r) => sum + r._count.subscriptions, 0),
    }),
  },
  subscriptions: {
    modelName: "restaurantSubscription",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.restaurantId) where.restaurantId = options.restaurantId;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      id: true,
      status: true,
      startDate: true,
      endDate: true,
      autoRenew: true,
      paymentMethod: true,
      paymentStatus: true,
      amountPaid: true,
      createdAt: true,
      restaurant: { select: { name: true, tin: true, phone: true } },
      farmer: { select: { phone: true, email: true } },
      plan: { select: { name: true } },
    },
    formatRecord: (s) => ({
      subscriptionPlan: s.plan?.name || s.id,
      restaurantName: s.restaurant?.name || "-",
      restaurantTIN: s.restaurant?.tin || "-",
      restaurantPhone: s.restaurant?.phone || "-",
      farmerPhone: s.farmer?.phone || "-",
      subscriptionStatus: s.status,
      startDate: formatDate(s.startDate),
      endDate: formatDate(s.endDate),
      paymentMethod: s.paymentMethod || "-",
      paymentStatus: s.paymentStatus,
      amountPaid: s.amountPaid || 0,
    }),
    calculateStats: (records, formatted) => ({
      total: records.length,
      active: records.filter((s) => s.status === "ACTIVE").length,
      autoRenew: records.filter((s) => s.autoRenew).length,
      totalAmountPaid: formatted.reduce((sum, s) => sum + (s.amountPaid || 0), 0),
    }),
  },
  wallets: {
    modelName: "wallet",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status === "active") where.isActive = true;
      if (options?.status === "inactive") where.isActive = false;
      if (options?.restaurantId) where.restaurantId = options.restaurantId;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      restaurant: { select: { name: true, tin: true, phone: true } },
      _count: { select: { transactions: true } },
    },
    formatRecord: (w) => ({
      restaurantName: w.restaurant?.name || "-",
      restaurantTIN: w.restaurant?.tin || "-",
      restaurantPhone: w.restaurant?.phone || "-",
      balance: w.balance || 0,
      currency: w.currency || "RWF",
      isActive: w.isActive,
      totalTransactions: w._count?.transactions || 0,
      createdAt: w.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      active: records.filter((w) => w.isActive).length,
      totalBalance: records.reduce((sum, w) => sum + (w.balance || 0), 0),
    }),
  },
  payments: {
    modelName: "order",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status && options.status !== "ALL") {
        where.paymentStatus = options.status;
      }
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      orderNumber: true,
      totalAmount: true,
      paymentMethod: true,
      transactionId: true,
      paidAt: true,
      createdAt: true,
      restaurant: { select: { name: true } },
    },
    formatRecord: (payment) => ({
      orderNumber: payment.orderNumber,
      restaurantName: payment.restaurant?.name || "-",
      totalAmount: payment.totalAmount || 0,
      paymentMethod: payment.paymentMethod || "-",
      transactionId: payment.transactionId || "-",
      paidAt: payment.paidAt || payment.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      totalAmount: records.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    }),
  },
  products: {
    modelName: "product",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.category) where.categoryId = options.category;
      if (options?.search) {
        where.OR = [
          { productName: { contains: options.search, mode: "insensitive" } },
          { sku: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      tableTronicProductId: true,
      productName: true,
      unitPrice: true,
      purchasePrice: true,
      quantity: true,
      unit: true,
      status: true,
      createdAt: true,
      category: { select: { name: true } },
      admin: { select: { username: true } },
    },
    formatRecord: (p) => ({
      productName: p.productName,
      categoryName: p.category?.name || "-",
      unitPrice: p.unitPrice || 0,
      purchasePrice: p.purchasePrice || 0,
      quantity: p.quantity || 0,
      unit: p.unit || "-",
      status: p.status,
      createdBy: p.admin?.username || "-",
      createdAt: p.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      active: records.filter((p) => p.status === "ACTIVE").length,
      totalValue: records.reduce(
        (sum, p) => sum + (p.unitPrice || 0) * (p.quantity || 0),
        0
      ),
    }),
  },
  farmers: {
    modelName: "farmer",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.search) {
        where.OR = [
          { name: { contains: options.search, mode: "insensitive" } },
          { phone: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (options?.province) where.province = options.province;
      if (options?.district) where.district = options.district;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      name: true,
      phone: true,
      email: true,
      location: true,
      province: true,
      district: true,
      phoneVerified: true,
      createdAt: true,
      _count: {
        select: {
          submissions: true,
        },
      },
    },
    formatRecord: (f) => ({
      farmerName: f.name || "-",
      farmerPhone: f.phone || "-",
      farmerEmail: f.email || "-",
      location: f.location || "-",
      province: f.province || "-",
      district: f.district || "-",
      phoneVerified: f.phoneVerified,
      totalSubmissions: f._count.submissions,
      createdAt: f.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      verified: records.filter((f) => f.phoneVerified).length,
      totalSubmissions: records.reduce((sum, f) => sum + f._count.submissions, 0),
    }),
  },
  logistics: {
    modelName: "admin",
    buildWhere: (options, dateFilter) => {
      const where: any = { role: "LOGISTICS" };
      if (options?.search) {
        where.OR = [
          { username: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
          { phone: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      username: true,
      email: true,
      phone: true,
      location: true,
      createdAt: true,
    },
    formatRecord: (l) => l,
    calculateStats: (records) => ({
      total: records.length,
      locations: new Set(records.map((l) => l.location).filter(Boolean)).size,
    }),
  },
  aggregators: {
    modelName: "admin",
    buildWhere: (options, dateFilter) => {
      const where: any = { role: "AGGREGATOR" };
      if (options?.search) {
        where.OR = [
          { username: { contains: options.search, mode: "insensitive" } },
          { email: { contains: options.search, mode: "insensitive" } },
          { phone: { contains: options.search, mode: "insensitive" } },
        ];
      }
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      username: true,
      email: true,
      phone: true,
      location: true,
      createdAt: true,
    },
    formatRecord: (a) => a,
    calculateStats: (records) => ({
      total: records.length,
      locations: new Set(records.map((a) => a.location).filter(Boolean)).size,
    }),
  },
  loans: {
    modelName: "loanApplication",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.restaurantId) where.restaurantId = options.restaurantId;
      if (options?.farmerId) where.farmerId = options.farmerId;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      requestedAmount: true,
      approvedAmount: true,
      purpose: true,
      status: true,
      repaymentDays: true,
      disbursementDate: true,
      repaymentDueDate: true,
      createdAt: true,
      restaurant: { select: { name: true } },
      farmer: { select: { name: true } },
    },
    formatRecord: (l) => ({
      applicantName: l.restaurant?.name || l.farmer?.name || "-",
      requestedAmount: l.requestedAmount || 0,
      approvedAmount: l.approvedAmount || 0,
      status: l.status,
      purpose: l.purpose || "-",
      repaymentDays: l.repaymentDays || 7,
      disbursementDate: l.disbursementDate,
      repaymentDueDate: l.repaymentDueDate,
      createdAt: l.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      pending: records.filter((l) => l.status === "PENDING").length,
      approved: records.filter((l) => l.status === "APPROVED").length,
      totalRequested: records.reduce((sum, l) => sum + (l.requestedAmount || 0), 0),
      totalApproved: records.reduce((sum, l) => sum + (l.approvedAmount || 0), 0),
    }),
  },
  deposits: {
    modelName: "walletTransaction",
    buildWhere: (options, dateFilter) => {
      const where: any = { type: "TOP_UP" };
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.restaurantId) where.restaurantId = options.restaurantId;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      flwTxRef: true,
      amount: true,
      paymentMethod: true,
      status: true,
      description: true,
      createdAt: true,
      wallet: {
        select: {
          restaurant: { select: { name: true, tin: true } },
        },
      },
    },
    formatRecord: (d) => ({
      transactionRef: d.flwTxRef || "-",
      restaurantName: d.wallet?.restaurant?.name || "-",
      restaurantTIN: d.wallet?.restaurant?.tin || "-",
      amount: d.amount || 0,
      paymentMethod: d.paymentMethod || "-",
      status: d.status,
      description: d.description || "Wallet Deposit",
      createdAt: d.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      completed: records.filter((d) => d.status === "COMPLETED").length,
      totalDeposits: records.reduce((sum, d) => sum + (d.amount || 0), 0),
    }),
  },
  transactions: {
    modelName: "walletTransaction",
    buildWhere: (options, dateFilter) => {
      const where: any = {};
      if (options?.type && options.type !== "ALL") {
        where.type = options.type;
      }
      if (options?.status && options.status !== "ALL") {
        where.status = options.status;
      }
      if (options?.restaurantId) where.restaurantId = options.restaurantId;
      if (dateFilter) where.createdAt = dateFilter;
      return where;
    },
    select: {
      flwTxRef: true,
      type: true,
      amount: true,
      previousBalance: true,
      newBalance: true,
      paymentMethod: true,
      status: true,
      description: true,
      createdAt: true,
      wallet: {
        select: {
          restaurant: { select: { name: true, tin: true } },
        },
      },
    },
    formatRecord: (t) => ({
      transactionRef: t.flwTxRef || "-",
      restaurantName: t.wallet?.restaurant?.name || "-",
      type: t.type,
      amount: t.amount,
      previousBalance: t.previousBalance,
      newBalance: t.newBalance,
      paymentMethod: t.paymentMethod || "-",
      status: t.status,
      description: t.description || "-",
      createdAt: t.createdAt,
    }),
    calculateStats: (records) => ({
      total: records.length,
      completed: records.filter((t) => t.status === "COMPLETED").length,
      totalAmount: records.reduce((sum, t) => sum + (t.amount || 0), 0),
    }),
  },
};

export const exportDataService = async (
  type: ExportType,
  format: ExportFormat,
  options?: ExportFilterOptions
) => {
  const config = EXPORT_CONFIG[type];
  if (!config) {
    throw new Error(`Unsupported export type: ${type}`);
  }

  const dateFilter = buildDateRangeFilter(options?.startDate, options?.endDate);
  const where = config.buildWhere(options, dateFilter);

  if (options?.ids) {
    const ids = options.ids.split(",");
    where.id = { in: ids };
  }

  // @ts-ignore - dynamic model calling
  const records = await prisma[config.modelName].findMany({
    where,
    select: config.select,
    orderBy: { createdAt: "desc" },
  });

  const formattedRecords = records.map(config.formatRecord);
  const stats = config.calculateStats(records, formattedRecords);

  return await formatData(formattedRecords, format, type, stats, options);
};

// Format data based on export format
const formatData = async (
  data: any[],
  format: ExportFormat,
  type: ExportType,
  stats: any,
  options?: ExportFilterOptions
) => {
  const header = EXPORT_HEADERS[type];
  let normalized = normalizeDataDates(data, options?.dateFormat);

  if (options?.columns && typeof options.columns === "string" && options.columns.trim() !== "") {
    const selectedCols = options.columns.split(",").map((c) => c.trim()).filter(Boolean);
    if (selectedCols.length > 0) {
      normalized = normalized.map((row) => {
        const filteredRow: Record<string, any> = {};
        selectedCols.forEach((colKey) => {
          const matchKey = Object.keys(row).find(
            (k) => k.toLowerCase() === colKey.toLowerCase() || k === colKey
          );
          if (matchKey) {
            filteredRow[matchKey] = row[matchKey];
          }
        });
        return filteredRow;
      });
    }
  }

  normalized = normalized.map((row, index) => ({
    rowNumber: index + 1,
    ...row,
  }));

  switch (format) {
    case "csv":
      return generateCSV(normalized, header, stats);
    case "excel":
      return await generateExcel(normalized, header, stats);
    case "pdf":
      return await generatePDF(normalized, header, stats, options);
    case "html":
      return generateHTML(normalized, header, stats);
    default:
      throw new Error("Unsupported format");
  }
};

// Generate CSV
const generateCSV = (data: any[], header: ExportHeader, stats: any) => {
  if (data.length === 0)
    return `${header.title}\n${header.description}\n\nNo data available`;

  const headers = Object.keys(data[0]);
  const formattedHeaders = headers.map(formatHeaderTitle);
  const statsText = Object.entries(stats)
    .map(([key, value]) => `${formatHeaderTitle(key)}: ${value}`)
    .join(", ");

  const csvContent = [
    `# ${header.title}`,
    `# ${header.description}`,
    `# Statistics: ${statsText}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    formattedHeaders.join(","),
    ...data.map((row) =>
      headers
        .map((h) => {
          const value = row[h];
          return typeof value === "string"
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(",")
    ),
  ].join("\n");

  return csvContent;
};

// Generate Excel
const generateExcel = async (data: any[], header: ExportHeader, stats: any) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Export Data");

  try {
    const logoResponse = await fetch(header.logo);
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer();
      const imageId = workbook.addImage({
        buffer: Buffer.from(logoBuffer) as any,
        extension: "png",
      });

      worksheet.addImage(imageId, {
        tl: { col: 0, row: 1 },
        ext: { width: 100, height: 50 },
      });
    }
  } catch (error) {
    worksheet.getCell("A2").value = "Food Bundle Logo";
  }

  worksheet.getCell("A1").value = header.title;
  worksheet.getCell("A1").font = { bold: true, size: 16 };

  worksheet.getCell("A3").value = header.description;
  worksheet.getCell("A4").value = `Generated: ${new Date()
    .toISOString()
    .replace("T", " ")
    .substring(0, 19)} UTC`;

  let row = 6;
  worksheet.getCell(`A${row}`).value = "Summary Statistics:";
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  Object.entries(stats).forEach(([key, value]) => {
    worksheet.getCell(`A${row}`).value = formatHeaderTitle(key);
    worksheet.getCell(`B${row}`).value = value as any;
    row++;
  });

  row += 2;
  worksheet.getCell(`A${row}`).value = "Data Records:";
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  if (data.length > 0) {
    const headers = Object.keys(data[0]);

    // Add headers
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      cell.value = formatHeaderTitle(header);
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" }, // Slate 800 dark header background
      };
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    row++;

    // Add data rows
    data.forEach((item) => {
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(row, index + 1);
        cell.value = item[header] as any;
      });
      row++;
    });
  } else {
    worksheet.getCell(`A${row}`).value = "No records found matching filters.";
  }

  // Dynamic Auto-fit columns
  worksheet.columns.forEach((column: any) => {
    let maxLen = 14;
    column.eachCell({ includeEmpty: true }, (cell: any) => {
      const len = cell.value ? cell.value.toString().length : 0;
      if (len > maxLen) maxLen = len;
    });
    column.width = Math.min(maxLen + 4, 45);
  });

  return await workbook.xlsx.writeBuffer();
};

const SHORT_HEADER_TITLE_MAP: Record<string, string> = {
  rowNumber: "No.",
  name: "Restaurant",
  email: "Email",
  phone: "Phone",
  tin: "TIN",
  location: "Location",
  province: "Province",
  district: "District",
  verified: "Status",
  createdAt: "Joined",
  totalOrders: "Orders",
  totalSubscriptions: "Subscriptions",
  restaurantName: "Restaurant",
  restaurantEmail: "Email",
  restaurantPhone: "Phone",
  restaurantTIN: "TIN",
  orderNumber: "Order #",
  totalAmount: "Amount (RWF)",
  paymentStatus: "Payment",
  paymentMethod: "Method",
  transactionId: "Txn ID",
  paidAt: "Paid At",
};

const formatShortHeaderTitle = (key: string): string => {
  if (SHORT_HEADER_TITLE_MAP[key]) return SHORT_HEADER_TITLE_MAP[key];
  return formatHeaderTitle(key);
};

const formatPDFValue = (val: any): string => {
  if (val === null || val === undefined || val === "" || val === "-") {
    return "N/A";
  }
  if (typeof val === "boolean") {
    return val ? "Verified" : "Unverified";
  }
  return val.toString();
};

// Generate Professional PDF
const generatePDF = async (
  data: any[],
  header: ExportHeader,
  stats: any,
  options?: ExportOptions
) => {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const layout =
        options?.orientation === "portrait" ? "portrait" : "landscape";
      const isLandscape = layout === "landscape";
      const pageWidth = isLandscape ? 792 : 612;
      const pageHeight = isLandscape ? 612 : 792;
      const margin = 45;
      const contentWidth = pageWidth - margin * 2;

      const doc = new PDFDocument({
        layout,
        margin,
        bufferPages: true,
      });

      // Try registering custom fonts, fallback to built-in
      const fontRegular = path.join(__dirname, "..", "assets", "fonts", "Inter-Regular.ttf");
      const fontMedium = path.join(__dirname, "..", "assets", "fonts", "Inter-Medium.ttf");
      const fontBold = path.join(__dirname, "..", "assets", "fonts", "Inter-Bold.ttf");

      let BaseFont = "Helvetica";
      let BoldFont = "Helvetica-Bold";

      try {
        const fs = require('fs');
        if (fs.existsSync(fontRegular) && fs.existsSync(fontBold)) {
           doc.registerFont("Custom-Regular", fontRegular);
           doc.registerFont("Custom-Bold", fontBold);
           BaseFont = "Custom-Regular";
           BoldFont = "Custom-Bold";
        }
      } catch (e) {
        // Fallback silently
      }

      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // 1. Header Banner
      const bannerHeight = 56;
      doc
        .rect(0, 0, pageWidth, bannerHeight)
        .fill("#0f172a");

      doc
        .rect(0, 0, pageWidth, 4)
        .fill("#059669");

      let logoDrawn = false;
      try {
        const logoResponse = await fetch(header.logo);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          doc.image(Buffer.from(logoBuffer), margin, 10, { width: 90, height: 36 });
          logoDrawn = true;
        }
      } catch (error) {
        logoDrawn = false;
      }

      if (!logoDrawn) {
        doc
          .fillColor("#ffffff")
          .font(BoldFont)
          .fontSize(14)
          .text("FOOD BUNDLES", margin, 18);
      }

      doc
        .fillColor("#ffffff")
        .font(BoldFont)
        .fontSize(16)
        .text(header.title, logoDrawn ? margin + 110 : margin + 140, 14, {
          width: contentWidth - 150,
          align: "left",
        });

      doc
        .fillColor("#94a3b8")
        .font(BaseFont)
        .fontSize(8.5)
        .text(header.description, logoDrawn ? margin + 110 : margin + 140, 35, {
          width: contentWidth - 150,
          align: "left",
        });

      doc.fillColor("#1e293b");

      // 2. Summary Statistics Section
      let currentY = bannerHeight + 20;
      const nowStr = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });

      const statEntries = Object.entries(stats || {});
      const numStats = statEntries.length;
      const cols = Math.min(Math.max(numStats, 1), 4);
      const rows = Math.ceil(numStats / cols);
      const gap = 12;
      const widgetWidth = (contentWidth - (cols - 1) * gap) / cols;
      const widgetHeight = 45;

      const cardHeight = rows * widgetHeight + (rows - 1) * gap + 35;

      // doc
      //   .roundedRect(margin, currentY, contentWidth, cardHeight, 6)
      //   .fillAndStroke("#f8fafc", "#e2e8f0");

      doc
        .fillColor("#0f172a")
        .font(BoldFont)
        .fontSize(10)
        .text("Summary Overview", margin + 12, currentY + 12);

      doc
        .fillColor("#64748b")
        .font(BaseFont)
        .fontSize(8)
        .text(`Generated: ${nowStr}`, margin + 12, currentY + 12, {
          width: contentWidth - 24,
          align: "right",
        });

      statEntries.forEach(([key, value], idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const xPos = margin + 12 + col * (widgetWidth + gap);
        const yPos = currentY + 30 + row * (widgetHeight + gap);

        doc.roundedRect(xPos, yPos, widgetWidth, widgetHeight, 4)
           .fillAndStroke("#ffffff", "#e2e8f0");

        const formattedVal = typeof value === "number" ? value.toLocaleString() : String(value);

        doc.font(BaseFont).fontSize(7.5).fillColor("#64748b")
           .text(formatHeaderTitle(key).toUpperCase(), xPos + 10, yPos + 8, { width: widgetWidth - 20, align: "left" });

        doc.font(BoldFont).fontSize(12).fillColor("#059669")
           .text(formattedVal, xPos + 10, yPos + 22, { width: widgetWidth - 20, align: "left" });
      });

      currentY += cardHeight + 20;
      doc.x = margin;
      doc.y = currentY;

      // 3. Render Table
      if (data.length > 0) {
        const rawHeaders = Object.keys(data[0]);

        const tableHeaders = rawHeaders.map((h) => {
          const isNum =
            h.toLowerCase().includes("total") ||
            h.toLowerCase().includes("count") ||
            h.toLowerCase().includes("amount") ||
            h.toLowerCase().includes("balance");
          const isCenter =
            isNum ||
            h.toLowerCase().includes("verified") ||
            h.toLowerCase().includes("status") ||
            h.toLowerCase().includes("created") ||
            h.toLowerCase().includes("date");

          return {
            label: formatShortHeaderTitle(h),
            property: h,
            headerColor: "#1e293b",
            headerOpacity: 1,
            align: isCenter ? "center" : "left",
          };
        });

        const tableRows = data.map((row) =>
          rawHeaders.map((headerKey) => formatPDFValue(row[headerKey]))
        );

        const tableObj = {
          title: "",
          headers: tableHeaders,
          rows: tableRows,
        };

        await doc.table(tableObj, {
          x: margin,
          width: contentWidth,
          prepareHeader: () => doc.font(BoldFont).fontSize(9).fillColor("#ffffff"),
          prepareRow: (row: any, indexColumn?: number, indexRow?: number, rectRow?: any, rectCell?: any) => {
            doc.font(BaseFont).fontSize(9).fillColor("#1e293b");
            if (rectRow && indexColumn === 0) {
              const bg = (indexRow || 0) % 2 === 0 ? "#ffffff" : "#f8fafc";
              doc.addBackground(rectRow, bg, 1);
            }

            if (rectCell && indexColumn !== undefined && (row as any)[indexColumn]) {
               const val = (row as any)[indexColumn].toString();
               const isPositive = val === "Verified" || val === "COMPLETED" || val === "ACTIVE" || val === "APPROVED" || val === "DELIVERED";
               const isNegative = val === "Unverified" || val === "PENDING" || val === "CANCELLED" || val === "REJECTED" || val === "FAILED";

               if (isPositive || isNegative) {
                  const pillColor = isPositive ? "#dcfce7" : (val === "PENDING" ? "#fef9c3" : "#fee2e2");
                  const textColor = isPositive ? "#166534" : (val === "PENDING" ? "#854d0e" : "#991b1b");

                  doc.font(BoldFont).fontSize(8);
                  const textWidth = doc.widthOfString(val);
                  const cellCenterX = rectCell.x + rectCell.width / 2;

                  doc.roundedRect(cellCenterX - textWidth/2 - 6, rectCell.y + 2, textWidth + 12, 14, 4)
                     .fill(pillColor);

                  doc.fillColor(textColor);
               }
            }
          },
          padding: 8,
          divider: {
            header: { disabled: false, width: 1, opacity: 0.8, color: "#0f172a" },
            horizontal: { disabled: false, width: 0.5, opacity: 0.3, color: "#cbd5e1" },
          },
        });
      } else {
        doc
          .font(BaseFont)
          .fontSize(10)
          .fillColor("#64748b")
          .text("No records found matching filters.", margin, currentY + 10);
      }

      // 4. Footers & Repeating Headers on All Pages
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = range.start; i < range.start + totalPages; i++) {
        doc.switchToPage(i);

        // Repeating header on pages 2+
        if (i > range.start) {
           doc.rect(0, 0, pageWidth, 4).fill("#059669");
           doc.font(BoldFont).fontSize(9).fillColor("#64748b")
              .text(`${header.title} (Continued)`, margin, 15, { align: "left" });
           doc.font(BaseFont).fontSize(8).fillColor("#94a3b8")
              .text(nowStr, pageWidth - margin - 150, 15, { width: 150, align: "right" });

           doc.moveTo(margin, 30)
              .lineTo(pageWidth - margin, 30)
              .lineWidth(0.5)
              .strokeColor("#e2e8f0")
              .stroke();
        }

        const footerY = pageHeight - 22;

        // Footer Top Line
        doc
          .moveTo(margin, footerY - 5)
          .lineTo(pageWidth - margin, footerY - 5)
          .lineWidth(0.5)
          .strokeColor("#cbd5e1")
          .stroke();

        // Footer Text
        doc
          .font(BaseFont)
          .fontSize(7.5)
          .fillColor("#94a3b8")
          .text("FoodBundles Platform • Agricultural Marketplace", margin, footerY, {
            width: 250,
            align: "left",
          });

        doc.text(`Generated: ${nowStr}`, margin + 250, footerY, {
          width: contentWidth - 370,
          align: "center",
        });

        doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - margin - 100, footerY, {
          width: 100,
          align: "right",
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Generate HTML
const generateHTML = (data: any[], header: ExportHeader, stats: any) => {
  if (data.length === 0) {
    const emptyHtml = `<!DOCTYPE html><html><body><h1>${header.title}</h1><p>${header.description}</p><p>No data available</p></body></html>`;
    return Buffer.from(emptyHtml, "utf8");
  }

  const headers = Object.keys(data[0]);
  const statsHtml = Object.entries(stats)
    .map(([key, value]) => `<li><strong>${formatHeaderTitle(key)}:</strong> ${value}</li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${header.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { display: flex; align-items: center; margin-bottom: 30px; }
    .logo { max-width: 100px; height: auto; margin-right: 20px; }
    .header-content { flex: 1; }
    h1 { color: #333; margin: 0 0 10px 0; }
    .description { color: #666; font-style: italic; margin: 0; }
    .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .stats h3 { margin-top: 0; }
    .stats ul { margin: 0; padding-left: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; word-wrap: break-word; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .generated { color: #888; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${header.logo}" alt="Food Bundle Logo" class="logo">
    <div class="header-content">
      <h1>${header.title}</h1>
      <p class="description">${header.description}</p>
    </div>
  </div>
  
  <div class="stats">
    <h3>Summary Statistics</h3>
    <ul>${statsHtml}</ul>
  </div>
  
  <table>
    <thead>
      <tr>
        ${headers.map((header) => `<th>${formatHeaderTitle(header)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${data
        .map(
          (row) => `
        <tr>
          ${headers.map((header) => `<td>${row[header] || ""}</td>`).join("")}
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>
  
  <p class="generated">Generated: ${new Date().toISOString()}</p>
</body>
</html>`;

  return Buffer.from(html, "utf8");
};
