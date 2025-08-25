import { NextFunction, Request, Response } from "express";
import {
  handleUssdLogic,
  submitProductService,
} from "../services/ussdServices";
import { ProductSubmissionInput } from "../types/productTypes";
import errorHandler, { catchAsyncError } from "../utils/errorhandler.utlity";

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

export const submitProductController = catchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const {
      productName,
      category,
      quantity,
      wishedPrice,
      province,
      district,
      sector,
      cell,
      village,
    } = req.body;

    // Validate required fields
    if (
      !productName ||
      !quantity ||
      !wishedPrice ||
      !province ||
      !district ||
      !sector ||
      !cell ||
      !village
    ) {
      return next(
        new errorHandler({
          message:
            "productName, quantity, wishedPrice, province, district, sector, cell, and village are required",
          statusCode: 400,
        })
      );
    }

    // Validate numeric fields
    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
      return next(
        new errorHandler({
          message: "quantity must be a positive number",
          statusCode: 400,
        })
      );
    }

    if (isNaN(parseFloat(wishedPrice)) || parseFloat(wishedPrice) <= 0) {
      return next(
        new errorHandler({
          message: "wishedPrice must be a positive number",
          statusCode: 400,
        })
      );
    }

    // Validate user authentication
    if (!userId) {
      return next(
        new errorHandler({
          message: "User authentication required",
          statusCode: 401,
        })
      );
    }

    const submissionData: ProductSubmissionInput = {
      farmerId: userId,
      productName: productName.trim(),
      category: category || "OTHER",
      submittedQty: parseFloat(quantity),
      wishedPrice: parseFloat(wishedPrice),
      province,
      district,
      sector,
      cell,
      village,
    };

    const result = await submitProductService(submissionData);

    res.status(201).json({
      success: true,
      message: "Product submitted successfully",
      data: result,
    });
  }
);
