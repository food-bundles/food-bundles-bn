import {
  PaymentMethod,
  PaymentStatus,
  TransactionStatus,
  WalletTransactionType,
} from "@prisma/client";

// Enhanced interface for updating checkout
export interface UpdateCheckoutData {
  paymentMethod?: PaymentMethod;
  billingName?: string;
  billingEmail?: string;
  billingPhone?: string;
  billingAddress?: string;
  notes?: string;
  deliveryDate?: Date;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  transactionId?: string;
  txRef?: string;
  flwRef?: string;
  txOrderId?: string;
  currency?: string;
  clientIp?: string;
  deviceFingerprint?: string;
  narration?: string;
  transferReference?: string;
  transferAccount?: string;
  transferBank?: string;
  accountExpiration?: Date;
  transferNote?: string;
  transferAmount?: number;
  network?: string;
  voucher?: string;
  paymentCode?: string;
  redirectUrl?: string;
  authorizationMode?: string;
  flwStatus?: string;
  chargedAmount?: number;
  appFee?: number;
  merchantFee?: number;
  processorResponse?: string;
  authModel?: string;
  fraudStatus?: string;
  chargeType?: string;
  paymentType?: string;

  cardFirst6Digits?: string;
  cardLast4Digits?: string;
  cardType?: string;
  cardExpiry?: string;
  cardCountry?: string;
  encryptionKey?: string;

  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface BasePaymentResult {
  success: boolean;
  transactionId: string;
  reference: string;
  flwRef: string;
  status: string;
  message: string;
  error?: string;
  details?: string;
}

export interface MobileMoneyPaymentResult extends BasePaymentResult {
  authorizationDetails?: {
    mode: string;
    redirectUrl: string;
  };
}

export interface CardPaymentResult extends BasePaymentResult {
  authorizationDetails?: {
    mode: string;
    redirectUrl: string;
    message?: string;
  };
  cardPaymentData?: {
    transactionId?: number;
    flwRef?: string;
    deviceFingerprint?: string;
    amount?: number;
    chargedAmount?: number;
    appFee?: number;
    merchantFee?: number;
    processorResponse?: string;
    authModel?: string;
    currency?: string;
    ip?: string;
    narration?: string;
    status?: string;
    authUrl?: string;
    paymentType?: string;
    fraudStatus?: string;
    chargeType?: string;
    // Card specific data
    cardFirst6Digits?: string;
    cardLast4Digits?: string;
    cardCountry?: string;
    cardType?: string;
    cardExpiry?: string;
    // Customer data
    customerId?: number;
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
  };
}

export interface BankTransferPaymentResult extends BasePaymentResult {
  transferDetails?: {
    transferReference: string;
    transferAccount: string;
    transferBank: string;
    transferAmount: number;
    transferNote: string;
    accountExpiration: Date | null;
  };
}

export interface CashPaymentResult extends BasePaymentResult {
  walletDetails?: {
    previousBalance: number;
    newBalance: number;
    transactionId: string;
  };
}

export interface MobileMoneyPaymentSubmissionData {
  amount: number;
  phoneNumber: string;
  txRef: string;
  orderId: string;
  email: string;
  fullname: string;
  currency?: string;
}

export interface CreateWalletData {
  restaurantId: string;
  currency?: string;
}

export interface TopUpWalletData {
  walletId: string;
  amount: number;
  paymentMethod: string;
  phoneNumber?: string;
  cardDetails?: {
    cardNumber: string;
    cvv: string;
    expiryMonth: string;
    expiryYear: string;
    pin?: string;
  };
  description?: string;
}

export interface DebitWalletData {
  walletId: string;
  amount: number;
  description?: string;
  reference?: string;
  orderId?: string;
}

export interface WalletTransactionFilters {
  type?: WalletTransactionType;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}
