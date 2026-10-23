import { Router, Request, Response } from "express";
import { isAuthenticated, superAdminOnly } from "../middleware/authMiddleware";
import {
  deleteUserPermanently,
  isManagedUserType,
  listTrash,
  restoreUserFromTrash,
  setManagedUserPassword,
  UserManagementError,
} from "../services/user-management.service";

// Super admin tools for user accounts: the trash (soft-deleted farmers,
// restaurants and admin users) and setting a new password.
const userTrashRoutes = Router();
userTrashRoutes.use(isAuthenticated, superAdminOnly);

const fail = (res: Response, error: any) =>
  res
    .status(error instanceof UserManagementError ? error.status : 500)
    .json({ success: false, message: error.message || "Something went wrong" });

const typeParam = (req: Request) => {
  const type = req.params.type;
  if (!isManagedUserType(type)) {
    throw new UserManagementError("User type must be farmer, restaurant or admin");
  }
  return type;
};

/** GET /user-admin/trash?type=farmer|restaurant|admin */
userTrashRoutes.get("/trash", async (req: Request, res: Response) => {
  try {
    const type = req.query.type;
    if (type !== undefined && !isManagedUserType(type)) {
      throw new UserManagementError("User type must be farmer, restaurant or admin");
    }
    res.json({ success: true, data: await listTrash(type) });
  } catch (error) {
    fail(res, error);
  }
});

/** PATCH /user-admin/trash/:type/:id/restore */
userTrashRoutes.patch("/trash/:type/:id/restore", async (req: Request, res: Response) => {
  try {
    await restoreUserFromTrash(typeParam(req), req.params.id as string);
    res.json({ success: true, message: "User restored" });
  } catch (error) {
    fail(res, error);
  }
});

/** DELETE /user-admin/trash/:type/:id — delete forever (only from the trash) */
userTrashRoutes.delete("/trash/:type/:id", async (req: Request, res: Response) => {
  try {
    await deleteUserPermanently(typeParam(req), req.params.id as string);
    res.json({ success: true, message: "User deleted permanently" });
  } catch (error) {
    fail(res, error);
  }
});

/** PATCH /user-admin/:type/:id/password { password } — set a new password */
userTrashRoutes.patch("/:type/:id/password", async (req: Request, res: Response) => {
  try {
    await setManagedUserPassword(typeParam(req), req.params.id as string, req.body?.password);
    res.json({ success: true, message: "Password updated" });
  } catch (error) {
    fail(res, error);
  }
});

export default userTrashRoutes;
