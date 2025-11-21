import { Router } from "express";
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  getPostsByRestaurant,
  getMyPosts,
  getFeaturedPosts,
} from "../controllers/post.controller";
import { isAuthenticated, checkPermission } from "../middleware/authMiddleware";
import postFilesUpload from "../middleware/postMulter";

const postRoutes = Router();

// Get my posts (for authenticated restaurant)
postRoutes.get(
  "/my-posts",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  getMyPosts
);

// Get featured posts (public)
postRoutes.get("/featured", getFeaturedPosts);

// Get posts by restaurant ID (public)
postRoutes.get("/restaurant/:restaurantId", getPostsByRestaurant);

// Create new post (Restaurant only)
postRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("RESTAURANT"),
  postFilesUpload,
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
  postFilesUpload,
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