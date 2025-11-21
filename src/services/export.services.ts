import prisma from "../prisma";
import * as ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export type ExportFormat = "pdf" | "csv" | "excel" | "html";
export type ExportType =
  | "users"
  | "orders"
  | "restaurants"
  | "payments"
  | "products"
  | "farmers"
  | "logistics"
  | "aggregators";

interface ExportHeader {
  title: string;
  description: string;
  logo: string;
}

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
};

// Export Users
export const exportUsersService = async (format: ExportFormat) => {
  const users = await prisma.restaurant.findMany({
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
  });

  const stats = {
    total: users.length,
    verified: users.filter((u) => u.verified).length,
    unverified: users.filter((u) => !u.verified).length,
    provinces: new Set(users.map((u) => u.province)).size,
  };

  return await formatData(users, format, "users", stats);
};

// Export Orders
export const exportOrdersService = async (format: ExportFormat) => {
  const orders = await prisma.order.findMany({
    select: {
      orderNumber: true,
      totalAmount: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      restaurant: { select: { name: true, email: true } },
    },
  });

  const formattedOrders = orders.map((order) => ({
    ...order,
    restaurant: order.restaurant.name,
    restaurantEmail: order.restaurant.email,
  }));

  const stats = {
    total: orders.length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    pending: orders.filter((o) => o.status === "PENDING").length,
    totalRevenue: orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
    paidOrders: orders.filter((o) => o.paymentStatus === "COMPLETED").length,
  };

  return await formatData(formattedOrders, format, "orders", stats);
};

// Export Restaurants
export const exportRestaurantsService = async (format: ExportFormat) => {
  const restaurants = await prisma.restaurant.findMany({
    select: {
      name: true,
      email: true,
      phone: true,
      tin: true,
      location: true,
      verified: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          subscriptions: true,
        },
      },
    },
  });

  const formattedRestaurants = restaurants.map((restaurant) => ({
    ...restaurant,
    totalOrders: restaurant._count.orders,
    totalSubscriptions: restaurant._count.subscriptions,
  }));

  const stats = {
    total: restaurants.length,
    verified: restaurants.filter((r) => r.verified).length,
    totalOrders: restaurants.reduce((sum, r) => sum + r._count.orders, 0),
    totalSubscriptions: restaurants.reduce(
      (sum, r) => sum + r._count.subscriptions,
      0
    ),
    activeRestaurants: restaurants.filter((r) => r._count.orders > 0).length,
  };

  return await formatData(formattedRestaurants, format, "restaurants", stats);
};

// Export Payments
export const exportPaymentsService = async (format: ExportFormat) => {
  const payments = await prisma.order.findMany({
    select: {
      orderNumber: true,
      totalAmount: true,
      paymentMethod: true,
      transactionId: true,
      paidAt: true,
      restaurant: { select: { name: true } },
    },
  });

  const formattedPayments = payments.map((payment) => ({
    ...payment,
    restaurantName: payment.restaurant.name,
  }));

  const stats = {
    total: payments.length,
    totalAmount: payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
    averageAmount:
      payments.length > 0
        ? payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0) /
          payments.length
        : 0,
    uniqueRestaurants: new Set(payments.map((p) => p.restaurant.name)).size,
    paymentMethods: Object.fromEntries(
      [...new Set(payments.map((p) => p.paymentMethod))].map((method) => [
        method,
        payments.filter((p) => p.paymentMethod === method).length,
      ])
    ),
  };

  return await formatData(formattedPayments, format, "payments", stats);
};

// Export Products
export const exportProductsService = async (format: ExportFormat) => {
  const products = await prisma.product.findMany({
    select: {
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
  });

  const formattedProducts = products.map((product) => ({
    ...product,
    categoryName: product.category.name,
    createdBy: product.admin.username,
    category: product.category.name,
  }));

  const stats = {
    total: products.length,
    active: products.filter((p) => p.status === "ACTIVE").length,
    categories: new Set(products.map((p) => p.category.name)).size,
    totalValue: products.reduce(
      (sum, p) => sum + (p.unitPrice || 0) * (p.quantity || 0),
      0
    ),
    lowStock: products.filter((p) => (p.quantity || 0) < 10).length,
    averagePrice:
      products.length > 0
        ? products.reduce((sum, p) => sum + (p.unitPrice || 0), 0) /
          products.length
        : 0,
  };

  return await formatData(formattedProducts, format, "products", stats);
};

// Export Farmers
export const exportFarmersService = async (format: ExportFormat) => {
  const farmers = await prisma.farmer.findMany({
    select: {
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
  });

  const formattedFarmers = farmers.map((farmer) => ({
    ...farmer,
    totalSubmissions: farmer._count.submissions,
  }));

  const stats = {
    total: farmers.length,
    verified: farmers.filter((f) => f.phoneVerified).length,
    provinces: new Set(farmers.map((f) => f.province)).size,
    districts: new Set(farmers.map((f) => f.district)).size,
    totalSubmissions: farmers.reduce((sum, f) => sum + f._count.submissions, 0),
    activeFarmers: farmers.filter((f) => f._count.submissions > 0).length,
  };

  return await formatData(formattedFarmers, format, "farmers", stats);
};

// Export Logistics
export const exportLogisticsService = async (format: ExportFormat) => {
  const logistics = await prisma.admin.findMany({
    where: { role: "LOGISTICS" },
    select: {
      username: true,
      email: true,
      phone: true,
      location: true,
      createdAt: true,
    },
  });

  const stats = {
    total: logistics.length,
    locations: new Set(logistics.map((l) => l.location)).size,
    withPhone: logistics.filter((l) => l.phone).length,
    withEmail: logistics.filter((l) => l.email).length,
  };

  return await formatData(logistics, format, "logistics", stats);
};

// Export Aggregators
export const exportAggregatorsService = async (format: ExportFormat) => {
  const aggregators = await prisma.admin.findMany({
    where: { role: "AGGREGATOR" },
    select: {
      username: true,
      email: true,
      phone: true,
      location: true,
      createdAt: true,
    },
  });

  const stats = {
    total: aggregators.length,
    locations: new Set(aggregators.map((a) => a.location)).size,
    withPhone: aggregators.filter((a) => a.phone).length,
    withEmail: aggregators.filter((a) => a.email).length,
  };

  return await formatData(aggregators, format, "aggregators", stats);
};

// Format data based on export format
const formatData = async (
  data: any[],
  format: ExportFormat,
  type: ExportType,
  stats: any
) => {
  const header = EXPORT_HEADERS[type];
  switch (format) {
    case "csv":
      return generateCSV(data, header, stats);
    case "excel":
      return await generateExcel(data, header, stats);
    case "pdf":
      return await generatePDF(data, header, stats);
    case "html":
      return generateHTML(data, header, stats);
    default:
      throw new Error("Unsupported format");
  }
};

// Generate CSV
const generateCSV = (data: any[], header: ExportHeader, stats: any) => {
  if (data.length === 0)
    return `${header.title}\n${header.description}\n\nNo data available`;

  const headers = Object.keys(data[0]);
  const statsText = Object.entries(stats)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  const csvContent = [
    `# ${header.title}`,
    `# ${header.description}`,
    `# Statistics: ${statsText}`,
    `# Generated: ${new Date().toISOString()}`,
    "",
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
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
    // Fetch logo image
    const logoResponse = await fetch(header.logo);
    if (logoResponse.ok) {
      const logoBuffer = await logoResponse.arrayBuffer();
      const imageId = workbook.addImage({
        buffer: Buffer.from(logoBuffer) as any,
        extension: "png",
      });

      // Add logo image
      worksheet.addImage(imageId, {
        tl: { col: 0, row: 1 },
        ext: { width: 100, height: 50 },
      });
    }
  } catch (error) {
    // Fallback to text if image fails
    worksheet.getCell("A2").value = "Food Bundle Logo";
  }

  // Add header content
  worksheet.getCell("A1").value = header.title;
  worksheet.getCell("A1").font = { bold: true, size: 16 };

  worksheet.getCell("A3").value = header.description;
  worksheet.getCell("A4").value = `Generated: ${new Date().toISOString()}`;

  // Add statistics
  let row = 6;
  worksheet.getCell(`A${row}`).value = "Summary Statistics:";
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  Object.entries(stats).forEach(([key, value]) => {
    worksheet.getCell(`A${row}`).value = key;
    worksheet.getCell(`B${row}`).value = value as any;
    row++;
  });

  row += 2;
  worksheet.getCell(`A${row}`).value = "Data:";
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  // Add data
  if (data.length > 0) {
    const headers = Object.keys(data[0]);

    // Add headers
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    });
    row++;

    // Add data rows
    data.forEach((item) => {
      headers.forEach((header, index) => {
        worksheet.getCell(row, index + 1).value = item[header] as any;
      });
      row++;
    });
  }

  // Auto-fit columns
  worksheet.columns.forEach((column: any) => {
    column.width = 15;
  });

  return await workbook.xlsx.writeBuffer();
};

// Generate PDF
const generatePDF = async (data: any[], header: ExportHeader, stats: any) => {
  return new Promise<Buffer>(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ layout: "landscape", margin: 30 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Logo in top-left corner
      try {
        // Fetch and embed actual logo image
        const logoResponse = await fetch(header.logo);
        if (logoResponse.ok) {
          const logoBuffer = await logoResponse.arrayBuffer();
          doc.image(Buffer.from(logoBuffer), 30, 30, { width: 80, height: 40 });
        } else {
          throw new Error("Logo fetch failed");
        }
      } catch (error) {
        // Fallback if logo loading fails - create styled placeholder
        doc.rect(30, 30, 80, 40).stroke();
        doc.fontSize(8).text("Food Bundle", 35, 45);
      }

      // Title and description next to logo
      doc.fontSize(18).text(header.title, 120, 35);
      doc.fontSize(10).text(header.description, 120, 55, { width: 400 });

      // Move cursor below header area
      doc.y = 90;

      // Statistics
      doc.fontSize(14).text("Summary Statistics:", { underline: true });
      doc.fontSize(10);
      Object.entries(stats).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`);
      });
      doc.text(`Generated: ${new Date().toISOString()}`);
      doc.moveDown(2);

      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const pageWidth = doc.page.width - 60;
        const columnWidth = pageWidth / headers.length;

        // Table headers
        doc.fontSize(8);
        let yPosition = doc.y;
        headers.forEach((header, index) => {
          doc.text(header, 30 + index * columnWidth, yPosition, {
            width: columnWidth - 5,
          });
        });

        doc.moveDown();

        // Table data
        data.slice(0, 100).forEach((row) => {
          yPosition = doc.y;
          if (yPosition > doc.page.height - 50) {
            doc.addPage({ layout: "landscape", margin: 30 });
            yPosition = 30;
          }
          headers.forEach((header, index) => {
            const value = row[header]?.toString() || "";
            doc.text(
              value.substring(0, 25),
              30 + index * columnWidth,
              yPosition,
              { width: columnWidth - 5 }
            );
          });
          doc.moveDown(0.3);
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
    .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
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
        ${headers.map((header) => `<th>${header}</th>`).join("")}
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
