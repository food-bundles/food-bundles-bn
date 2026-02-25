import speakeasy from "speakeasy";
import QRCode from "qrcode";
import prisma from "../prisma";

export class AuthenticatorService {
  static async generateSecret(userName: string, userRole: string) {
    // Generate a unique secret for the user with a descriptive name and date for better identification in authenticator apps since after disable and re-enable, the secret changes but the user can still recognize it in their app. as the same

    // Let's formst date like 250226 for Feb 25, 2026 to keep it concise
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const currentDate = `${dd}${mm}${yy}`;
    console.log("Formatted date:---", currentDate); // "250226"

    const secret = speakeasy.generateSecret({
      name: `FoodBundles (${userName} - ${currentDate} - ${userRole})`,
      issuer: "FoodBundles",
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  }

  static async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error: any) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  static async enable2FA(
    userId: string,
    userRole: string,
  ): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    // Get user
    const user = await (prisma as any)[tableName].findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    let userName = user.name || user.email || "User";
    if (userRole === "FARMER") userName = user.phone || userName;
    else if (userRole === "RESTAURANT") userName = user.name || userName;
    else if (userRole === "ADMIN") userName = user.username || userName;

    const { secret, otpauthUrl } = await this.generateSecret(
      userName,
      userRole,
    );
    const qrCode = await this.generateQRCode(otpauthUrl!);
    const backupCodes = this.generateBackupCodes();

    await (prisma as any)[tableName].update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
        twoFactorBackupCodes: backupCodes,
      },
    });

    return { secret, qrCode, backupCodes };
  }

  static async verify2FASetup(
    userId: string,
    userRole: string,
    token: string,
  ): Promise<boolean> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    const user = await (prisma as any)[tableName].findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true },
    });

    if (!user?.twoFactorSecret) {
      throw new Error("2FA not initialized");
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (verified) {
      await (prisma as any)[tableName].update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
    }

    return verified;
  }

  static async verify2FAToken(
    userId: string,
    userRole: string,
    token: string,
  ): Promise<boolean> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    const user = await (prisma as any)[tableName].findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user?.twoFactorEnabled || !user?.twoFactorSecret) {
      throw new Error("2FA not enabled");
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (verified) {
      return true;
    }

    if (user.twoFactorBackupCodes?.includes(token)) {
      const updatedCodes = user.twoFactorBackupCodes.filter(
        (code: string) => code !== token,
      );
      await (prisma as any)[tableName].update({
        where: { id: userId },
        data: { twoFactorBackupCodes: updatedCodes },
      });
      return true;
    }

    return false;
  }

  static async disable2FA(userId: string, userRole: string): Promise<void> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    await (prisma as any)[tableName].update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      },
    });
  }

  static async get2FAStatus(
    userId: string,
    userRole: string,
  ): Promise<{ enabled: boolean; backupCodesCount: number }> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    const user = await (prisma as any)[tableName].findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorBackupCodes: true },
    });

    return {
      enabled: user?.twoFactorEnabled || false,
      backupCodesCount: user?.twoFactorBackupCodes?.length || 0,
    };
  }

  static generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  static async regenerateBackupCodes(
    userId: string,
    userRole: string,
  ): Promise<string[]> {
    const tableName =
      userRole === "RESTAURANT" || userRole === "AFFILIATOR"
        ? "restaurant"
        : userRole === "FARMER"
          ? "farmer"
          : "admin";

    const backupCodes = this.generateBackupCodes();

    await (prisma as any)[tableName].update({
      where: { id: userId },
      data: { twoFactorBackupCodes: backupCodes },
    });

    return backupCodes;
  }
}
