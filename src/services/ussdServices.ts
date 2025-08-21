import prisma from "../prisma";
import { ProductSubmissionInput } from "../types/productTypes";
import { ISessionData, IUssdRequest } from "../types/userTypes";
import { comparePassword, hashPassword } from "../utils/password";

let ussdSessions: Record<string, ISessionData> = {};

const products = [
  "Tomatoes",
  "Onions",
  "Maize",
  "Potatoes",
  "Cassava",
  "Irish Potatoes",
  "Banana",
];

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: IUssdRequest): Promise<string> {
  const parts = text.split("*");

  const session = ussdSessions[sessionId] || {};
  ussdSessions[sessionId] = session;

  if (text === "") {
    return `CON Welcome to SmartAgri!
1. Register
2. Submit Product
3. Exit`;
  }

  switch (parts[0]) {
    // 1. Register
    case "1": {
      session.mode = "register";

      const existingUser = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (existingUser) {
        return "END You are already registered.";
      }

      if (parts.length === 1) {
        return "CON Enter your location:";
      }

      if (parts.length === 2) {
        session.location = parts[1];
        return "CON Create a 4-digit PIN:";
      }

      if (parts.length === 3) {
        const password = parts[2];

        if (!/^\d{4}$/.test(password)) {
          delete ussdSessions[sessionId];
          return "END Please enter a 4-digit numeric PIN only. Try again.";
        }

        session.password = password;
        return "CON Confirm your 4-digit PIN:";
      }

      if (parts.length === 4) {
        const confirmPassword = parts[3];

        if (!/^\d{4}$/.test(confirmPassword)) {
          delete ussdSessions[sessionId];
          return "END Please enter a 4-digit numeric PIN only. Try again.";
        }

        if (session.password !== confirmPassword) {
          delete ussdSessions[sessionId];
          return "END PINs do not match. Please try again.";
        }

        try {
          let hashedPassword = await hashPassword(session.password);
          await prisma.farmer.create({
            data: {
              phone: phoneNumber,
              location: session.location || "UNKNOWN",
              password: hashedPassword,
            },
          });

          delete ussdSessions[sessionId];
          return "END Registration successful. Thank you!";
        } catch (err) {
          console.error("DB Error:", err);
          delete ussdSessions[sessionId];
          return "END Registration failed. Please try again later.";
        }
      }

      return "END Invalid input during registration.";
    }

    // 2. Submit ProductC
    case "2": {
      session.mode = "submit";

      const farmer = await prisma.farmer.findUnique({
        where: { phone: phoneNumber },
      });

      if (!farmer) {
        return "END Please register first before submitting a product.";
      }

      if (parts.length === 1) {
        return `CON Select a product:
1. Tomatoes
2. Onions
3. Maize
4. Potatoes
5. Cassava
6. Irish Potatoes
7. Banana`;
      }

      if (parts.length === 2) {
        const index = parseInt(parts[1]) - 1;
        if (index < 0 || index >= products.length) {
          return "END Invalid product selection. Please try again.";
        }
        session.selectedProduct = products[index];
        return "CON Enter quantity in kg:";
      }

      if (parts.length === 3) {
        const quantity = parts[2];

        if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
          delete ussdSessions[sessionId];
          return "END Please enter a valid quantity. Try again.";
        }

        session.quantity = quantity;
        return "CON Enter your wished price per kg (RWF):";
      }
      if (parts.length === 4) {
        const wishedPrice = parts[3];

        if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
          delete ussdSessions[sessionId];
          return "END Please enter a valid wished price. Try again.";
        }

        session.wishedPrice = wishedPrice;
        return "CON Enter your PIN to confirm:";
      }

      if (parts.length === 5) {
        const enteredPassword = parts[4];

        if (!/^\d{4}$/.test(enteredPassword)) {
          delete ussdSessions[sessionId];
          return "END Please enter a 4-digit numeric PIN only. Try again.";
        }

        const isMatch = await comparePassword(
          enteredPassword,
          farmer.password ?? ""
        );
        if (!isMatch) {
          delete ussdSessions[sessionId];
          return "END Incorrect PIN. Please try again.";
        }

        try {
          await prisma.farmerSubmission.create({
            data: {
              farmerId: farmer.id,
              productName: session.selectedProduct!,
              submittedQty: parseFloat(session.quantity!),
              wishedPrice: parseFloat(session.wishedPrice!),
            },
          });

          delete ussdSessions[sessionId];
          return "END Submission successful. Thank you!";
        } catch (err) {
          console.error("DB Error:", err);
          delete ussdSessions[sessionId];
          return "END Submission failed. Try again.";
        }
      }

      return "END Invalid input during product submission.";
    }

    case "3":
      return "END Thank you for using SmartAgri!";
  }

  return "END Invalid input. Try again.";
}

export async function submitProductService(
  submissionData: ProductSubmissionInput
) {
  // Validate product name
  if (!products.includes(submissionData.productName)) {
    throw new Error(
      `Invalid product. Valid products are: ${products.join(", ")}`
    );
  }

  // Validate quantity and price
  if (submissionData.submittedQty <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  if (submissionData.wishedPrice <= 0) {
    throw new Error("Price must be greater than 0");
  }

  // Check if farmer exists
  const farmerExists = await prisma.farmer.findUnique({
    where: { id: submissionData.farmerId },
  });

  if (!farmerExists) {
    throw new Error("Farmer not found");
  }

  // Create submission
  const submission = await prisma.farmerSubmission.create({
    data: {
      farmerId: submissionData.farmerId,
      productName: submissionData.productName,
      category: submissionData.category,
      submittedQty: submissionData.submittedQty,
      wishedPrice: submissionData.wishedPrice,
      status: "PENDING",
    },
    include: {
      farmer: {
        select: {
          id: true,
          phone: true,
          location: true,
        },
      },
    },
  });

  return submission;
}
