import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import mongoose from "mongoose";
import { adminAuthRouter } from "./routes/adminAuth.js";
import { adminStatsRouter } from "./routes/adminStats.js";
import { adminMocksRouter } from "./routes/adminMocks.js";
import { publicMocksRouter } from "./routes/publicMocks.js";
import { attemptsRouter } from "./routes/attempts.js";

const PORT = Number(process.env.PORT) || 4000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ielts_mock";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://ielts-mock-frontend.vercel.app/";

const app = express();

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

const uploadsPath = path.join(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp3")) {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");
    }
  },
}));

app.use("/api/admin", adminAuthRouter);
app.use("/api/admin", adminStatsRouter);
app.use("/api/admin", adminMocksRouter);
app.use("/api", publicMocksRouter);
app.use("/api", attemptsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err.message === "Only MP3 files are allowed") {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Server error" });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected");
  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
