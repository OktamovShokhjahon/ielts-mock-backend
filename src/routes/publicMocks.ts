import { Router } from "express";
import { MockTest } from "../models/MockTest.js";

export const publicMocksRouter = Router();

publicMocksRouter.get("/mocks", async (req, res) => {
  try {
    const activeOnly = req.query.active === "true";
    const q = activeOnly ? { isActive: true } : {};
    const mocks = await MockTest.find(q).sort({ createdAt: -1 }).select("title createdAt isActive").lean();
    res.json(mocks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

publicMocksRouter.post("/mocks/:id/verify-pin", async (req, res) => {
  try {
    const { pin } = req.body as { pin?: string };
    const mock = await MockTest.findById(req.params.id);
    if (!mock || !mock.isActive) {
      res.status(404).json({ error: "Mock not available" });
      return;
    }
    if (String(pin) !== mock.pinCode) {
      res.status(403).json({ error: "Invalid PIN" });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
