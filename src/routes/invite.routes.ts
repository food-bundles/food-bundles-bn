import { Router } from "express";
import { inviteController } from "../controllers/invite.controller";
import { isAuthenticated, allow } from "../middleware/authMiddleware";

const inviteRoutes = Router();

// Create invitation (Admin only)
inviteRoutes.post(
  "/",
  isAuthenticated,
  allow("invitations"),
  inviteController.createInvite
);

// Get all invitations (Admin only)
inviteRoutes.get(
  "/",
  isAuthenticated,
  allow("invitations"),
  inviteController.getAllInvites
);

// Get invitation by ID (Admin only)
inviteRoutes.get(
  "/:id",
  isAuthenticated,
  allow("invitations"),
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
  allow("invitations"),
  inviteController.resendInvite
);

// Cancel invitation (Admin only)
inviteRoutes.delete(
  "/:id",
  isAuthenticated,
  allow("invitations"),
  inviteController.cancelInvite
);

export default inviteRoutes;
