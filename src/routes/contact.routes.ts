import { Router } from "express";
import {
  createContactSubmission,
  getContactSubmissions,
  getContactSubmission,
  updateContactSubmission,
  deleteContactSubmission,
  respondToSubmission,
} from "../controllers/contact.controller";

const router = Router();

router.post("/", createContactSubmission);
router.get("/", getContactSubmissions);
router.get("/:id", getContactSubmission);
router.put("/:id", updateContactSubmission);
router.delete("/:id", deleteContactSubmission);
router.post("/:id/respond", respondToSubmission);

export default router;
