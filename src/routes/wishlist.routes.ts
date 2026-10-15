import { Router } from "express";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../controllers/wishlist.controller";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";

// Wishlist of saved products — buyers only (restaurants, hotels, affiliators)
const wishlistRoutes = Router();

wishlistRoutes.use(isAuthenticated, checkPermission("RESTAURANT", "HOTEL", "AFFILIATOR"));

wishlistRoutes.get("/", getWishlist);
wishlistRoutes.post("/:productId", addToWishlist);
wishlistRoutes.delete("/:productId", removeFromWishlist);

export default wishlistRoutes;
