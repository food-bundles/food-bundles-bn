import { Router } from "express";
import {
  addNotificationRecipient,
  getAllNotificationRecipients,
  updateNotificationRecipient,
  deleteNotificationRecipient,
} from "../controllers/notification-recipient.controller";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";

const smsNotifyRouter = Router();

smsNotifyRouter.use(isAuthenticated);
smsNotifyRouter.use(checkPermission("ADMIN"));
smsNotifyRouter.post("/", addNotificationRecipient);
smsNotifyRouter.get("/", getAllNotificationRecipients);
smsNotifyRouter.patch("/:id", updateNotificationRecipient);
smsNotifyRouter.delete("/:id", deleteNotificationRecipient);

export default smsNotifyRouter;
