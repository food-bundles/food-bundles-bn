import { UssdRequest } from "../types/ussd";
import prisma from "../prisma";

interface SessionData {
  location?: string;
  password?: string;
  confirmPassword?: string;
  selectedProduct?: string;
  quantity?: string;
  mode?: "register" | "submit";
}

let ussdSessions: Record<string, SessionData> = {};

const products = ["Tomatoes", "Onions", "Maize"];

export async function handleUssdLogic({
  sessionId,
  phoneNumber,
  text,
}: UssdRequest): Promise<string> {
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

      const existingUser = await prisma.user.findUnique({
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
        return "CON Create a password:";
      }

      if (parts.length === 3) {
        session.password = parts[2];
        return "CON Confirm your password:";
      }

      if (parts.length === 4) {
        session.confirmPassword = parts[3];

        if (session.password !== session.confirmPassword) {
          delete ussdSessions[sessionId];
          return "END Passwords do not match. Registration failed.";
        }

        try {
          const farmer = await prisma.farmer.create({
            data: {
              location: session.location || "UNKNOWN",
              submissions: {},
            },
          });

          await prisma.user.create({
            data: {
              role: "FARMER",
              phone: phoneNumber,
              password: session.password,
              farmerId: farmer.id,
            },
          });

          delete ussdSessions[sessionId];
          return "END Registration successful. Thank you!";
        } catch (err) {
          console.error("DB Error:", err);
          return "END Registration failed. Please try again later.";
        }
      }

      break;
    }

    // 2. Submit Product
    case "2": {
      session.mode = "submit";

      const user = await prisma.user.findUnique({
        where: { phone: phoneNumber },
      });

      if (!user) {
        return "END Please register first before submitting a product.";
      }

      if (parts.length === 1) {
        return `CON Select a product:
1. Tomatoes
2. Onions
3. Maize`;
      }

      if (parts.length === 2) {
        const index = parseInt(parts[1]) - 1;
        if (index < 0 || index >= products.length) {
          return "END Invalid product selection.";
        }
        session.selectedProduct = products[index];
        return "CON Enter quantity in kg:";
      }

      if (parts.length === 3) {
        session.quantity = parts[2];
        return "CON Enter your password to confirm submission:";
      }

      if (parts.length === 4) {
        const enteredPassword = parts[3];

        if (enteredPassword !== user.password) {
          return "END Incorrect password. Submission canceled.";
        }

        try {
          await prisma.farmerSubmission.create({
            data: {
              farmerId: user.farmerId!,
              productName: session.selectedProduct!,
              quantity: parseFloat(session.quantity!),
            },
          });

          delete ussdSessions[sessionId];
          return "END Submission successful. Thank you!";
        } catch (err) {
          console.error("DB Error:", err);
          return "END Submission failed. Try again.";
        }
      }

      break;
    }

    case "3":
      return "END Thank you for using SmartAgri!";
  }

  return "END Invalid input. Try again.";
}
