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
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const customerTypeRoutes = Router();

customerTypeRoutes.get("/", getAllCustomerTypes);

customerTypeRoutes.get("/usage", isAuthenticated, allow("customer_types"), getCustomerTypeUsage);

customerTypeRoutes.get("/price-usage", isAuthenticated, allow("customer_types"), getPriceUsage);

customerTypeRoutes.patch("/assign-customer-type", isAuthenticated, allow("customer_types"), assignCustomerType);

customerTypeRoutes.post("/swap-pricing", isAuthenticated, allow("customer_types"), swapCustomerTypePricing);

customerTypeRoutes.post("/", isAuthenticated, allow("customer_types"), createCustomerType);

customerTypeRoutes.patch("/:customerTypeId/status", isAuthenticated, allow("customer_types"), toggleCustomerTypeStatus);

customerTypeRoutes.get("/:customerTypeId", isAuthenticated, allow("customer_types"), getCustomerTypeById);

customerTypeRoutes.patch("/:customerTypeId", isAuthenticated, allow("customer_types"), updateCustomerType);

customerTypeRoutes.delete("/:customerTypeId", isAuthenticated, allow("customer_types"), deleteCustomerType);

export default customerTypeRoutes;
