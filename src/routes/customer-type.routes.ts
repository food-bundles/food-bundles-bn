import { Router } from "express";
import {
  createCustomerType,
  getAllCustomerTypes,
  getCustomerTypeById,
  updateCustomerType,
  deleteCustomerType,
  toggleCustomerTypeStatus,
  getCustomerTypeUsage,
  getPriceUsage,
  assignCustomerType,
  swapCustomerTypePricing,
} from "../controllers/customer-type.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const customerTypeRoutes = Router();

customerTypeRoutes.get("/", getAllCustomerTypes);

customerTypeRoutes.get("/usage", isAuthenticated, checkPermission("ADMIN"), getCustomerTypeUsage);

customerTypeRoutes.get("/price-usage", isAuthenticated, checkPermission("ADMIN"), getPriceUsage);

customerTypeRoutes.patch("/assign-customer-type", isAuthenticated, checkPermission("ADMIN"), assignCustomerType);

customerTypeRoutes.post("/swap-pricing", isAuthenticated, checkPermission("ADMIN"), swapCustomerTypePricing);

customerTypeRoutes.post("/", isAuthenticated, checkPermission("ADMIN"), createCustomerType);

customerTypeRoutes.patch("/:customerTypeId/status", isAuthenticated, checkPermission("ADMIN"), toggleCustomerTypeStatus);

customerTypeRoutes.get("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), getCustomerTypeById);

customerTypeRoutes.patch("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), updateCustomerType);

customerTypeRoutes.delete("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), deleteCustomerType);

export default customerTypeRoutes;
