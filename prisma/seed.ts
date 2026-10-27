import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PASSWORD = "Test@12345";

// ─── Data ────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: "Fresh Vegetables", description: "Leafy greens and root vegetables" },
  { name: "Fresh Fruits", description: "Seasonal and tropical fruits" },
  { name: "Animal Products", description: "Eggs, dairy, and meat" },
  { name: "Grains & Cereals", description: "Rice, maize, wheat, and legumes" },
  { name: "Herbs & Spices", description: "Fresh and dried herbs" },
];

const UNITS = [
  { name: "KG", description: "Kilogram" },
  { name: "G", description: "Gram" },
  { name: "Piece", description: "Individual piece" },
  { name: "Bunch", description: "Bundle of items" },
  { name: "Litre", description: "Litre" },
  { name: "Dozen", description: "12 pieces" },
];

const PAYMENT_METHODS = [
  { name: "MTN Mobile Money", description: "Pay via MTN MoMo" },
  { name: "Airtel Money", description: "Pay via Airtel Money" },
  { name: "Cash on Delivery", description: "Pay cash when delivered" },
  { name: "Wallet", description: "Pay from FoodBundles wallet" },
];

// 50 products: [name, category index, unit index, unitPrice, purchasePrice, qty, bonus, imageUrl]
const PRODUCTS: [string, number, number, number, number, number, number, string][] = [
  // Fresh Vegetables (0)
  ["Tomatoes", 0, 0, 1200, 800, 500, 5, "https://images.unsplash.com/photo-1546470427-e26264be0b07?w=400&q=80&fit=crop"],
  ["Onions", 0, 0, 900, 600, 400, 3, "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400&q=80&fit=crop"],
  ["Carrots", 0, 0, 1100, 750, 300, 4, "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400&q=80&fit=crop"],
  ["Cabbage", 0, 2, 1500, 1000, 200, 5, "https://images.unsplash.com/photo-1620959374050-c0cbe0af12e1?w=400&q=80&fit=crop"],
  ["Spinach", 0, 3, 800, 500, 150, 3, "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400&q=80&fit=crop"],
  ["Kale (Isombe)", 0, 3, 700, 450, 200, 3, "https://images.unsplash.com/photo-1524179091875-bf99a9a6af57?w=400&q=80&fit=crop"],
  ["Green Pepper", 0, 0, 2000, 1400, 100, 5, "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&q=80&fit=crop"],
  ["Red Pepper", 0, 0, 2200, 1500, 80, 5, "https://images.unsplash.com/photo-1596751472691-88e06e0a0e0a?w=400&q=80&fit=crop"],
  ["Eggplant", 0, 0, 1300, 900, 120, 4, "https://images.unsplash.com/photo-1504194104404-433180773017?w=400&q=80&fit=crop"],
  ["Cucumber", 0, 2, 600, 400, 300, 2, "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400&q=80&fit=crop"],
  ["Leek", 0, 3, 1000, 700, 100, 3, "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=400&q=80&fit=crop"],
  ["Garlic", 0, 0, 5000, 3500, 50, 5, "https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?w=400&q=80&fit=crop"],
  ["Ginger", 0, 0, 4000, 2800, 60, 5, "https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=400&q=80&fit=crop"],
  ["Sweet Potato", 0, 0, 700, 450, 600, 3, "https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=400&q=80&fit=crop"],
  ["Irish Potato", 0, 0, 600, 400, 800, 3, "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400&q=80&fit=crop"],
  // Fresh Fruits (1)
  ["Banana (Matoke)", 1, 3, 1500, 1000, 300, 5, "https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=400&q=80&fit=crop"],
  ["Avocado", 1, 2, 500, 300, 400, 2, "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=400&q=80&fit=crop"],
  ["Mango", 1, 2, 800, 500, 250, 3, "https://images.unsplash.com/photo-1553279768-865429fa0078?w=400&q=80&fit=crop"],
  ["Pineapple", 1, 2, 2000, 1400, 100, 5, "https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=400&q=80&fit=crop"],
  ["Passion Fruit", 1, 0, 3000, 2000, 80, 5, "https://images.unsplash.com/photo-1604025702843-3548fe5a0559?w=400&q=80&fit=crop"],
  ["Watermelon", 1, 2, 3500, 2500, 50, 5, "https://images.unsplash.com/photo-1563114773-84221bd62daa?w=400&q=80&fit=crop"],
  ["Papaya", 1, 2, 1200, 800, 120, 4, "https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=400&q=80&fit=crop"],
  ["Strawberry", 1, 0, 8000, 5500, 30, 8, "https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=400&q=80&fit=crop"],
  ["Orange", 1, 2, 600, 400, 300, 2, "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400&q=80&fit=crop"],
  ["Lemon", 1, 2, 400, 250, 400, 2, "https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=400&q=80&fit=crop"],
  // Animal Products (2)
  ["Eggs (Tray)", 2, 2, 4500, 3200, 100, 5, "https://images.unsplash.com/photo-1569288052389-dac9b01c9c05?w=400&q=80&fit=crop"],
  ["Fresh Milk", 2, 4, 1200, 800, 200, 3, "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&q=80&fit=crop"],
  ["Yoghurt (Plain)", 2, 4, 2500, 1800, 80, 5, "https://images.unsplash.com/photo-1571212515416-fca988083f22?w=400&q=80&fit=crop"],
  ["Chicken (Whole)", 2, 2, 12000, 8500, 50, 8, "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&q=80&fit=crop"],
  ["Beef (Minced)", 2, 0, 8000, 5500, 80, 8, "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&q=80&fit=crop"],
  ["Goat Meat", 2, 0, 9000, 6500, 60, 8, "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&q=80&fit=crop"],
  ["Tilapia Fish", 2, 0, 7000, 5000, 70, 8, "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=400&q=80&fit=crop"],
  ["Butter", 2, 0, 6000, 4200, 40, 5, "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=400&q=80&fit=crop"],
  ["Cheese", 2, 0, 10000, 7000, 30, 8, "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400&q=80&fit=crop"],
  ["Honey", 2, 4, 15000, 10000, 25, 10, "https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=400&q=80&fit=crop"],
  // Grains & Cereals (3)
  ["White Rice", 3, 0, 1800, 1200, 500, 3, "https://images.unsplash.com/photo-1536304993881-ff86e0c9eb62?w=400&q=80&fit=crop"],
  ["Maize Flour", 3, 0, 900, 600, 600, 3, "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400&q=80&fit=crop"],
  ["Wheat Flour", 3, 0, 1100, 750, 400, 3, "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80&fit=crop"],
  ["Red Beans", 3, 0, 1500, 1000, 300, 3, "https://images.unsplash.com/photo-1553344599-39f8a77f4a22?w=400&q=80&fit=crop"],
  ["Black Beans", 3, 0, 1600, 1100, 250, 3, "https://images.unsplash.com/photo-1612257581191-c4bf98b79c5c?w=400&q=80&fit=crop"],
  ["Sorghum", 3, 0, 1200, 800, 200, 3, "https://images.unsplash.com/photo-1601598820742-851c19f8a4f2?w=400&q=80&fit=crop"],
  ["Groundnuts", 3, 0, 2500, 1800, 150, 5, "https://images.unsplash.com/photo-1567892320421-c55e5de9f9f5?w=400&q=80&fit=crop"],
  ["Soybeans", 3, 0, 1400, 950, 200, 3, "https://images.unsplash.com/photo-1595855759920-86582396756a?w=400&q=80&fit=crop"],
  ["Lentils", 3, 0, 2000, 1400, 150, 4, "https://images.unsplash.com/photo-1547592180-85f173990554?w=400&q=80&fit=crop"],
  ["Oats", 3, 0, 3500, 2500, 80, 5, "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&q=80&fit=crop"],
  // Herbs & Spices (4)
  ["Fresh Coriander", 4, 3, 500, 300, 200, 2, "https://images.unsplash.com/photo-1599909631718-0c6a29e9614f?w=400&q=80&fit=crop"],
  ["Basil", 4, 3, 600, 400, 150, 2, "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&q=80&fit=crop"],
  ["Rosemary", 4, 3, 700, 450, 100, 2, "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80&fit=crop"],
  ["Thyme", 4, 3, 700, 450, 100, 2, "https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=400&q=80&fit=crop"],
  ["Chili (Dried)", 4, 0, 3000, 2000, 80, 5, "https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=400&q=80&fit=crop"],
];

const RESTAURANTS = [
  { name: "Kigali Kitchen", email: "kigali.kitchen@food.rw", phone: "0780100001", tin: "100000001" },
  { name: "Nyamirambo Bites", email: "nyamirambo.bites@food.rw", phone: "0780100002", tin: "100000002" },
  { name: "Kimironko Eats", email: "kimironko.eats@food.rw", phone: "0780100003", tin: "100000003" },
  { name: "Remera Grill", email: "remera.grill@food.rw", phone: "0780100004", tin: "100000004" },
  { name: "Gisozi Fresh", email: "gisozi.fresh@food.rw", phone: "0780100005", tin: "100000005" },
];

const FARMERS = [
  { name: "Jean Baptiste", email: "jean.baptiste@food.rw", phone: "0780200001" },
  { name: "Marie Claire", email: "marie.claire@food.rw", phone: "0780200002" },
  { name: "Emmanuel Nkusi", email: "emmanuel.nkusi@food.rw", phone: "0780200003" },
  { name: "Claudine Uwase", email: "claudine.uwase@food.rw", phone: "0780200004" },
  { name: "Patrick Habimana", email: "patrick.habimana@food.rw", phone: "0780200005" },
];

const SUBSCRIPTION_PLANS = [
  {
    name: "Basic",
    description: "Essential access for small restaurants",
    price: 10000,
    duration: 30,
    isActive: true,
    features: ["Order products", "Basic support"],
  },
  {
    name: "Standard",
    description: "For growing restaurants",
    price: 25000,
    duration: 30,
    isActive: true,
    voucherAccess: true,
    freeDelivery: true,
    features: ["Order products", "Voucher access", "Free delivery", "Priority support"],
  },
  {
    name: "Premium",
    description: "Full access for established restaurants",
    price: 50000,
    duration: 30,
    isActive: true,
    voucherAccess: true,
    freeDelivery: true,
    stablePricing: true,
    receiveEBM: true,
    advertisingAccess: true,
    loanAccess: true,
    features: ["All Standard features", "Stable pricing", "EBM receipts", "Advertising", "Loan access"],
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding database:", process.env.DATABASE_URL?.split("@")[1]);

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // ── Admin users ──────────────────────────────────────────────────────────
  const adminRoles: Array<{ email: string; username: string; role: any }> = [
    { email: "admin@food.rw", username: "Admin", role: "ADMIN" },
    { email: "superuser@food.rw", username: "Superuser", role: "SUPERUSER" },
    { email: "trader@food.rw", username: "Trader", role: "TRADER" },
    { email: "logistics@food.rw", username: "Logistics", role: "LOGISTICS" },
    { email: "aggregator@food.rw", username: "Aggregator", role: "AGGREGATOR" },
  ];

  for (const a of adminRoles) {
    await prisma.admin.upsert({
      where: { email: a.email },
      update: {},
      create: { username: a.username, email: a.email, password: hashedPassword, role: a.role },
    });
  }
  console.log(`✅ ${adminRoles.length} admin users seeded`);

  const admin = await prisma.admin.findUniqueOrThrow({ where: { email: "admin@food.rw" } });

  // ── Categories ───────────────────────────────────────────────────────────
  const categoryMap: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    const c = await prisma.productCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { ...cat, createdBy: admin.id },
    });
    categoryMap[cat.name] = c.id;
  }
  console.log(`✅ ${CATEGORIES.length} categories seeded`);

  // ── Units ────────────────────────────────────────────────────────────────
  const unitMap: Record<string, string> = {};
  for (const u of UNITS) {
    const unit = await prisma.productUnit.upsert({
      where: { name: u.name },
      update: {},
      create: { ...u, createdBy: admin.id },
    });
    unitMap[u.name] = unit.id;
  }
  console.log(`✅ ${UNITS.length} units seeded`);

  // ── Payment methods ──────────────────────────────────────────────────────
  for (const pm of PAYMENT_METHODS) {
    await prisma.paymentMethodConfig.upsert({
      where: { name: pm.name },
      update: {},
      create: { ...pm, createdBy: admin.id },
    });
  }
  console.log(`✅ ${PAYMENT_METHODS.length} payment methods seeded`);

  // ── Subscription plans ───────────────────────────────────────────────────
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: { isActive: true, price: plan.price, features: plan.features },
      create: plan,
    });
  }
  console.log(`✅ ${SUBSCRIPTION_PLANS.length} subscription plans seeded`);

  // ── Products (50) ────────────────────────────────────────────────────────
  const categoryNames = CATEGORIES.map((c) => c.name);
  const unitNames = UNITS.map((u) => u.name);
  let productCount = 0;

  for (const [name, catIdx, unitIdx, unitPrice, purchasePrice, quantity, bonus, imageUrl] of PRODUCTS) {
    const categoryId = categoryMap[categoryNames[catIdx]];
    const unitId = unitMap[unitNames[unitIdx]];
    const unitName = unitNames[unitIdx];
    const sku = `FB-${name.toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 12)}-${String(productCount + 1).padStart(3, "0")}`;

    await prisma.product.upsert({
      where: { productName: name },
      update: { unitPrice, purchasePrice, quantity, images: [imageUrl] },
      create: {
        productName: name,
        sku,
        unitPrice,
        restaurantPrice: Math.round(unitPrice * 1.05),
        hotelPrice: Math.round(unitPrice * 1.1),
        purchasePrice,
        unit: unitName,
        unitId,
        quantity,
        bonus,
        categoryId,
        createdBy: admin.id,
        status: "ACTIVE",
        images: [imageUrl],
      },
    });
    productCount++;
  }
  console.log(`✅ ${productCount} products seeded`);

  // ── Restaurants ──────────────────────────────────────────────────────────
  for (const r of RESTAURANTS) {
    const restaurant = await prisma.restaurant.upsert({
      where: { email: r.email },
      update: {},
      create: {
        ...r,
        password: hashedPassword,
        role: "RESTAURANT",
        verified: true,
        agreed: true,
        location: "Kigali",
        province: "Kigali City",
        district: "Gasabo",
      },
    });

    // Create wallet for each restaurant
    await prisma.wallet.upsert({
      where: { restaurantId: restaurant.id },
      update: {},
      create: { restaurantId: restaurant.id, balance: 50000 },
    });
  }
  console.log(`✅ ${RESTAURANTS.length} restaurants seeded (each with a wallet)`);

  // ── Seed restaurant (default test account) ───────────────────────────────
  const defaultRestaurant = await prisma.restaurant.upsert({
    where: { email: "restaurant@food.rw" },
    update: {},
    create: {
      name: "Test Restaurant",
      email: "restaurant@food.rw",
      phone: "0780000002",
      tin: "000000000",
      password: hashedPassword,
      role: "RESTAURANT",
      verified: true,
      agreed: true,
    },
  });
  await prisma.wallet.upsert({
    where: { restaurantId: defaultRestaurant.id },
    update: {},
    create: { restaurantId: defaultRestaurant.id, balance: 100000 },
  });

  // ── Affiliator ───────────────────────────────────────────────────────────
  await prisma.affiliator.upsert({
    where: { email: "affiliator@food.rw" },
    update: {},
    create: {
      name: "Affiliator",
      email: "affiliator@food.rw",
      phone: "0780000003",
      password: hashedPassword,
      role: "AFFILIATOR",
      restaurantId: defaultRestaurant.id,
    },
  });
  console.log("✅ Default restaurant + affiliator seeded");

  // ── Farmers ──────────────────────────────────────────────────────────────
  for (const f of FARMERS) {
    await prisma.farmer.upsert({
      where: { email: f.email },
      update: {},
      create: {
        ...f,
        password: hashedPassword,
        role: "FARMER",
        location: "Kigali",
        province: "Kigali City",
        district: "Gasabo",
        phoneVerified: true,
      },
    });
  }
  // Keep the original seed farmer too
  await prisma.farmer.upsert({
    where: { email: "farmer@food.rw" },
    update: {},
    create: {
      name: "Farmer",
      email: "farmer@food.rw",
      phone: "0780000001",
      password: hashedPassword,
      role: "FARMER",
    },
  });
  console.log(`✅ ${FARMERS.length + 1} farmers seeded`);

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n🎉 Seeding complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("All passwords: Test@12345");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("admin@food.rw            → ADMIN");
  console.log("superuser@food.rw        → SUPERUSER");
  console.log("trader@food.rw           → TRADER");
  console.log("logistics@food.rw        → LOGISTICS");
  console.log("aggregator@food.rw       → AGGREGATOR");
  console.log("farmer@food.rw           → FARMER (default)");
  console.log("restaurant@food.rw       → RESTAURANT (default)");
  console.log("affiliator@food.rw       → AFFILIATOR");
  console.log("kigali.kitchen@food.rw   → RESTAURANT");
  console.log("nyamirambo.bites@food.rw → RESTAURANT");
  console.log("kimironko.eats@food.rw   → RESTAURANT");
  console.log("remera.grill@food.rw     → RESTAURANT");
  console.log("gisozi.fresh@food.rw     → RESTAURANT");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Products: ${productCount} | Categories: ${CATEGORIES.length} | Units: ${UNITS.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
