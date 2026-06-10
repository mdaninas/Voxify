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
  maxTextLength: Number(process.env.MAX_TEXT_LENGTH || 1000),
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
  elevenLabsTtsModel: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
  elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128",
  demoMode: String(process.env.DEMO_MODE || "false").toLowerCase() === "true"
};

config.samplesDir = path.join(config.storageDir, "samples");
config.outputsDir = path.join(config.storageDir, "outputs");
config.previewsDir = path.join(config.storageDir, "previews");
config.tmpDir = path.join(config.storageDir, "tmp");

export function ensureDirectories() {
  const dirs = [
    path.dirname(config.databasePath),
    config.storageDir,
    config.samplesDir,
    config.outputsDir,
    config.previewsDir,
    config.tmpDir
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isLiveProviderReady() {
  return config.elevenLabsApiKey.trim().length > 0 && config.elevenLabsApiKey !== "your_elevenlabs_api_key_here";
}

export default config;
