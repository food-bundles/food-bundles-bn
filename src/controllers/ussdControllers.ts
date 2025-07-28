import { Request, Response } from "express";
import { handleUssdLogic } from "../services/ussdServices";

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
