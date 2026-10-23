import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/jwt.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.admin_token as string | undefined;
  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
