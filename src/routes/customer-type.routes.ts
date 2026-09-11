import { Router } from "express";
import {
  createCustomerType,
  getAllCustomerTypes,
  getCustomerTypeById,
  updateCustomerType,
  deleteCustomerType,
  toggleCustomerTypeStatus,
} from "../controllers/customer-type.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";

const customerTypeRoutes = Router();

customerTypeRoutes.get("/", getAllCustomerTypes);

customerTypeRoutes.post("/", isAuthenticated, checkPermission("ADMIN"), createCustomerType);

customerTypeRoutes.patch("/:customerTypeId/status", isAuthenticated, checkPermission("ADMIN"), toggleCustomerTypeStatus);

customerTypeRoutes.get("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), getCustomerTypeById);

customerTypeRoutes.patch("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), updateCustomerType);

customerTypeRoutes.delete("/:customerTypeId", isAuthenticated, checkPermission("ADMIN"), deleteCustomerType);

export default customerTypeRoutes;
