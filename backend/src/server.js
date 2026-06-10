import express from "express";
import cors from "cors";
import config, { ensureDirectories } from "./config.js";
import { getDb } from "./database/db.js";
import { errorResponse, AppError } from "./utils/errors.js";
import healthRouter from "./routes/health.js";
import voicesRouter from "./routes/voices.js";
import speechRouter from "./routes/speech.js";
import audiosRouter from "./routes/audios.js";

ensureDirectories();
getDb();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/voices", voicesRouter);
app.use("/api/speech", speechRouter);
app.use("/api/audios", audiosRouter);

app.use((req, res) => {
  errorResponse(res, new AppError("VALIDATION_ERROR", "Endpoint tidak ditemukan.", 404));
});

app.use((err, req, res, next) => {
  errorResponse(res, err);
});

app.listen(config.port, () => {
  console.log(`Voxify backend berjalan di http://localhost:${config.port}`);
  console.log(`Mode: ${config.demoMode ? "DEMO" : "LIVE"}`);
});
