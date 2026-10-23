import { Router } from "express";
import { Attempt } from "../models/Attempt.js";
import { MockTest } from "../models/MockTest.js";
import { sanitizeMockForExam } from "../utils/sanitizeMock.js";
import { scoreSection, overallBand, collectQuestions } from "../utils/scoring.js";

export const attemptsRouter = Router();

attemptsRouter.post("/attempts", async (req, res) => {
  try {
    const { mockId, fullName, pin } = req.body as {
      mockId?: string;
      fullName?: string;
      pin?: string;
    };
    if (!mockId || !fullName?.trim()) {
      res.status(400).json({ error: "Missing fields" }); return;
    }
    const mock = await MockTest.findById(mockId);
    if (!mock || !mock.isActive) { res.status(404).json({ error: "Mock not available" }); return; }
    if (String(pin) !== mock.pinCode) { res.status(403).json({ error: "Invalid PIN" }); return; }

    const listeningSec = mock.timeLimits?.listeningSec ?? 1800;
    const ends = new Date(Date.now() + listeningSec * 1000);

    const attempt = await Attempt.create({
      mockId: mock._id,
      participant: { fullName: fullName.trim() },
      answers: { listening: {}, reading: {}, writing: {} },
      currentSection: "listening",
      sectionEndsAt: ends,
    });

    res.status(201).json({
      attempt: attempt.toObject(),
      mock: sanitizeMockForExam(mock.toObject()),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

attemptsRouter.get("/attempts/:id", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
    const mock = await MockTest.findById(attempt.mockId);
    if (!mock) { res.status(404).json({ error: "Mock not found" }); return; }
    res.json({
      attempt: attempt.toObject(),
      mock: sanitizeMockForExam(mock.toObject()),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

attemptsRouter.patch("/attempts/:id", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
    if (attempt.completedAt) { res.status(400).json({ error: "Attempt already completed" }); return; }

    const body = req.body as {
      answers?: {
        listening?: Record<string, string>;
        reading?: Record<string, string>;
        writing?: Record<string, string>;
      };
      currentSection?: "listening" | "reading" | "writing" | "done";
      sectionEndsAt?: string | null;
      visibilityBlurCount?: number;
    };

    if (body.answers) {
      const base = attempt.answers ?? { listening: {}, reading: {}, writing: {} };
      if (body.answers.listening) base.listening = { ...(base.listening as object), ...body.answers.listening };
      if (body.answers.reading) base.reading = { ...(base.reading as object), ...body.answers.reading };
      if (body.answers.writing) base.writing = { ...(base.writing as object), ...body.answers.writing };
      attempt.answers = base;
    }
    if (body.currentSection) attempt.currentSection = body.currentSection;
    if (body.sectionEndsAt !== undefined) {
      attempt.sectionEndsAt = body.sectionEndsAt ? new Date(body.sectionEndsAt) : null;
    }
    if (typeof body.visibilityBlurCount === "number") attempt.visibilityBlurCount = body.visibilityBlurCount;

    await attempt.save();
    const mock = await MockTest.findById(attempt.mockId);
    res.json({
      attempt: attempt.toObject(),
      mock: mock ? sanitizeMockForExam(mock.toObject()) : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

attemptsRouter.post("/attempts/:id/complete", async (req, res) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) { res.status(404).json({ error: "Not found" }); return; }
    if (attempt.completedAt) { res.json({ attempt: attempt.toObject() }); return; }

    const body = req.body as {
      answers?: {
        listening?: Record<string, string>;
        reading?: Record<string, string>;
        writing?: Record<string, string>;
      };
    };
    if (body.answers) {
      const base = attempt.answers ?? { listening: {}, reading: {}, writing: {} };
      if (body.answers.listening) base.listening = { ...(base.listening as object), ...body.answers.listening };
      if (body.answers.reading) base.reading = { ...(base.reading as object), ...body.answers.reading };
      if (body.answers.writing) base.writing = { ...(base.writing as object), ...body.answers.writing };
      attempt.answers = base;
    }

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
    attempt.bandScore = overallBand(lScore.percent, rScore.percent);
    attempt.currentSection = "done";
    attempt.completedAt = new Date();

    await attempt.save();
    res.json({ attempt: attempt.toObject() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
