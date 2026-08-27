import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as XLSX from "xlsx";
import * as path from "path";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EXCEL_PATH = path.resolve(
  "C:\\Users\\Public\\CODE\\FB-Fb\\backups\\foodbundles_full_backup_2026-08-12T14-59-44-868Z.xlsx"
);

function parseDate(val: any): Date | null {
  if (!val || val === "" || val === null || val === undefined) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function parseJson(val: any): any {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(String(val));
  } catch {
    return null;
  }
}

function parseStringArray(val: any): string[] {
  if (val === null || val === undefined || val === "") return [];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [val];
    }
  }
  return [];
}

function parseBool(val: any): boolean {
  if (typeof val === "boolean") return val;
  if (val === null || val === undefined || val === "") return false;
  const str = String(val).toLowerCase();
  return str === "true" || str === "1" || str === "yes";
}

function parseNumber(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function getSheetData(wb: XLSX.WorkBook, sheetName: string): any[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (data.length < 2) return [];
  const headers = data[0] as string[];
  return data.slice(1).map((row: any) => {
    const obj: any = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] !== undefined ? row[i] : null;
    });
    return obj;
  });
}

function isNoDataSheet(rows: any[] | undefined): boolean {
  if (!rows || rows.length === 0) return true;
  return (
    rows.length === 1 && rows[0] && !!rows[0]["No data recorded in this table"]
  );
}

async function truncateAll() {
  console.log("Truncating all tables...");
  await pool.query("SET session_replication_role = replica;");

  const tables = [
    "WalletTransaction",
    "DelegationHistory",
    "VoucherRepayment",
    "VoucherTransaction",
    "VoucherPenalty",
    "OrderItem",
    "DeliveryOTP",
    "OrderDelivery",
    "SubscriptionPayment",
    "SubscriptionHistory",
    "RestaurantSubscription",
    "MarketPriceHistory",
    "TraderTransaction",
    "Notification",
    "NotificationRecipient",
    "OTP",
    "NewsletterCampaign",
    "NewsletterSubscriber",
    "ContactSubmission",
    "Post",
    "PromoCode",
    "Order",
    "CartItem",
    "Cart",
    "LoanApplication",
    "Voucher",
    "POSSale",
    "SupportResponse",
    "SupportTicket",
    "CallbackRequest",
    "FarmerPrimaryCrop",
    "FarmerSecurityAlert",
    "FarmerSecurityEvent",
    "FarmerSecurityQuestion",
    "FarmerLoginAttempt",
    "FarmerProfile",
    "FarmerSubmission",
    "Affiliator",
    "Product",
    "ProductUnit",
    "ProductCategory",
    "PaymentMethodConfig",
    "Wallet",
    "Market",
    "Restaurant",
    "Farmer",
    "Admin",
    "Invitation",
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`  Truncated ${table}`);
    } catch (e: any) {
      console.log(`  Skip truncate ${table}: ${e.message}`);
    }
  }

  await pool.query("SET session_replication_role = DEFAULT;");
  console.log("All tables truncated.\n");
}

// ========== PHASE 1: Independent tables ==========

async function seedAdmin(rows: any[]) {
  console.log(`Seeding Admin (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.admin.create({
        data: {
          id: r.id,
          username: r.username,
          email: r.email,
          password: r.password,
          role: r.role as any,
          phone: r.phone || null,
          location: r.location || null,
          province: r.province || null,
          district: r.district || null,
          sector: r.sector || null,
          cell: r.cell || null,
          village: r.village || null,
          agreed: parseBool(r.agreed),
          twoFactorSecret: r.twoFactorSecret || null,
          twoFactorEnabled: parseBool(r.twoFactorEnabled),
          twoFactorBackupCodes: parseStringArray(r.twoFactorBackupCodes),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Admin ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmer(rows: any[]) {
  console.log(`Seeding Farmer (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmer.create({
        data: {
          id: r.id,
          phone: r.phone || null,
          email: r.email || null,
          name: r.name || null,
          location: r.location || null,
          province: r.province || null,
          district: r.district || null,
          sector: r.sector || null,
          cell: r.cell || null,
          village: r.village || null,
          locationUpdatedAt: parseDate(r.locationUpdatedAt),
          role: (r.role as any) || "FARMER",
          preferredLanguage: r.preferredLanguage || "KINY",
          password: r.password || null,
          phoneVerified: parseBool(r.phoneVerified),
          phoneChangedAt: parseDate(r.phoneChangedAt),
          accountLocked: parseBool(r.accountLocked),
          lockedUntil: parseDate(r.lockedUntil),
          pinChangedAt: parseDate(r.pinChangedAt),
          smsNotifications: parseBool(r.smsNotifications),
          notificationFrequency: r.notificationFrequency || null,
          twoFactorSecret: r.twoFactorSecret || null,
          twoFactorEnabled: parseBool(r.twoFactorEnabled),
          twoFactorBackupCodes: parseStringArray(r.twoFactorBackupCodes),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Farmer ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedProductCategory(rows: any[]) {
  console.log(`Seeding ProductCategory (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.productCategory.create({
        data: {
          id: r.id,
          tableTronicCategoryId: parseNumber(r.tableTronicCategoryId),
          name: r.name,
          description: r.description || null,
          isActive: parseBool(r.isActive),
          createdBy: r.createdBy,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip ProductCategory ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedProductUnit(rows: any[]) {
  console.log(`Seeding ProductUnit (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.productUnit.create({
        data: {
          id: r.id,
          tableTronicUnitId: parseNumber(r.tableTronicUnitId),
          name: r.name,
          description: r.description || null,
          isActive: parseBool(r.isActive),
          createdBy: r.createdBy,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip ProductUnit ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedSubscriptionPlan(rows: any[]) {
  console.log(`Seeding SubscriptionPlan (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.subscriptionPlan.create({
        data: {
          id: r.id,
          name: r.name,
          description: r.description || null,
          price: r.price,
          duration: r.duration,
          isActive: parseBool(r.isActive),
          voucherAccess: parseBool(r.voucherAccess),
          voucherPaymentDays: r.voucherPaymentDays || 30,
          freeDelivery: parseBool(r.freeDelivery),
          stablePricing: parseBool(r.stablePricing),
          receiveEBM: parseBool(r.receiveEBM),
          advertisingAccess: parseBool(r.advertisingAccess),
          otherServices: parseBool(r.otherServices),
          features: parseStringArray(r.features),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip SubscriptionPlan ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedPaymentMethodConfig(rows: any[]) {
  console.log(`Seeding PaymentMethodConfig (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.paymentMethodConfig.create({
        data: {
          id: r.id,
          tableTronicPaymentMethodId: parseNumber(r.tableTronicPaymentMethodId),
          name: r.name,
          description: r.description || null,
          isActive: parseBool(r.isActive),
          createdBy: r.createdBy,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip PaymentMethodConfig ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== PHASE 2: Tables depending on Phase 1 ==========

async function seedRestaurant(rows: any[]) {
  console.log(`Seeding Restaurant (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.restaurant.create({
        data: {
          id: r.id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          tin: r.tin || "",
          location: r.location || null,
          province: r.province || null,
          district: r.district || null,
          sector: r.sector || null,
          cell: r.cell || null,
          village: r.village || null,
          password: r.password,
          ussdPin: r.ussdPin || null,
          role: (r.role as any) || "RESTAURANT",
          verified: parseBool(r.verified),
          agreed: parseBool(r.agreed),
          preferredLanguage: r.preferredLanguage || "KINY",
          twoFactorSecret: r.twoFactorSecret || null,
          twoFactorEnabled: parseBool(r.twoFactorEnabled),
          twoFactorBackupCodes: parseStringArray(r.twoFactorBackupCodes),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Restaurant ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedProduct(rows: any[]) {
  console.log(`Seeding Product (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.product.create({
        data: {
          id: r.id,
          tableTronicProductId: parseNumber(r.tableTronicProductId),
          unitPrice: r.unitPrice,
          restaurantPrice: parseNumber(r.restaurantPrice) || 0,
          hotelPrice: parseNumber(r.hotelPrice) || 0,
          purchasePrice: r.purchasePrice,
          unit: r.unit,
          unitId: r.unitId || null,
          bonus: r.bonus || 0,
          createdBy: r.createdBy,
          expiryDate: parseDate(r.expiryDate),
          images: parseStringArray(r.images),
          quantity: r.quantity || 0,
          sku: r.sku,
          categoryId: r.categoryId,
          productName: r.productName,
          status: (r.status as any) || "ACTIVE",
          inactiveReason: r.inactiveReason || null,
          province: r.province || null,
          district: r.district || null,
          sector: r.sector || null,
          cell: r.cell || null,
          village: r.village || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Product ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== PHASE 3: More dependent tables ==========

async function seedAffiliator(rows: any[]) {
  console.log(`Seeding Affiliator (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.affiliator.create({
        data: {
          id: r.id,
          name: r.name,
          email: r.email || null,
          phone: r.phone || null,
          restaurantId: r.restaurantId,
          password: r.password,
          role: (r.role as any) || "AFFILIATOR",
          twoFactorSecret: r.twoFactorSecret || null,
          twoFactorEnabled: parseBool(r.twoFactorEnabled),
          twoFactorBackupCodes: parseStringArray(r.twoFactorBackupCodes),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Affiliator ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerSubmission(rows: any[]) {
  console.log(`Seeding FarmerSubmission (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerSubmission.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          productName: r.productName,
          submittedQty: parseNumber(r.submittedQty),
          acceptedQty: parseNumber(r.acceptedQty),
          totalAmount: parseNumber(r.totalAmount),
          categoryId: r.categoryId || null,
          status: (r.status as any) || "PENDING",
          farmerFeedbackStatus: r.farmerFeedbackStatus as any || "PENDING",
          farmerFeedbackAt: parseDate(r.farmerFeedbackAt),
          farmerFeedbackNotes: r.farmerFeedbackNotes || null,
          farmerCounterOffer: parseNumber(r.farmerCounterOffer),
          farmerCounterQty: parseNumber(r.farmerCounterQty),
          feedbackDeadline: parseDate(r.feedbackDeadline),
          aggregatorId: r.aggregatorId || null,
          submittedAt: parseDate(r.submittedAt) || new Date(),
          verifiedAt: parseDate(r.verifiedAt),
          approvedAt: parseDate(r.approvedAt),
          paidAt: parseDate(r.paidAt),
          acceptedPrice: parseNumber(r.acceptedPrice),
          approvedProductId: r.approvedProductId || null,
          wishedPrice: parseNumber(r.wishedPrice),
          paymentMethod: r.paymentMethod || null,
          location: r.location || null,
          province: r.province || null,
          district: r.district || null,
          sector: r.sector || null,
          cell: r.cell || null,
          village: r.village || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerSubmission ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedWallet(rows: any[]) {
  console.log(`Seeding Wallet (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.wallet.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId || null,
          traderId: r.traderId || null,
          balance: r.balance || 0,
          currency: r.currency || "RWF",
          isActive: parseBool(r.isActive),
          commission: parseNumber(r.commission) || 3,
          commissionMode: (r.commissionMode as any) || "NORMAL",
          commissionModeChangedAt: parseDate(r.commissionModeChangedAt),
          lastMonthlyCommissionDate: parseDate(r.lastMonthlyCommissionDate),
          pendingApprovedAmount: r.pendingApprovedAmount || 0,
          commissionEarned: r.commissionEarned || 0,
          canTradeOnBehalf: parseBool(r.canTradeOnBehalf),
          delegationStatus: (r.delegationStatus as any) || "NORMAL",
          delegationRequestedAt: parseDate(r.delegationRequestedAt),
          delegationApprovedAt: parseDate(r.delegationApprovedAt),
          delegationApprovedBy: r.delegationApprovedBy || null,
          delegationAcceptedAt: parseDate(r.delegationAcceptedAt),
          totalDeposited: r.totalDeposited || 0,
          pendingWithdrawBalance: r.pendingWithdrawBalance || 0,
          pendingWithdrawCommission: r.pendingWithdrawCommission || 0,
          totalWithdrawn: r.totalWithdrawn || 0,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Wallet ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedMarket(rows: any[]) {
  console.log(`Seeding Market (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.market.create({
        data: {
          id: r.id,
          name: r.name,
          createdBy: r.createdBy,
          location: r.location || null,
          province: r.province || null,
          district: r.district || null,
          isActive: parseBool(r.isActive),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Market ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedNewsletterSubscriber(rows: any[]) {
  console.log(`Seeding NewsletterSubscriber (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.newsletterSubscriber.create({
        data: {
          id: r.id,
          email: r.email,
          name: r.name || null,
          phone: r.phone || null,
          restaurantId: r.restaurantId || null,
          isActive: parseBool(r.isActive),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip NewsletterSubscriber ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedPost(rows: any[]) {
  console.log(`Seeding Post (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.post.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId,
          content: r.content,
          images: parseStringArray(r.images),
          videos: parseStringArray(r.videos),
          isActive: parseBool(r.isActive),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Post ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== PHASE 4: More dependent tables ==========

async function seedCartItem(rows: any[]) {
  console.log(`Seeding CartItem (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.cartItem.create({
        data: {
          id: r.id,
          cartId: r.cartId,
          productId: r.productId,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          subtotal: r.subtotal,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip CartItem ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedCart(rows: any[]) {
  console.log(`Seeding Cart (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.cart.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId,
          totalAmount: r.totalAmount || 0,
          status: (r.status as any) || "ACTIVE",
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Cart ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedWalletTransaction(rows: any[]) {
  console.log(`Seeding WalletTransaction (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.walletTransaction.create({
        data: {
          id: r.id,
          walletId: r.walletId,
          adminId: r.adminId || null,
          restaurantId: r.restaurantId || null,
          affiliatorId: r.affiliatorId || null,
          traderId: r.traderId || null,
          type: r.type as any,
          amount: r.amount,
          previousBalance: r.previousBalance,
          newBalance: r.newBalance,
          description: r.description || null,
          reference: r.reference || null,
          flwTxRef: r.flwTxRef || null,
          flwRef: r.flwRef || null,
          flwStatus: r.flwStatus || null,
          flwMessage: r.flwMessage || null,
          paymentMethod: r.paymentMethod || null,
          externalTxId: r.externalTxId || null,
          withdrawType: r.withdrawType as any || null,
          accountNumber: r.accountNumber || null,
          accountName: r.accountName || null,
          otp: r.otp || null,
          otpExpiresAt: parseDate(r.otpExpiresAt),
          otpVerified: parseBool(r.otpVerified),
          approvedBy: r.approvedBy || null,
          approvedAt: parseDate(r.approvedAt),
          paymentProofImage: r.paymentProofImage || null,
          isReversed: parseBool(r.isReversed),
          status: (r.status as any) || "PENDING",
          metadata: parseJson(r.metadata),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip WalletTransaction ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedDelegationHistory(rows: any[]) {
  console.log(`Seeding DelegationHistory (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.delegationHistory.create({
        data: {
          id: r.id,
          walletId: r.walletId,
          action: r.action || "REQUESTED",
          startedAt: parseDate(r.startedAt) || new Date(),
          endedAt: parseDate(r.endedAt),
          reason: r.reason || null,
          approvedBy: r.approvedBy || null,
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip DelegationHistory ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedOTP(rows: any[]) {
  console.log(`Seeding OTP (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.oTP.create({
        data: {
          id: r.id,
          phone: r.phone,
          otp: String(r.otp),
          purpose: r.purpose as any,
          verified: parseBool(r.verified),
          expiresAt: parseDate(r.expiresAt) || new Date(),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip OTP ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedNotificationRecipient(rows: any[]) {
  console.log(`Seeding NotificationRecipient (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.notificationRecipient.create({
        data: {
          id: r.id,
          name: r.name,
          phoneNumber: r.phoneNumber,
          category: r.category as any,
          isActive: parseBool(r.isActive),
          createdBy: r.createdBy || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip NotificationRecipient ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedContactSubmission(rows: any[]) {
  console.log(`Seeding ContactSubmission (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.contactSubmission.create({
        data: {
          id: r.id,
          name: r.name,
          email: r.email,
          message: r.message || "",
          status: r.status || "unread",
          response: r.response || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip ContactSubmission ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== PHASE 5: Order-dependent tables ==========

async function seedOrder(rows: any[]) {
  console.log(`Seeding Order (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.order.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId,
          orderedBy: r.orderedBy || null,
          logisticsId: r.logisticsId || null,
          orderNumber: r.orderNumber,
          status: (r.status as any) || "PENDING",
          totalAmount: r.totalAmount,
          originalAmount: parseNumber(r.originalAmount),
          cartId: r.cartId || null,
          billingName: r.billingName || null,
          billingEmail: r.billingEmail || null,
          billingPhone: r.billingPhone || null,
          billingAddress: r.billingAddress || null,
          notes: r.notes || null,
          requestedDelivery: parseDate(r.requestedDelivery),
          estimatedDelivery: parseDate(r.estimatedDelivery),
          actualDelivery: parseDate(r.actualDelivery),
          deliveryFee: parseNumber(r.deliveryFee) || 0,
          packagingFee: parseNumber(r.packagingFee) || 0,
          paymentMethod: r.paymentMethod || null,
          paymentStatus: (r.paymentStatus as any) || "PENDING",
          paymentReference: r.paymentReference || null,
          paymentProvider: r.paymentProvider || "FLUTTERWAVE",
          paymentType: r.paymentType || null,
          txRef: r.txRef || null,
          flwRef: r.flwRef || null,
          txOrderId: r.txOrderId || null,
          currency: r.currency || "RWF",
          clientIp: r.clientIp || null,
          deviceFingerprint: r.deviceFingerprint || null,
          narration: r.narration || null,
          transferReference: r.transferReference || null,
          transferAccount: r.transferAccount || null,
          transferBank: r.transferBank || null,
          transferNote: r.transferNote || null,
          transferAmount: parseNumber(r.transferAmount),
          network: r.network || null,
          voucherCode: r.voucherCode || null,
          voucherId: r.voucherId || null,
          voucher: r.voucher || null,
          cardNumber: r.cardNumber || null,
          cardCVV: r.cardCVV || null,
          cardType: r.cardType || null,
          cardExpiryMonth: r.cardExpiryMonth || null,
          cardExpiryYear: r.cardExpiryYear || null,
          cardPIN: r.cardPIN || null,
          redirectUrl: r.redirectUrl || null,
          authorizationMode: r.authorizationMode || null,
          transactionId: r.transactionId || null,
          ebmReference: r.ebmReference || null,
          flwStatus: r.flwStatus || null,
          appFee: parseNumber(r.appFee),
          merchantFee: parseNumber(r.merchantFee),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
          paidAt: parseDate(r.paidAt),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Order ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedLoanApplication(rows: any[]) {
  console.log(`Seeding LoanApplication (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.loanApplication.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          requestedAmount: r.requestedAmount,
          purpose: r.purpose || null,
          repaymentDays: parseNumber(r.repaymentDays),
          status: (r.status as any) || "PENDING",
          approvedAmount: parseNumber(r.approvedAmount),
          approvedBy: r.approvedBy || null,
          managedBy: r.managedBy || null,
          disbursementDate: parseDate(r.disbursementDate),
          repaymentDueDate: parseDate(r.repaymentDueDate),
          notes: r.notes || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
          approvedAt: parseDate(r.approvedAt),
        },
      });
    } catch (e: any) {
      console.log(`  Skip LoanApplication ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedVoucher(rows: any[]) {
  console.log(`Seeding Voucher (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.voucher.create({
        data: {
          id: r.id,
          voucherCode: r.voucherCode,
          voucherType: r.voucherType as any,
          discountPercentage: r.discountPercentage,
          creditLimit: r.creditLimit,
          currency: (r.currency as any) || "RWF",
          totalCredit: r.totalCredit,
          usedCredit: r.usedCredit || 0,
          remainingCredit: r.remainingCredit,
          paidAmount: parseNumber(r.paidAmount) || 0,
          remainingAmount: parseNumber(r.remainingAmount) || 0,
          commission: parseNumber(r.commission) || 0,
          status: (r.status as any) || "ACTIVE",
          expiryDate: parseDate(r.expiryDate),
          issuedDate: parseDate(r.issuedDate) || new Date(),
          approvedBy: r.approvedBy || null,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          loanId: r.loanId || null,
          repaymentDays: parseNumber(r.repaymentDays) || 7,
          serviceFeeRate: parseNumber(r.serviceFeeRate) || 0,
          usedAt: parseDate(r.usedAt),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Voucher ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedNotification(rows: any[]) {
  console.log(`Seeding Notification (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.notification.create({
        data: {
          id: r.id,
          title: r.title,
          message: r.message,
          eventType: r.eventType as any,
          targetType: r.targetType as any,
          targetId: r.targetId || null,
          targetRole: r.targetRole as any || null,
          isRead: parseBool(r.isRead),
          metadata: parseJson(r.metadata),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Notification ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedNewsletterCampaign(rows: any[]) {
  console.log(`Seeding NewsletterCampaign (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.newsletterCampaign.create({
        data: {
          id: r.id,
          subject: r.subject,
          content: r.content,
          status: (r.status as any) || "DRAFT",
          sentAt: parseDate(r.sentAt),
          sentBy: r.sentBy,
          recipientCount: r.recipientCount || 0,
          openCount: r.openCount || 0,
          clickCount: r.clickCount || 0,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip NewsletterCampaign ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedTraderTransaction(rows: any[]) {
  console.log(`Seeding TraderTransaction (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.traderTransaction.create({
        data: {
          id: r.id,
          traderId: r.traderId,
          type: r.type as any,
          amount: r.amount,
          orderId: r.orderId || null,
          voucherId: r.voucherId || null,
          loanId: r.loanId || null,
          reference: r.reference || null,
          isCommissionPaid: parseBool(r.isCommissionPaid),
          commissionRate: parseNumber(r.commissionRate),
          description: r.description || null,
          metadata: parseJson(r.metadata),
          status: (r.status as any) || "COMPLETED",
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip TraderTransaction ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedSupportTicket(rows: any[]) {
  console.log(`Seeding SupportTicket (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.supportTicket.create({
        data: {
          id: r.id,
          ticketNumber: r.ticketNumber,
          farmerId: r.farmerId,
          category: r.category,
          description: r.description,
          priority: r.priority,
          status: r.status || "OPEN",
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip SupportTicket ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== PHASE 6: Leaf tables ==========

async function seedOrderItem(rows: any[]) {
  console.log(`Seeding OrderItem (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.orderItem.create({
        data: {
          id: r.id,
          orderId: r.orderId,
          productId: r.productId || null,
          productName: r.productName,
          quantity: r.quantity,
          unitPrice: r.unitPrice,
          subtotal: r.subtotal || r.quantity * r.unitPrice,
          unit: r.unit,
          images: parseStringArray(r.images),
          category: r.category || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip OrderItem ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedDeliveryOTP(rows: any[]) {
  console.log(`Seeding DeliveryOTP (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.deliveryOTP.create({
        data: {
          id: r.id,
          orderId: r.orderId,
          otp: String(r.otp),
          expiresAt: parseDate(r.expiresAt) || new Date(),
          attempts: r.attempts || 0,
          isUsed: parseBool(r.isUsed),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip DeliveryOTP ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedOrderDelivery(rows: any[]) {
  console.log(`Seeding OrderDelivery (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.orderDelivery.create({
        data: {
          id: r.id,
          orderId: r.orderId,
          logisticsId: r.logisticsId,
          status: (r.status as any) || "PENDING",
          otpVerified: parseBool(r.otpVerified),
          deliveryDate: parseDate(r.deliveryDate),
          notes: r.notes || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip OrderDelivery ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedSubscriptionPayment(rows: any[]) {
  console.log(`Seeding SubscriptionPayment (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.subscriptionPayment.create({
        data: {
          id: r.id,
          subscriptionId: r.subscriptionId,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          paymentStatus: (r.paymentStatus as any) || "PENDING",
          txRef: r.txRef || null,
          flwRef: r.flwRef || null,
          transactionId: r.transactionId || null,
          flwStatus: r.flwStatus || null,
          flwMessage: r.flwMessage || null,
          paidAt: parseDate(r.paidAt),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip SubscriptionPayment ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedSubscriptionHistory(rows: any[]) {
  console.log(`Seeding SubscriptionHistory (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.subscriptionHistory.create({
        data: {
          id: r.id,
          subscriptionId: r.subscriptionId,
          action: r.action as any,
          oldStatus: r.oldStatus as any || null,
          newStatus: r.newStatus as any || null,
          oldPlanId: r.oldPlanId || null,
          newPlanId: r.newPlanId || null,
          reason: r.reason || null,
          performedBy: r.performedBy || null,
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip SubscriptionHistory ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedRestaurantSubscription(rows: any[]) {
  console.log(`Seeding RestaurantSubscription (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.restaurantSubscription.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          planId: r.planId,
          status: (r.status as any) || "ACTIVE",
          startDate: parseDate(r.startDate) || new Date(),
          endDate: parseDate(r.endDate) || new Date(),
          autoRenew: parseBool(r.autoRenew),
          paymentMethod: r.paymentMethod || null,
          paymentStatus: (r.paymentStatus as any) || "PENDING",
          expiryWarningSent: parseBool(r.expiryWarningSent),
          txRef: r.txRef || null,
          flwRef: r.flwRef || null,
          transactionId: r.transactionId || null,
          amountPaid: parseNumber(r.amountPaid),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip RestaurantSubscription ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedVoucherTransaction(rows: any[]) {
  console.log(`Seeding VoucherTransaction (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.voucherTransaction.create({
        data: {
          id: r.id,
          voucherId: r.voucherId,
          orderId: r.orderId,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          originalAmount: r.originalAmount,
          discountPercentage: r.discountPercentage,
          discountAmount: r.discountAmount,
          amountCharged: r.amountCharged,
          serviceFee: r.serviceFee,
          totalDeducted: r.totalDeducted,
          transactionDate: parseDate(r.transactionDate) || new Date(),
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip VoucherTransaction ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedVoucherRepayment(rows: any[]) {
  console.log(`Seeding VoucherRepayment (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.voucherRepayment.create({
        data: {
          id: r.id,
          voucherId: r.voucherId || null,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          loanId: r.loanId,
          amount: r.amount,
          paymentMethod: r.paymentMethod,
          paymentReference: r.paymentReference || null,
          allocatedToPrincipal: r.allocatedToPrincipal,
          allocatedToServiceFee: r.allocatedToServiceFee,
          allocatedToPenalty: r.allocatedToPenalty,
          paymentDate: parseDate(r.paymentDate) || new Date(),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip VoucherRepayment ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedMarketPriceHistory(rows: any[]) {
  console.log(`Seeding MarketPriceHistory (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.marketPriceHistory.create({
        data: {
          id: r.id,
          productId: r.productId,
          marketId: r.marketId,
          ourPrice: r.ourPrice,
          marketPrice: r.marketPrice,
          recordedBy: r.recordedBy,
          recordedDate: parseDate(r.recordedDate) || new Date(),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip MarketPriceHistory ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedPromoCode(rows: any[]) {
  console.log(`Seeding PromoCode (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.promoCode.create({
        data: {
          id: r.id,
          code: r.code,
          name: r.name,
          description: r.description || null,
          type: r.type as any,
          discountType: (r.discountType as any) || "PERCENTAGE",
          discountValue: r.discountValue,
          isReusable: parseBool(r.isReusable),
          maxUsageCount: parseNumber(r.maxUsageCount),
          currentUsageCount: r.currentUsageCount || 0,
          maxUsagePerUser: parseNumber(r.maxUsagePerUser),
          minOrderAmount: parseNumber(r.minOrderAmount),
          minItemQuantity: parseNumber(r.minItemQuantity),
          applyToAllProducts: parseBool(r.applyToAllProducts),
          applicableProductIds: parseStringArray(r.applicableProductIds),
          applicableCategoryIds: parseStringArray(r.applicableCategoryIds),
          isActive: parseBool(r.isActive),
          startDate: parseDate(r.startDate),
          expiryDate: parseDate(r.expiryDate),
          usageHistory: parseJson(r.usageHistory),
          excludedRestaurants: parseJson(r.excludedRestaurants),
          includedRestaurants: parseJson(r.includedRestaurants),
          restaurantUsageCount: parseJson(r.restaurantUsageCount),
          createdBy: r.createdBy || null,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip PromoCode ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedSupportResponse(rows: any[]) {
  console.log(`Seeding SupportResponse (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.supportResponse.create({
        data: {
          id: r.id,
          ticketId: r.ticketId,
          message: r.message,
          isStaff: parseBool(r.isStaff),
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip SupportResponse ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerSecurityEvent(rows: any[]) {
  console.log(`Seeding FarmerSecurityEvent (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerSecurityEvent.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          eventType: r.eventType,
          description: r.description || null,
          ipAddress: r.ipAddress || null,
          deviceInfo: r.deviceInfo || null,
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerSecurityEvent ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerSecurityQuestion(rows: any[]) {
  console.log(`Seeding FarmerSecurityQuestion (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerSecurityQuestion.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          question: r.question,
          answerHash: r.answerHash,
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerSecurityQuestion ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerLoginAttempt(rows: any[]) {
  console.log(`Seeding FarmerLoginAttempt (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerLoginAttempt.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          successful: parseBool(r.successful),
          attemptTime: parseDate(r.attemptTime) || new Date(),
          deviceInfo: r.deviceInfo || null,
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerLoginAttempt ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerSecurityAlert(rows: any[]) {
  console.log(`Seeding FarmerSecurityAlert (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerSecurityAlert.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          alertType: r.alertType,
          description: r.description,
          severity: r.severity,
          resolved: parseBool(r.resolved),
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerSecurityAlert ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerProfile(rows: any[]) {
  console.log(`Seeding FarmerProfile (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerProfile.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          farmSize: parseNumber(r.farmSize),
          farmSizeUnit: r.farmSizeUnit || null,
          experienceYears: parseNumber(r.experienceYears),
          cooperativeMember: parseBool(r.cooperativeMember),
          cooperativeName: r.cooperativeName || null,
          certifications: parseStringArray(r.certifications),
          farmingMethod: r.farmingMethod || null,
          preferredPaymentMethod: r.preferredPaymentMethod || null,
          minimumOrderQuantity: parseNumber(r.minimumOrderQuantity),
          deliveryPreference: r.deliveryPreference || null,
          maxDeliveryDistance: parseNumber(r.maxDeliveryDistance),
          defaultLocation: parseJson(r.defaultLocation),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerProfile ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedFarmerPrimaryCrop(rows: any[]) {
  console.log(`Seeding FarmerPrimaryCrop (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.farmerPrimaryCrop.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          productId: r.productId,
          seasonal: parseBool(r.seasonal),
          defaultQuantity: r.defaultQuantity || 0,
          harvestMonths: parseStringArray(r.harvestMonths),
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip FarmerPrimaryCrop ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedCallbackRequest(rows: any[]) {
  console.log(`Seeding CallbackRequest (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.callbackRequest.create({
        data: {
          id: r.id,
          farmerId: r.farmerId,
          phoneNumber: r.phoneNumber,
          preferredTime: r.preferredTime,
          issue: r.issue,
          status: r.status || "PENDING",
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip CallbackRequest ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedInvitation(rows: any[]) {
  console.log(`Seeding Invitation (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.invitation.create({
        data: {
          id: r.id,
          email: r.email,
          token: r.token,
          role: r.role as any,
          expiresAt: parseDate(r.expiresAt) || new Date(),
          isUsed: parseBool(r.isUsed),
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip Invitation ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedVoucherPenalty(rows: any[]) {
  console.log(`Seeding VoucherPenalty (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.voucherPenalty.create({
        data: {
          id: r.id,
          voucherId: r.voucherId,
          restaurantId: r.restaurantId || null,
          farmerId: r.farmerId || null,
          penaltyAmount: r.penaltyAmount,
          daysOverdue: r.daysOverdue,
          penaltyRate: r.penaltyRate,
          reason: r.reason || null,
          status: (r.status as any) || "PENDING",
          appliedDate: parseDate(r.appliedDate) || new Date(),
          paidDate: parseDate(r.paidDate),
          createdAt: parseDate(r.createdAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip VoucherPenalty ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

async function seedPOSSale(rows: any[]) {
  console.log(`Seeding POSSale (${rows.length} rows)...`);
  for (const r of rows) {
    try {
      await prisma.pOSSale.create({
        data: {
          id: r.id,
          restaurantId: r.restaurantId,
          totalAmount: r.totalAmount,
          paymentMethod: r.paymentMethod,
          createdAt: parseDate(r.createdAt) || new Date(),
          updatedAt: parseDate(r.updatedAt) || new Date(),
        },
      });
    } catch (e: any) {
      console.log(`  Skip POSSale ${r.id}: ${e.message}`);
    }
  }
  console.log("  Done.");
}

// ========== MAIN ==========

async function main() {
  console.log("=== FoodBundles Database Seeder ===\n");

  console.log("Reading Excel file...");
  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`Found ${wb.SheetNames.length} sheets.\n`);

  // Truncate all tables
  await truncateAll();

  // Read all sheet data
  const sheets: Record<string, any[]> = {};
  for (const name of wb.SheetNames) {
    if (name === "BACKUP SUMMARY") continue;
    sheets[name] = getSheetData(wb, name);
  }

  // Phase 1: Independent tables
  console.log("=== PHASE 1: Independent tables ===");
  if (!isNoDataSheet(sheets["Admin"])) await seedAdmin(sheets["Admin"]);
  if (!isNoDataSheet(sheets["Farmer"])) await seedFarmer(sheets["Farmer"]);
  if (!isNoDataSheet(sheets["ProductCategory"]))
    await seedProductCategory(sheets["ProductCategory"]);
  if (!isNoDataSheet(sheets["ProductUnit"]))
    await seedProductUnit(sheets["ProductUnit"]);
  if (!isNoDataSheet(sheets["SubscriptionPlan"]))
    await seedSubscriptionPlan(sheets["SubscriptionPlan"]);
  if (!isNoDataSheet(sheets["PaymentMethodConfig"]))
    await seedPaymentMethodConfig(sheets["PaymentMethodConfig"]);

  // Phase 2: Tables depending on Phase 1
  console.log("\n=== PHASE 2: Dependent tables ===");
  if (!isNoDataSheet(sheets["Restaurant"]))
    await seedRestaurant(sheets["Restaurant"]);
  if (!isNoDataSheet(sheets["Product"])) await seedProduct(sheets["Product"]);

  // Phase 3: More dependent tables
  console.log("\n=== PHASE 3: More dependent tables ===");
  if (!isNoDataSheet(sheets["Affiliator"]))
    await seedAffiliator(sheets["Affiliator"]);
  if (!isNoDataSheet(sheets["FarmerSubmission"]))
    await seedFarmerSubmission(sheets["FarmerSubmission"]);
  if (!isNoDataSheet(sheets["FarmerSecurityEvent"]))
    await seedFarmerSecurityEvent(sheets["FarmerSecurityEvent"]);
  if (!isNoDataSheet(sheets["FarmerSecurityQuestion"]))
    await seedFarmerSecurityQuestion(sheets["FarmerSecurityQuestion"]);
  if (!isNoDataSheet(sheets["FarmerLoginAttempt"]))
    await seedFarmerLoginAttempt(sheets["FarmerLoginAttempt"]);
  if (!isNoDataSheet(sheets["FarmerSecurityAlert"]))
    await seedFarmerSecurityAlert(sheets["FarmerSecurityAlert"]);
  if (!isNoDataSheet(sheets["FarmerProfile"]))
    await seedFarmerProfile(sheets["FarmerProfile"]);
  if (!isNoDataSheet(sheets["FarmerPrimaryCrop"]))
    await seedFarmerPrimaryCrop(sheets["FarmerPrimaryCrop"]);
  if (!isNoDataSheet(sheets["Wallet"])) await seedWallet(sheets["Wallet"]);
  if (!isNoDataSheet(sheets["Market"])) await seedMarket(sheets["Market"]);
  if (!isNoDataSheet(sheets["NewsletterSubscriber"]))
    await seedNewsletterSubscriber(sheets["NewsletterSubscriber"]);
  if (!isNoDataSheet(sheets["Post"])) await seedPost(sheets["Post"]);
  if (!isNoDataSheet(sheets["CallbackRequest"]))
    await seedCallbackRequest(sheets["CallbackRequest"]);
  if (!isNoDataSheet(sheets["SupportTicket"]))
    await seedSupportTicket(sheets["SupportTicket"]);

  // Phase 4: Order & payment dependent
  console.log("\n=== PHASE 4: Order & payment dependent ===");
  if (!isNoDataSheet(sheets["Cart"])) await seedCart(sheets["Cart"]);
  if (!isNoDataSheet(sheets["CartItem"])) await seedCartItem(sheets["CartItem"]);
  if (!isNoDataSheet(sheets["LoanApplication"]))
    await seedLoanApplication(sheets["LoanApplication"]);
  if (!isNoDataSheet(sheets["Voucher"])) await seedVoucher(sheets["Voucher"]);
  if (!isNoDataSheet(sheets["Order"])) await seedOrder(sheets["Order"]);
  if (!isNoDataSheet(sheets["Notification"]))
    await seedNotification(sheets["Notification"]);
  if (!isNoDataSheet(sheets["NotificationRecipient"]))
    await seedNotificationRecipient(sheets["NotificationRecipient"]);
  if (!isNoDataSheet(sheets["OTP"])) await seedOTP(sheets["OTP"]);
  if (!isNoDataSheet(sheets["contact_submissions"]))
    await seedContactSubmission(sheets["contact_submissions"]);
  if (!isNoDataSheet(sheets["NewsletterCampaign"]))
    await seedNewsletterCampaign(sheets["NewsletterCampaign"]);
  if (!isNoDataSheet(sheets["TraderTransaction"]))
    await seedTraderTransaction(sheets["TraderTransaction"]);
  if (!isNoDataSheet(sheets["WalletTransaction"]))
    await seedWalletTransaction(sheets["WalletTransaction"]);
  if (!isNoDataSheet(sheets["DelegationHistory"]))
    await seedDelegationHistory(sheets["DelegationHistory"]);

  // Phase 5: Leaf tables
  console.log("\n=== PHASE 5: Leaf tables ===");
  if (!isNoDataSheet(sheets["RestaurantSubscription"]))
    await seedRestaurantSubscription(sheets["RestaurantSubscription"]);
  if (!isNoDataSheet(sheets["OrderItem"]))
    await seedOrderItem(sheets["OrderItem"]);
  if (!isNoDataSheet(sheets["DeliveryOTP"]))
    await seedDeliveryOTP(sheets["DeliveryOTP"]);
  if (!isNoDataSheet(sheets["OrderDelivery"]))
    await seedOrderDelivery(sheets["OrderDelivery"]);
  if (!isNoDataSheet(sheets["SubscriptionPayment"]))
    await seedSubscriptionPayment(sheets["SubscriptionPayment"]);
  if (!isNoDataSheet(sheets["SubscriptionHistory"]))
    await seedSubscriptionHistory(sheets["SubscriptionHistory"]);
  if (!isNoDataSheet(sheets["VoucherTransaction"]))
    await seedVoucherTransaction(sheets["VoucherTransaction"]);
  if (!isNoDataSheet(sheets["VoucherRepayment"]))
    await seedVoucherRepayment(sheets["VoucherRepayment"]);
  if (!isNoDataSheet(sheets["VoucherPenalty"]))
    await seedVoucherPenalty(sheets["VoucherPenalty"]);
  if (!isNoDataSheet(sheets["MarketPriceHistory"]))
    await seedMarketPriceHistory(sheets["MarketPriceHistory"]);
  if (!isNoDataSheet(sheets["PromoCode"]))
    await seedPromoCode(sheets["PromoCode"]);
  if (!isNoDataSheet(sheets["SupportResponse"]))
    await seedSupportResponse(sheets["SupportResponse"]);
  if (!isNoDataSheet(sheets["POSSale"])) await seedPOSSale(sheets["POSSale"]);
  if (!isNoDataSheet(sheets["Invitation"]))
    await seedInvitation(sheets["Invitation"]);

  console.log("\n=== Seeding complete! ===");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("Seed failed:", e);
  prisma.$disconnect();
  pool.end();
  process.exit(1);
});
