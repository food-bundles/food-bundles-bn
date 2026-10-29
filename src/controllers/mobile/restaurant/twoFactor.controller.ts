import { Request, Response } from "express";
import {
  mobileEnable2FA,
  mobileVerify2FASetup,
  mobileDisable2FA,
  mobileGet2FAStatus,
  mobileRegenerateBackupCodes,
} from "../../../services/mobile/restaurant/twoFactor.service";

const user = (req: Request) => (req as any).user;

export const mobileTwoFactorEnable = async (req: Request, res: Response) => {
  try {
    const result = await mobileEnable2FA(user(req).id, user(req).role);
    res.status(200).json({ message: "2FA setup initiated", data: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to initiate 2FA" });
  }
};

export const mobileTwoFactorVerifySetup = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });
    const verified = await mobileVerify2FASetup(user(req).id, user(req).role, token);
    if (verified) {
      res.status(200).json({ message: "2FA enabled successfully", data: { verified: true } });
    } else {
      res.status(400).json({ message: "Invalid verification token" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to verify 2FA setup" });
  }
};

export const mobileTwoFactorDisable = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required to disable 2FA" });
    await mobileDisable2FA(user(req).id, user(req).role, token);
    res.status(200).json({ message: "2FA disabled successfully" });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to disable 2FA" });
  }
};

export const mobileTwoFactorStatus = async (req: Request, res: Response) => {
  try {
    const status = await mobileGet2FAStatus(user(req).id, user(req).role);
    res.status(200).json({ message: "2FA status retrieved", data: status });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to get 2FA status" });
  }
};

export const mobileTwoFactorRegenerateBackupCodes = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });
    const backupCodes = await mobileRegenerateBackupCodes(user(req).id, user(req).role, token);
    res.status(200).json({ message: "Backup codes regenerated", data: { backupCodes } });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to regenerate backup codes" });
  }
};
