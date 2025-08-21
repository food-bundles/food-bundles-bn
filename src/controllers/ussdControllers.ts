import { Request, Response } from "express";
import {
  handleUssdLogic,
  submitProductService,
} from "../services/ussdServices";
import { ProductSubmissionInput } from "../types/productTypes";

export const ussdHandler = async (req: Request, res: Response) => {
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  const response = await handleUssdLogic({
    sessionId,
    serviceCode,
    phoneNumber,
    text,
  });

  res.set("Content-Type", "text/plain");
  res.send(response);
};

export const submitProductController = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { productName, category, quantity, wishedPrice } = req.body;

    if (!productName || !quantity || !wishedPrice) {
      return res.status(400).json({
        success: false,
        message: "productName, quantity, and wishedPrice are required",
      });
    }

    if (quantity <= 0 || wishedPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "quantity and wishedPrice must be positive numbers",
      });
    }

    const submissionData: ProductSubmissionInput = {
      farmerId: userId,
      productName,
      category,
      submittedQty: quantity,
      wishedPrice,
    };

    const result = await submitProductService(submissionData);

    res.status(201).json({
      success: true,
      message: "Product submitted successfully",
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit product",
    });
  }
};
