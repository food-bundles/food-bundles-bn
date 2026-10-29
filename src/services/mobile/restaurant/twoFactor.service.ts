import { AuthenticatorService } from "../../authenticator.service";

export const mobileEnable2FA = (userId: string, userRole: string) =>
  AuthenticatorService.enable2FA(userId, userRole);

export const mobileVerify2FASetup = (userId: string, userRole: string, token: string) =>
  AuthenticatorService.verify2FASetup(userId, userRole, token);

export const mobileDisable2FA = (userId: string, userRole: string, token: string) =>
  AuthenticatorService.verify2FAToken(userId, userRole, token).then((verified) => {
    if (!verified) throw new Error("Invalid 2FA token");
    return AuthenticatorService.disable2FA(userId, userRole);
  });

export const mobileGet2FAStatus = (userId: string, userRole: string) =>
  AuthenticatorService.get2FAStatus(userId, userRole);

export const mobileRegenerateBackupCodes = (userId: string, userRole: string, token: string) =>
  AuthenticatorService.verify2FAToken(userId, userRole, token).then((verified) => {
    if (!verified) throw new Error("Invalid 2FA token");
    return AuthenticatorService.regenerateBackupCodes(userId, userRole);
  });
