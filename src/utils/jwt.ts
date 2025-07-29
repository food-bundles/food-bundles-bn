
import jwt from "jsonwebtoken";
import { ENV } from "../config";
import { JwtPayload } from "../types/userTypes";


export const generateToken = (payload: JwtPayload):string => {
    return jwt.sign(payload, ENV.JWT_SECRET as string, {
      expiresIn:  "24h",
    });
};

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, ENV.JWT_SECRET as string);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
};

