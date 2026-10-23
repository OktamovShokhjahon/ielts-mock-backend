import mongoose from "mongoose";

export type SectionName = "listening" | "reading" | "writing" | "done";

const attemptSchema = new mongoose.Schema(
  {
    mockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MockTest",
      required: true,
      index: true,
    },
    participant: {
      fullName: { type: String, required: true, trim: true },
    },
    answers: {
      listening: { type: mongoose.Schema.Types.Mixed, default: {} },
      reading: { type: mongoose.Schema.Types.Mixed, default: {} },
      writing: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    scores: {
      listening: { type: Number, default: null },
      reading: { type: Number, default: null },
    },
    bandScore: { type: Number, default: null, min: 0, max: 9 },
    currentSection: {
      type: String,
      enum: ["listening", "reading", "writing", "done"],
      default: "listening",
    },
    sectionEndsAt: { type: Date, default: null },
    visibilityBlurCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Attempt = mongoose.model("Attempt", attemptSchema);
