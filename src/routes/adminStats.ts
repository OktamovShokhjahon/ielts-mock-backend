import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { MockTest } from "../models/MockTest.js";
import { Attempt } from "../models/Attempt.js";

export const adminStatsRouter = Router();
adminStatsRouter.use(requireAdmin);

adminStatsRouter.get("/stats", async (_req, res) => {
  try {
    const totalMocks = await MockTest.countDocuments();
    const totalAttempts = await Attempt.countDocuments();
    const participantsAgg = await Attempt.aggregate([
      {
        $group: {
          _id: {
            $ifNull: [
              "$participant.fullName",
              {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$participant.firstName", ""] },
                      " ",
                      { $ifNull: ["$participant.lastName", ""] },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      { $count: "n" },
    ]);
    const totalParticipants = participantsAgg[0]?.n ?? 0;

    const withScores = await Attempt.find({
      "scores.listening": { $ne: null },
      "scores.reading": { $ne: null },
    }).lean();

    let avgBand = 0;
    if (withScores.length > 0) {
      const sum = withScores.reduce((acc, a) => acc + (a.bandScore ?? 0), 0);
      avgBand = Math.round((sum / withScores.length) * 100) / 100;
    }

    res.json({
      totalMocks,
      totalAttempts,
      totalParticipants,
      averageBand: withScores.length ? avgBand : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
