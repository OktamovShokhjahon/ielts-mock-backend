import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAdmin } from "../middleware/auth.js";
import { MockTest } from "../models/MockTest.js";
import { Attempt } from "../models/Attempt.js";
import { generatePinCode } from "../utils/pin.js";
import { scoreSection, overallBand, collectQuestions } from "../utils/scoring.js";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp3";
    cb(null, `audio-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "audio/mpeg" || file.originalname.toLowerCase().endsWith(".mp3")) {
      cb(null, true);
    } else {
      cb(new Error("Only MP3 files are allowed"));
    }
  },
});

export const adminMocksRouter = Router();
adminMocksRouter.use(requireAdmin);

async function mockSummary(mockId: string) {
  const attempts = await Attempt.find({ mockId }).lean();
  const n = attempts.length;
  const participants = new Set(
    attempts.map((a) => {
      const p = a.participant as { fullName?: string; firstName?: string; lastName?: string } | undefined;
      const name =
        p?.fullName?.trim() ||
        [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() ||
        "";
      return name;
    })
  ).size;
  const withBand = attempts.filter((a) => a.bandScore != null);
  const avg =
    withBand.length > 0
      ? Math.round((withBand.reduce((s, a) => s + (a.bandScore ?? 0), 0) / withBand.length) * 100) / 100
      : null;
  return { attempts: n, participants, averageScore: avg };
}

adminMocksRouter.get("/mocks", async (_req, res) => {
  try {
    const mocks = await MockTest.find().sort({ createdAt: -1 }).lean();
    res.json(mocks);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.get("/mocks/:id/summary", async (req, res) => {
  try {
    res.json(await mockSummary(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.get("/mocks/:id/attempts", async (req, res) => {
  try {
    const attempts = await Attempt.find({ mockId: req.params.id }).sort({ createdAt: -1 }).lean();
    res.json(attempts);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.get("/mocks/:id", async (req, res) => {
  try {
    const mock = await MockTest.findById(req.params.id).lean();
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    res.json(mock);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.post("/mocks", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const title = String(body.title || "Untitled mock");
    const timeLimits = body.timeLimits as { listeningSec?: number; readingSec?: number; writingSec?: number } | undefined;
    const sections = body.sections || { reading: { parts: [] }, listening: { parts: [] }, writing: { tasks: [] } };
    const pinCode = generatePinCode();
    const status = body.status === "active" ? "active" : "draft";

    const doc = await MockTest.create({
      title,
      pinCode,
      isActive: status === "active",
      status,
      timeLimits: {
        listeningSec: Number(timeLimits?.listeningSec ?? 1800),
        readingSec: Number(timeLimits?.readingSec ?? 3600),
        writingSec: Number(timeLimits?.writingSec ?? 3600),
      },
      sections: sections as Record<string, unknown>,
    });

    res.status(201).json(doc.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.patch("/mocks/:id", async (req, res) => {
  try {
    const updates = req.body as Record<string, unknown>;
    const mock = await MockTest.findById(req.params.id);
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    if (typeof updates.title === "string") mock.title = updates.title;
    if (updates.timeLimits && typeof updates.timeLimits === "object") {
      const t = updates.timeLimits as Record<string, number>;
      if (!mock.timeLimits) mock.set("timeLimits", {});
      if (t.listeningSec != null) mock.timeLimits!.listeningSec = Number(t.listeningSec);
      if (t.readingSec != null) mock.timeLimits!.readingSec = Number(t.readingSec);
      if (t.writingSec != null) mock.timeLimits!.writingSec = Number(t.writingSec);
    }
    if (updates.sections && typeof updates.sections === "object") {
      mock.set("sections", updates.sections);
    }
    if (typeof updates.isActive === "boolean") mock.isActive = updates.isActive;
    if (typeof updates.status === "string") mock.set("status", updates.status);
    await mock.save();
    res.json(mock.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.delete("/mocks/:id", async (req, res) => {
  try {
    const r = await MockTest.findByIdAndDelete(req.params.id);
    if (!r) { res.status(404).json({ error: "Not found" }); return; }
    await Attempt.deleteMany({ mockId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.post("/mocks/:id/activate", async (req, res) => {
  try {
    const mock = await MockTest.findById(req.params.id);
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    const newPin = generatePinCode();
    mock.pinCode = newPin;
    mock.isActive = true;
    mock.set("status", "active");
    await mock.save();
    res.json(mock.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.post("/mocks/:id/deactivate", async (req, res) => {
  try {
    const mock = await MockTest.findById(req.params.id);
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    mock.isActive = false;
    mock.set("status", "draft");
    await mock.save();
    res.json(mock.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.post("/mocks/:id/parts/:partId/audio", upload.single("audio"), async (req, res) => {
  try {
    const mock = await MockTest.findById(req.params.id);
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No audio file" }); return; }

    const parts = mock.sections?.listening?.parts;
    if (!parts) { res.status(500).json({ error: "Invalid mock sections" }); return; }

    const part = parts.find((p) => p.id === req.params.partId);
    if (!part) { res.status(404).json({ error: "Part not found" }); return; }

    if (part.audioFile) {
      const oldPath = path.join(uploadDir, part.audioFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    part.audioFile = file.filename;
    await mock.save();
    res.json({ filename: file.filename });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Keep legacy endpoint for backwards compat
adminMocksRouter.post("/mocks/:id/listening-audio", upload.single("audio"), async (req, res) => {
  try {
    const mock = await MockTest.findById(req.params.id);
    if (!mock) { res.status(404).json({ error: "Not found" }); return; }
    const file = req.file;
    if (!file) { res.status(400).json({ error: "No audio file" }); return; }
    const parts = mock.sections?.listening?.parts;
    if (parts && parts.length > 0) {
      if (parts[0].audioFile) {
        const oldPath = path.join(uploadDir, parts[0].audioFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      parts[0].audioFile = file.filename;
    }
    await mock.save();
    res.json(mock.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.patch("/attempts/:id", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
    const body = req.body as { scores?: { listening?: number; reading?: number }; bandScore?: number };
    if (body.scores) {
      const sc = attempt.scores ?? { listening: null, reading: null };
      if (body.scores.listening != null) sc.listening = body.scores.listening;
      if (body.scores.reading != null) sc.reading = body.scores.reading;
      attempt.scores = sc;
    }
    if (body.bandScore != null) attempt.bandScore = Number(body.bandScore);
    await attempt.save();
    res.json(attempt.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

adminMocksRouter.post("/attempts/:id/auto-score", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
    const mock = await MockTest.findById(attempt.mockId);
    if (!mock) { res.status(404).json({ error: "Mock not found" }); return; }

    const sec = mock.sections;
    if (!sec) { res.status(500).json({ error: "Invalid mock" }); return; }

    const listenQs = collectQuestions(sec.listening.parts || []);
    const readQs = collectQuestions(sec.reading.parts || []);
    const ans = attempt.answers ?? { listening: {}, reading: {}, writing: {} };
    const lScore = scoreSection(listenQs, ans.listening as Record<string, string>);
    const rScore = scoreSection(readQs, ans.reading as Record<string, string>);

    attempt.scores = attempt.scores ?? { listening: null, reading: null };
    attempt.scores.listening = lScore.percent;
    attempt.scores.reading = rScore.percent;
    if (attempt.bandScore == null) {
      attempt.bandScore = overallBand(lScore.percent, rScore.percent);
    }
    await attempt.save();
    res.json(attempt.toObject());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
