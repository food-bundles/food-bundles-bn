import { Request, Response } from "express";
import {
  createPostService,
  getAllPostsService,
  getPostByIdService,
  updatePostService,
  deletePostService,
  getPostsByRestaurantService,
  getFeaturedPostsService,
} from "../services/post.services";
import cloudinary from "../utils/cloudinary.utility";

// Create Post
export const createPost = async (req: Request, res: Response) => {
  try {
    const { content, isActive } = req.body;
    const restaurantId = (req as any).user.id;

    if (!content) {
      return res.status(400).json({
        message: "Content is required",
      });
    }

    // Handle file uploads
    let imageUrls: string[] = [];
    let videoUrls: string[] = [];

    if (req.files && !Array.isArray(req.files)) {
      const filesDict = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      // Handle image uploads
      if (filesDict["images"]) {
        for (let index = 0; index < filesDict["images"].length; index++) {
          const uploadResult = await cloudinary.v2.uploader.upload(
            filesDict["images"][index].path
          );
          imageUrls.push(uploadResult.secure_url);
        }
      }

      // Handle video uploads
      if (filesDict["videos"]) {
        for (let index = 0; index < filesDict["videos"].length; index++) {
          const file = filesDict["videos"][index];

          // Check file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
              message: "Video files must be less than 10MB",
            });
          }

          const uploadResult = await cloudinary.v2.uploader.upload(file.path, {
            resource_type: "video",
          });
          videoUrls.push(uploadResult.secure_url);
        }
      }
    }

    const post = await createPostService({
      content,
      images: imageUrls,
      videos: videoUrls,
      isActive: isActive === "true" || isActive === true,
      restaurantId,
    });

    res.status(201).json({
      message: "Post created successfully",
      data: post,
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to create post",
    });
  }
};

// Get all Posts
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    const { search, isActive, restaurantId, page = 1, limit = 10 } = req.query;

    const result = await getAllPostsService({
      search: search as string,
      isActive: isActive ? isActive === "true" : undefined,
      restaurantId: restaurantId as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Posts retrieved successfully",
      data: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get posts",
    });
  }
};

// Get Post by ID
export const getPostById = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const post = await getPostByIdService(postId);

    res.status(200).json({
      message: "Post retrieved successfully",
      data: post,
    });
  } catch (error: any) {
    if (error.message === "Post not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get post",
    });
  }
};

// Update Post
export const updatePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const updateData = req.body;
    const restaurantId = (req as any).user.id;

    // Handle file uploads
    let imageUrls: string[] = [];
    let videoUrls: string[] = [];

    if (req.files && !Array.isArray(req.files)) {
      const filesDict = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };

      // Handle image uploads
      if (filesDict["images"]) {
        for (let index = 0; index < filesDict["images"].length; index++) {
          const uploadResult = await cloudinary.v2.uploader.upload(
            filesDict["images"][index].path
          );
          imageUrls.push(uploadResult.secure_url);
        }
        updateData.images = imageUrls;
      }

      // Handle video uploads
      if (filesDict["videos"]) {
        for (let index = 0; index < filesDict["videos"].length; index++) {
          const file = filesDict["videos"][index];

          // Check file size (10MB limit)
          if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({
              message: "Video files must be less than 10MB",
            });
          }

          const uploadResult = await cloudinary.v2.uploader.upload(file.path, {
            resource_type: "video",
          });
          videoUrls.push(uploadResult.secure_url);
        }
        updateData.videos = videoUrls;
      }
    }

    // Parse boolean fields
    if (updateData.isActive !== undefined) {
      updateData.isActive =
        updateData.isActive === "true" || updateData.isActive === true;
    }

    const updatedPost = await updatePostService(
      postId,
      updateData,
      restaurantId
    );

    res.status(200).json({
      message: "Post updated successfully",
      data: updatedPost,
    });
  } catch (error: any) {
    if (error.message === "Post not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (error.message === "You can only update your own posts") {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to update post",
    });
  }
};

// Delete Post
export const deletePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const restaurantId = (req as any).user.id;

    const result = await deletePostService(postId, restaurantId);

    res.status(200).json({
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "Post not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (error.message === "You can only delete your own posts") {
      return res.status(403).json({
        message: error.message,
      });
    }

    res.status(500).json({
      message: error.message || "Failed to delete post",
    });
  }
};

// Get Posts by Restaurant
export const getPostsByRestaurant = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { page = 1, limit = 10, isActive } = req.query;

    const result = await getPostsByRestaurantService(restaurantId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      isActive: isActive ? isActive === "true" : undefined,
    });

    res.status(200).json({
      message: "Restaurant posts retrieved successfully",
      data: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get restaurant posts",
    });
  }
};

// Get My Posts (for authenticated restaurant)
export const getMyPosts = async (req: Request, res: Response) => {
  try {
    const restaurantId = (req as any).user.id;
    const { page = 1, limit = 10, isActive } = req.query;

    const result = await getPostsByRestaurantService(restaurantId, {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      isActive: isActive ? isActive === "true" : undefined,
    });

    res.status(200).json({
      message: "My posts retrieved successfully",
      data: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get my posts",
    });
  }
};

// Get Featured Posts (public)
export const getFeaturedPosts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const result = await getFeaturedPostsService({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });

    res.status(200).json({
      message: "Featured posts retrieved successfully",
      data: result.posts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      message: error.message || "Failed to get featured posts",
    });
  }
};
