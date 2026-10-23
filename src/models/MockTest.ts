import mongoose from "mongoose";

export type QuestionType = "multiple_choice" | "true_false_ng" | "fill_blank" | "matching";

export interface IMatchPair {
  left: string;
  right: string;
}

export interface IQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctAnswer?: string;
  matchingPairs?: IMatchPair[];
}

export interface IPassage {
  id: string;
  title?: string;
  content: string;
}

export interface IReadingPart {
  id: string;
  title: string;
  passage: string;
  questions: IQuestion[];
}

export interface IListeningPart {
  id: string;
  title: string;
  audioFile: string | null;
  questions: IQuestion[];
}

export interface IWritingTask {
  id: string;
  prompt: string;
}

const matchPairSchema = new mongoose.Schema(
  {
    left: { type: String, required: true },
    right: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema<IQuestion>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ["multiple_choice", "true_false_ng", "fill_blank", "matching"],
      required: true,
    },
    /** May be empty for `matching` (stem lives in passage). */
    prompt: { type: String, default: "" },
    options: [{ type: String }],
    correctAnswer: { type: String, default: null },
    matchingPairs: { type: [matchPairSchema], default: [] },
  },
  { _id: false }
);

const readingPartSchema = new mongoose.Schema<IReadingPart>(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    passage: { type: String, default: "" },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false }
);

const listeningPartSchema = new mongoose.Schema<IListeningPart>(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    audioFile: { type: String, default: null },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false }
);

const writingTaskSchema = new mongoose.Schema<IWritingTask>(
  {
    id: { type: String, required: true },
    prompt: { type: String, default: "" },
  },
  { _id: false }
);

const readingSchema = new mongoose.Schema(
  { parts: { type: [readingPartSchema], default: [] } },
  { _id: false }
);

const listeningSchema = new mongoose.Schema(
  { parts: { type: [listeningPartSchema], default: [] } },
  { _id: false }
);

const writingSchema = new mongoose.Schema(
  { tasks: { type: [writingTaskSchema], default: [] } },
  { _id: false }
);

const mockTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "active"], default: "draft" },
    pinCode: { type: String, required: true },
    timeLimits: {
      listeningSec: { type: Number, required: true },
      readingSec: { type: Number, required: true },
      writingSec: { type: Number, required: true },
    },
    sections: {
      reading: { type: readingSchema, required: true },
      listening: { type: listeningSchema, required: true },
      writing: { type: writingSchema, required: true },
    },
  },
  { timestamps: true }
);

export const MockTest = mongoose.model("MockTest", mockTestSchema);
