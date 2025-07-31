import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

// Create uploads directory if it doesn't exist
const uploadDir = "uploads/products";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// File filter to accept only images
const fileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"));
  }
};

// Multer upload configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 4, // Maximum 4 files
  },
});

// Function to upload images and return URLs
export const uploadImages = async (
  files: Express.Multer.File[]
): Promise<string[]> => {
  if (!files || files.length === 0) {
    return [];
  }

  if (files.length > 4) {
    throw new Error("Maximum 4 images allowed");
  }

  // Generate URLs for uploaded files
  const imageUrls = files.map((file) => {
    return `/uploads/products/${file.filename}`;
  });

  return imageUrls;
};

// Function to delete images from disk
export const deleteImages = async (imageUrls: string[]): Promise<void> => {
  for (const url of imageUrls) {
    try {
      const filename = path.basename(url);
      const filePath = path.join(uploadDir, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error deleting image ${url}:`, error);
    }
  }
};

// Middleware to handle image validation
export const validateImages = (req: any, res: any, next: any) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return next();
  }

  if (files.length > 4) {
    return res.status(400).json({
      message: "Maximum 4 images allowed",
    });
  }

  // Check file sizes
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        message: "Each image must be less than 5MB",
      });
    }
  }

  next();
};
