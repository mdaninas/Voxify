import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import config, { ensureDirectories, isAuthEnabled } from "./config.js";
import { getDb } from "./database/db.js";
import { errorResponse, AppError } from "./utils/errors.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import voicesRouter from "./routes/voices.js";
import speechRouter from "./routes/speech.js";
import audiosRouter from "./routes/audios.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { migrateDemoAudioPlaceholders } from "./utils/demoMigration.js";
import { startMaintenanceSchedule } from "./utils/storageMaintenance.js";

function buildCorsOptions() {
  return {
    credentials: true,
    origin(origin, callback) {
      callback(null, !origin || config.corsOrigins.includes(origin));
    }
  };
}

function createRateLimit(max, message, { postOnly = false } = {}) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: postOnly ? (req) => req.method !== "POST" : undefined,
    message: {
      success: false,
      error: {
        code: "RATE_LIMITED",
        message
      }
    }
  });
}

export function createApp() {
  ensureDirectories();
  getDb();
  migrateDemoAudioPlaceholders();

  const app = express();

  if (config.trustProxy > 0) {
    app.set("trust proxy", config.trustProxy);
  }

  if (isAuthEnabled() && !config.sessionSecret) {
    console.warn(
      "[WARN] Login Google aktif tetapi SESSION_SECRET kosong. Semua user akan ter-logout setiap server restart. Isi SESSION_SECRET di .env untuk produksi."
    );
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
    })
  );
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(
    "/api",
    createRateLimit(config.rateLimitMax, "Terlalu banyak request. Coba lagi sebentar lagi.")
  );
  app.use(
    ["/api/voices", "/api/speech/generate"],
    createRateLimit(config.generationRateLimitMax, "Terlalu banyak proses audio. Coba lagi nanti.", {
      postOnly: true
    })
  );

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/voices", requireAuth, voicesRouter);
  app.use("/api/speech", requireAuth, speechRouter);
  app.use("/api/audios", requireAuth, audiosRouter);

  app.use("/api", (req, res) => {
    errorResponse(res, new AppError("VALIDATION_ERROR", "Endpoint tidak ditemukan.", 404));
  });

  const indexHtml = path.join(config.staticDir, "index.html");
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.staticDir));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.sendFile(indexHtml);
    });
  } else {
    app.use((req, res) => {
      errorResponse(res, new AppError("VALIDATION_ERROR", "Endpoint tidak ditemukan.", 404));
    });
  }

  app.use((err, req, res, next) => {
    if (err?.type === "entity.too.large") {
      errorResponse(res, new AppError("PAYLOAD_TOO_LARGE", "Ukuran request terlalu besar.", 413));
      return;
    }
    errorResponse(res, err);
  });

  return app;
}

export function startServer(port = config.port) {
  const app = createApp();
  startMaintenanceSchedule();
  return app.listen(port, () => {
    console.log(`Voxify backend berjalan di http://localhost:${port}`);
    console.log(`Mode: ${config.demoMode ? "DEMO" : "LIVE"}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
