import { Router } from "express";
import {
  addNotificationRecipient,
  getAllNotificationRecipients,
  updateNotificationRecipient,
  deleteNotificationRecipient,
} from "../controllers/notification-recipient.controller";
import { allow, isAuthenticated } from "../middleware/authMiddleware";

const smsNotifyRouter = Router();

smsNotifyRouter.use(isAuthenticated);
smsNotifyRouter.use(allow("sms_recipients"));
smsNotifyRouter.post("/", addNotificationRecipient);
smsNotifyRouter.get("/", getAllNotificationRecipients);
smsNotifyRouter.patch("/:id", updateNotificationRecipient);
smsNotifyRouter.delete("/:id", deleteNotificationRecipient);

export default smsNotifyRouter;
