import { Router } from "express";
import { isAuthenticated, checkPermission } from "../../../middleware/authMiddleware";
import {
  mobileCartAdd,
  mobileCartGet,
  mobileCartSummary,
  mobileCartUpdateItem,
  mobileCartRemoveItem,
  mobileCartClear,
} from "../../../controllers/mobile/restaurant/cart.controller";

const router = Router();
const guard = [isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR")];

// POST   /mobile/restaurant/carts
router.post("/", ...guard, mobileCartAdd);

// GET    /mobile/restaurant/carts
router.get("/", ...guard, mobileCartGet);

// GET    /mobile/restaurant/carts/summary
router.get("/summary", ...guard, mobileCartSummary);

// PUT    /mobile/restaurant/carts/items/:cartItemId
router.put("/items/:cartItemId", ...guard, mobileCartUpdateItem);

// DELETE /mobile/restaurant/carts/items/:cartItemId
router.delete("/items/:cartItemId", ...guard, mobileCartRemoveItem);

// DELETE /mobile/restaurant/carts/clear
router.delete("/clear", ...guard, mobileCartClear);

export default router;
