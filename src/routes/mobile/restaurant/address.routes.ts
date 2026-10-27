import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileAddressList,
  mobileAddressCreate,
  mobileAddressUpdate,
  mobileAddressDelete,
} from "../../../controllers/mobile/restaurant/address.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// GET    /mobile/restaurant/addresses
router.get("/", ...guard, mobileAddressList);

// POST   /mobile/restaurant/addresses
router.post("/", ...guard, mobileAddressCreate);

// PUT    /mobile/restaurant/addresses/:addressId
router.put("/:addressId", ...guard, mobileAddressUpdate);

// DELETE /mobile/restaurant/addresses/:addressId
router.delete("/:addressId", ...guard, mobileAddressDelete);

export default router;
