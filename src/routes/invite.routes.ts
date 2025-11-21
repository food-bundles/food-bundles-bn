import { Router } from "express";
import { inviteController } from "../controllers/invite.controller";
import { checkPermission, isAuthenticated } from "../middleware/authMiddleware";

const inviteRoutes = Router();

// Create invitation (Admin only)
inviteRoutes.post(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  inviteController.createInvite
);

// Get all invitations (Admin only)
inviteRoutes.get(
  "/",
  isAuthenticated,
  checkPermission("ADMIN"),
  inviteController.getAllInvites
);

// Get invitation by ID (Admin only)
inviteRoutes.get(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  inviteController.getInviteById
);

// Verify invitation token (Public)
inviteRoutes.get("/verify/:token", inviteController.verifyInviteToken);

// Accept invitation (Public)
inviteRoutes.post("/accept", inviteController.acceptInvite);

// Resend invitation (Admin only)
inviteRoutes.post(
  "/:id/resend",
  isAuthenticated,
  checkPermission("ADMIN"),
  inviteController.resendInvite
);

// Cancel invitation (Admin only)
inviteRoutes.delete(
  "/:id",
  isAuthenticated,
  checkPermission("ADMIN"),
  inviteController.cancelInvite
);

export default inviteRoutes;
