import { Router } from "express";
import {
  createSupportRequest,
  getSupportRequests,
  getSupportRequest,
  updateSupportRequest,
  deleteSupportRequest,
} from "../controllers/support.controller";
import { upload } from "../utils/imageUpload";

const supportRoutes = Router();

// Accept multipart (with screenshots) or JSON. upload.any() parses multipart
// fields into req.body and files into req.files; pure JSON still works via
// the global express.json() middleware.
supportRoutes.post("/", upload.any(), createSupportRequest);
supportRoutes.get("/", getSupportRequests);
supportRoutes.get("/:id", getSupportRequest);
supportRoutes.put("/:id", updateSupportRequest);
supportRoutes.delete("/:id", deleteSupportRequest);

export default supportRoutes;