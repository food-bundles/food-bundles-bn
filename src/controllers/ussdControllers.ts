import { Request, Response } from "express";
import { handleUssdLogic } from "../services/ussdServices";

export const ussdHandler = async (req: Request, res: Response) => {
  try {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    // Validate required parameters
    if (!sessionId) {
      return res.status(400).json({
        error: "sessionId is required",
        sessionId: null,
        timestamp: new Date().toISOString(),
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        error: "phoneNumber is required",
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        error: "Invalid phone number format",
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }

    const response = await handleUssdLogic({
      sessionId,
      serviceCode,
      phoneNumber,
      text: text || "",
    });

    res.set("Content-Type", "text/plain");
    res.send(response);
  } catch (error: any) {
    console.error("USSD Handler Error:", error);

    res.status(500).json({
      error: error.message || "Internal system error occurred",
      sessionId: req.body?.sessionId || null,
      timestamp: new Date().toISOString(),
    });
  }
};

export const ussdHealthCheck = async (req: Request, res: Response) => {
  try {
    res.set("Content-Type", "text/plain");
    res.send("USSD endpoint is working! Use POST method.");
  } catch (error) {
    res.status(503).send("USSD service temporarily unavailable");
  }
};
