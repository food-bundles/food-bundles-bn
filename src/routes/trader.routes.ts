import { Router } from "express";
import {
  createTraderWallet,
  getTraderWallet,
  topUpTraderWallet,
  getTraderLoanApplications,
  getTraderVouchers,
  traderApproveLoan,
  getTraderCommission,
  processTraderCommission,
  getTraderOrders,
  getTraderTransactionHistory,
  getTraderDashboard,
} from "../controllers/trader.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const traderRoutes = Router();

// Wallet Management
traderRoutes.post(
  "/wallet",
  isAuthenticated,
  checkPermission("TRADER"),
  createTraderWallet,
);
traderRoutes.get(
  "/wallet",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderWallet,
);
traderRoutes.post(
  "/wallet/topup",
  isAuthenticated,
  checkPermission("TRADER"),
  topUpTraderWallet,
);

// Loan & Voucher Management
traderRoutes.get(
  "/loans",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderLoanApplications,
);
traderRoutes.get(
  "/vouchers",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderVouchers,
);
traderRoutes.post(
  "/loans/:loanId/approve",
  isAuthenticated,
  checkPermission("TRADER"),
  traderApproveLoan,
);

// Commission Management
traderRoutes.get(
  "/commission",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderCommission,
);
traderRoutes.post(
  "/commission/process",
  isAuthenticated,
  checkPermission("TRADER"),
  processTraderCommission,
);

// Orders & Transactions
traderRoutes.get(
  "/orders",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderOrders,
);
traderRoutes.get(
  "/transactions",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderTransactionHistory,
);

// Dashboard
traderRoutes.get(
  "/dashboard",
  isAuthenticated,
  checkPermission("TRADER"),
  getTraderDashboard,
);

export default traderRoutes;
