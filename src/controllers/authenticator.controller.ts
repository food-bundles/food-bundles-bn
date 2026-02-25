import { Request, Response } from "express";
import { AuthenticatorService } from "../services/authenticator.service";

export const enable2FA = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const result = await AuthenticatorService.enable2FA(userId, userRole);

    res.status(200).json({
      success: true,
      message:
        "2FA setup initiated. Scan the QR code with Google Authenticator and verify with a code.",
      data: {
        secret: result.secret,
        qrCode: result.qrCode,
        backupCodes: result.backupCodes,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to enable 2FA",
    });
  }
};

export const verify2FASetup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    const verified = await AuthenticatorService.verify2FASetup(
      userId,
      userRole,
      token
    );

    if (verified) {
      res.status(200).json({
        success: true,
        message: "2FA enabled successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify 2FA setup",
    });
  }
};

export const verify2FAToken = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "2FA token is required",
      });
    }

    const verified = await AuthenticatorService.verify2FAToken(
      userId,
      userRole,
      token
    );

    if (verified) {
      res.status(200).json({
        success: true,
        message: "2FA token verified successfully",
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid 2FA token",
      });
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify 2FA token",
    });
  }
};

export const disable2FA = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "2FA token is required to disable 2FA",
      });
    }

    const verified = await AuthenticatorService.verify2FAToken(
      userId,
      userRole,
      token
    );

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid 2FA token",
      });
    }

    await AuthenticatorService.disable2FA(userId, userRole);

    res.status(200).json({
      success: true,
      message: "2FA disabled successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to disable 2FA",
    });
  }
};

export const get2FAStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const status = await AuthenticatorService.get2FAStatus(userId, userRole);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get 2FA status",
    });
  }
};

export const regenerateBackupCodes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "2FA token is required to regenerate backup codes",
      });
    }

    const verified = await AuthenticatorService.verify2FAToken(
      userId,
      userRole,
      token
    );

    if (!verified) {
      return res.status(400).json({
        success: false,
        message: "Invalid 2FA token",
      });
    }

    const backupCodes = await AuthenticatorService.regenerateBackupCodes(
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      message: "Backup codes regenerated successfully",
      data: { backupCodes },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to regenerate backup codes",
    });
  }
};
