import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/posts");
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageMimes = [
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const allowedVideoMimes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo", // .avi
    "video/webm",
  ];

  if (file.fieldname === "images" && allowedImageMimes.includes(file.mimetype)) {
    cb(null, true);
  } else if (file.fieldname === "videos" && allowedVideoMimes.includes(file.mimetype)) {
    // Check video file size (10MB limit)
    if (file.size && file.size > 10 * 1024 * 1024) {
      cb(new Error("Video files must be less than 10MB"));
    } else {
      cb(null, true);
    }
  } else {
    cb(new Error("Only image files (JPEG, PNG, GIF, WebP) and video files (MP4, MPEG, MOV, AVI, WebM) are allowed"));
  }
};

const postUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Maximum 10 files total
  },
});

const postFilesUpload = postUpload.fields([
  { name: "images", maxCount: 5 },
  { name: "videos", maxCount: 3 }
]);

export default postFilesUpload;