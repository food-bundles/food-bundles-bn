import { Request, Response } from "express";
import prisma from "../prisma";
import nodemailer from "nodemailer";

const TICKET_PREFIX = "FB";
const CATEGORY_LABELS: Record<string, string> = {
  orders: "Orders & Ordering",
  delivery: "Delivery & Tracking",
  payments: "Payments & Billing",
  account: "Account & Profile",
  products: "Products & Suppliers",
  refunds: "Refunds & Returns",
  technical: "Technical Issues",
  other: "Other",
};

const SEVERITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function generateTicketNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${TICKET_PREFIX}-${y}${m}${d}-${rand}`;
}

const publicUrl = (filename: string): string => {
  const base =
    process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || "4000"}`;
  return `${base}/uploads/products/${filename}`;
};

export const createSupportRequest = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      subject,
      category,
      severity,
      preferredContact,
      description,
    } = req.body;

    if (!name || !email || !subject || !category || !description) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, email, subject, category, description",
      });
    }

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    const screenshots = files.map((file) => publicUrl(file.filename));

    // Try to reserve a unique ticket number with a few attempts
    let ticketNumber = generateTicketNumber();
    try {
      const existing = await prisma.supportRequest.findUnique({
        where: { ticketNumber },
      });
      if (existing) {
        ticketNumber = generateTicketNumber();
      }
    } catch {
      // ignore lookup errors, fall through to create
    }

    const request = await prisma.supportRequest.create({
      data: {
        ticketNumber,
        name,
        email,
        subject,
        category,
        severity: severity || null,
        preferredContact: preferredContact || "email",
        description,
        screenshots,
        status: "open",
      },
    });

    const categoryLabel = CATEGORY_LABELS[category] || category;
    const severityLabel = severity ? SEVERITY_LABELS[severity] || severity : "N/A";

    const screenshotHtml =
      screenshots.length > 0
        ? `<p><strong>Attachments (${screenshots.length}):</strong></p>
           ${screenshots
             .map(
               (url) =>
                 `<p><a href="${url}" target="_blank">${url}</a></p>`
             )
             .join("")}`
        : "";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_EMAIL,
        pass: process.env.GOOGLE_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.GOOGLE_EMAIL,
      to: process.env.GOOGLE_EMAIL,
      subject: `[Support Ticket ${ticketNumber}] ${subject}`,
      html: `
        <h3>New Support Ticket</h3>
        <table style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 14px;">
          <tr><td style="padding: 6px;"><strong>Ticket Number:</strong></td><td style="padding: 6px;">${ticketNumber}</td></tr>
          <tr><td style="padding: 6px;"><strong>Name:</strong></td><td style="padding: 6px;">${name}</td></tr>
          <tr><td style="padding: 6px;"><strong>Email:</strong></td><td style="padding: 6px;">${email}</td></tr>
          <tr><td style="padding: 6px;"><strong>Subject:</strong></td><td style="padding: 6px;">${subject}</td></tr>
          <tr><td style="padding: 6px;"><strong>Category:</strong></td><td style="padding: 6px;">${categoryLabel}</td></tr>
          <tr><td style="padding: 6px;"><strong>Severity:</strong></td><td style="padding: 6px;">${severityLabel}</td></tr>
          <tr><td style="padding: 6px;"><strong>Preferred Contact:</strong></td><td style="padding: 6px;">${preferredContact || "email"}</td></tr>
        </table>
        <p><strong>Description:</strong></p>
        <p>${description}</p>
        ${screenshotHtml}
      `,
    });

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error("Support request error:", error);
    res.status(500).json({ success: false, error: "Failed to process support request" });
  }
};

export const getSupportRequests = async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query;

    const requests = await prisma.supportRequest.findMany({
      where: {
        ...(status
          ? { status: status as string }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search as string, mode: "insensitive" } },
                { email: { contains: search as string, mode: "insensitive" } },
                { subject: { contains: search as string, mode: "insensitive" } },
                { ticketNumber: { contains: search as string, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(requests);
  } catch (error) {
    console.error("Fetch support requests error:", error);
    res.status(500).json({ error: "Failed to fetch support requests" });
  }
};

export const getSupportRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request = await prisma.supportRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ error: "Support request not found" });
    }

    res.json(request);
  } catch (error) {
    console.error("Fetch support request error:", error);
    res.status(500).json({ error: "Failed to fetch support request" });
  }
};

export const updateSupportRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, response } = req.body;

    const existing = await prisma.supportRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Support request not found" });
    }

    const request = await prisma.supportRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(response !== undefined ? { response, respondedAt: new Date() } : {}),
      },
    });

    // Notify the user when their ticket is resolved / they get a response
    if (response !== undefined) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GOOGLE_EMAIL,
          pass: process.env.GOOGLE_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.GOOGLE_EMAIL,
        to: existing.email,
        subject: `Re: ${existing.subject} (Ticket ${existing.ticketNumber})`,
        html: `
          <h3>Update on Your Support Ticket ${existing.ticketNumber}</h3>
          <p>Dear ${existing.name},</p>
          <p>Here is our response regarding your ticket:</p>
          <blockquote style="border-left: 3px solid #16a34a; padding-left: 10px; margin: 10px 0;">
            ${response}
          </blockquote>
          <p>Best regards,<br>FoodBundles Support Team</p>
        `,
      });
    }

    res.json(request);
  } catch (error) {
    console.error("Update support request error:", error);
    res.status(500).json({ error: "Failed to update support request" });
  }
};

export const deleteSupportRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.supportRequest.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Delete support request error:", error);
    res.status(500).json({ error: "Failed to delete support request" });
  }
};
