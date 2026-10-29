import {
  getMyVoucherCardService,
  submitKycConsentService,
  requestVoucherCardService,
  getLoanTermsService,
  acceptLoanTermsService,
  getMyLoanSessionsService,
  requestLoanSessionService,
  payUnlockFeeService,
} from "../../voucher-card.service";

export const mobileGetMyVoucherCard = (restaurantId: string) =>
  getMyVoucherCardService(restaurantId);

export const mobileSubmitKycConsent = (
  restaurantId: string,
  input: Parameters<typeof submitKycConsentService>[1],
) => submitKycConsentService(restaurantId, input);

export const mobileRequestVoucherCard = (restaurantId: string) =>
  requestVoucherCardService(restaurantId);

export const mobileGetLoanTerms = (
  restaurantId: string,
  options: Parameters<typeof getLoanTermsService>[1],
) => getLoanTermsService(restaurantId, options);

export const mobileAcceptLoanTerms = (
  restaurantId: string,
  data: Parameters<typeof acceptLoanTermsService>[1],
) => acceptLoanTermsService(restaurantId, data);

export const mobileGetMyLoanSessions = (restaurantId: string) =>
  getMyLoanSessionsService(restaurantId);

export const mobileRequestLoanSession = (
  restaurantId: string,
  data: Parameters<typeof requestLoanSessionService>[1],
) => requestLoanSessionService(restaurantId, data);

export const mobilePayUnlockFee = (
  sessionId: string,
  restaurantId: string,
  paymentData: Parameters<typeof payUnlockFeeService>[2],
) => payUnlockFeeService(sessionId, restaurantId, paymentData);
