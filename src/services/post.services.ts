import prisma from "../prisma";

export interface PostData {
  content: string;
  images?: string[];
  videos?: string[];
  isActive?: boolean;
  restaurantId: string;
}

// Delete posts older than 24 hours
const deleteOldPostsService = async () => {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  await prisma.post.deleteMany({
    where: {
      createdAt: {
        lt: oneDayAgo,
      },
    },
  });
};

// Create Post
export const createPostService = async (postData: PostData) => {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: postData.restaurantId },
  });

  if (!restaurant) {
    throw new Error("Restaurant not found");
  }

  const post = await prisma.post.create({
    data: {
      content: postData.content.trim(),
      images: postData.images || [],
      videos: postData.videos || [],
      isActive: postData.isActive ?? true,
      restaurantId: postData.restaurantId,
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return post;
};

// Get all Posts with filtering and pagination
export const getAllPostsService = async ({
  search,
  isActive,
  restaurantId,
  page = 1,
  limit = 10,
}: {
  search?: string;
  isActive?: boolean;
  restaurantId?: string;
  page?: number;
  limit?: number;
}) => {
  await deleteOldPostsService();
  const skip = (page - 1) * limit;

  const where: any = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (restaurantId) {
    where.restaurantId = restaurantId;
  }

  if (search) {
    where.OR = [{ content: { contains: search, mode: "insensitive" } }];
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get Featured Posts (from restaurants with active advertising subscriptions)
export const getFeaturedPostsService = async ({
  page = 1,
  limit = 10,
}: {
  page?: number;
  limit?: number;
}) => {
  await deleteOldPostsService();
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        isActive: true,
        restaurant: {
          subscriptions: {
            some: {
              status: "ACTIVE",
              plan: {
                advertisingAccess: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.post.count({
      where: {
        isActive: true,
        restaurant: {
          subscriptions: {
            some: {
              status: "ACTIVE",
              plan: {
                advertisingAccess: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

// Get Post by ID
export const getPostByIdService = async (postId: string) => {
  await deleteOldPostsService();
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  return post;
};

// Update Post
export const updatePostService = async (
  postId: string,
  updateData: Partial<PostData>,
  restaurantId: string
) => {
  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!existingPost) {
    throw new Error("Post not found");
  }

  if (existingPost.restaurantId !== restaurantId) {
    throw new Error("You can only update your own posts");
  }

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      ...(updateData.content !== undefined && {
        content: updateData.content.trim(),
      }),
      ...(updateData.images !== undefined && {
        images: updateData.images,
      }),
      ...(updateData.videos !== undefined && {
        videos: updateData.videos,
      }),
      ...(updateData.isActive !== undefined && {
        isActive: updateData.isActive,
      }),
    },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updatedPost;
};

// Delete Post
export const deletePostService = async (
  postId: string,
  restaurantId: string
) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  if (post.restaurantId !== restaurantId) {
    throw new Error("You can only delete your own posts");
  }

  await prisma.post.delete({
    where: { id: postId },
  });

  return { message: "Post deleted successfully" };
};

// Get Posts by Restaurant ID
export const getPostsByRestaurantService = async (
  restaurantId: string,
  {
    page = 1,
    limit = 10,
    isActive,
  }: { page?: number; limit?: number; isActive?: boolean }
) => {
  await deleteOldPostsService();
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
