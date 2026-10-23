import { Router } from "express";
import { signAdminToken } from "../utils/jwt.js";

const ADMIN_USER = process.env.ADMIN_USERNAME ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? "a@a@admina@a@";

export const adminAuthRouter = Router();

adminAuthRouter.post("/login", (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = signAdminToken();
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ error: "Invalid credentials" });
});

adminAuthRouter.post("/logout", (_req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});
