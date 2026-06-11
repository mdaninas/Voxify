import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const rootDir = process.cwd();

const config = {
  appEnv: process.env.APP_ENV || "development",
  port: Number(process.env.APP_PORT || 8000),
  databasePath: path.resolve(rootDir, process.env.DATABASE_PATH || "./data/app.sqlite"),
  storageDir: path.resolve(rootDir, process.env.STORAGE_DIR || "./storage"),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 25),
  minSampleSeconds: Number(process.env.MIN_SAMPLE_SECONDS || 10),
  maxTextLength: Number(process.env.MAX_TEXT_LENGTH || 1000),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || "128kb",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120),
  generationRateLimitMax: Number(process.env.GENERATION_RATE_LIMIT_MAX || 20),
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  elevenLabsTtsModel: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
  elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128",
  elevenLabsTimeoutMs: Number(process.env.ELEVENLABS_TIMEOUT_MS || 30000),
  elevenLabsMaxRetries: Number(process.env.ELEVENLABS_MAX_RETRIES || 2),
  storageRetentionDays: Number(process.env.STORAGE_RETENTION_DAYS || 30),
  maxStorageMb: Number(process.env.MAX_STORAGE_MB || 500),
  backupKeep: Number(process.env.BACKUP_KEEP || 7),
  maintenanceIntervalHours: Number(process.env.MAINTENANCE_INTERVAL_HOURS || 6),
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true"
};

config.samplesDir = path.join(config.storageDir, "samples");
config.outputsDir = path.join(config.storageDir, "outputs");
config.previewsDir = path.join(config.storageDir, "previews");
config.tmpDir = path.join(config.storageDir, "tmp");
config.backupsDir = path.join(path.dirname(config.databasePath), "backups");

export function ensureDirectories() {
  const dirs = [
    path.dirname(config.databasePath),
    config.storageDir,
    config.samplesDir,
    config.outputsDir,
    config.previewsDir,
    config.tmpDir,
    config.backupsDir
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isLiveProviderReady() {
  return config.elevenLabsApiKey.trim().length > 0 && config.elevenLabsApiKey !== "your_elevenlabs_api_key_here";
}

export default config;
