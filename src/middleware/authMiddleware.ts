import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { getUserById } from "../services/userGets";

export const isAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
      const user = getUserById(decoded.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};


export const checkPermission = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;

        if (!user || !allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: "Forbidden: Access denied" });
        }

        next();
    };
}
