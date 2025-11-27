import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/products");
  },

  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    if (
      file.mimetype === "image/jpeg" ||
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/webp" ||
      file.mimetype === "image/gif" ||
      file.mimetype === "image/svg+xml" ||
      file.mimetype === "image/avif" ||
      file.mimetype === "image/bmp" ||
      file.mimetype === "image/tiff" ||
      file.mimetype === "image/x-icon" ||
      file.mimetype === "image/heic" ||
      file.mimetype === "image/heif" ||
      file.mimetype === "image/vnd.adobe.photoshop"
    ) {
      callback(null, true);
    } else {
      // prevent to upload files
      console.log("only jpeg, jpg, gif, webp & png supported!");
      callback(null, false);
    }
  },
});

const productImagesUpload = upload.fields([{ name: "images", maxCount: 15 }]);

export default productImagesUpload;
