import { Router } from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getPostsByRestaurant,
  getMyPosts,
} from "../controllers/post.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import productImagesUpload from "../middleware/multer";

const postRoutes = Router();

// Get my posts (for authenticated restaurant)
postRoutes.get(
  "/my-posts",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyPosts
);

// Get posts by restaurant ID (public)
postRoutes.get("/restaurant/:restaurantId", getPostsByRestaurant);

// Create new post (Restaurant only)
postRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  productImagesUpload,
  createPost
);

// Get all posts with filtering and pagination
postRoutes.get("/", getAllPosts);

// Get post by ID (public)
postRoutes.get("/:postId", getPostById);

// Update post (Restaurant only - own posts)
postRoutes.patch(
  "/:postId",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  productImagesUpload,
  updatePost
);

// Delete post (Restaurant only - own posts)
postRoutes.delete(
  "/:postId",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  deletePost
);

export default postRoutes;