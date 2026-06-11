import fs from "node:fs";
import path from "node:path";
import config from "../config.js";
import { getDb, logEvent } from "../database/db.js";

const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000;
const TMP_MAX_AGE_MS = 60 * 60 * 1000;

function listFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    try {
      const stats = fs.statSync(fullPath);
      files.push({ name: entry.name, path: fullPath, size: stats.size, mtimeMs: stats.mtimeMs });
    } catch {
    }
  }
  return files;
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function deleteAudioRow(db, row) {
  safeUnlink(row.audio_path);
  db.prepare("DELETE FROM generated_audios WHERE id = ?").run(row.id);
}

export function applyRetention() {
  if (config.storageRetentionDays <= 0) {
    return 0;
  }
  const db = getDb();
  const cutoff = new Date(Date.now() - config.storageRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const rows = db.prepare("SELECT id, audio_path FROM generated_audios WHERE created_at < ?").all(cutoff);
  for (const row of rows) {
    deleteAudioRow(db, row);
  }
  return rows.length;
}

export function enforceStorageCap() {
  if (config.maxStorageMb <= 0) {
    return 0;
  }
  const limitBytes = config.maxStorageMb * 1024 * 1024;
  const dirs = [config.outputsDir, config.samplesDir, config.previewsDir];
  let totalBytes = dirs.reduce(
    (sum, dir) => sum + listFiles(dir).reduce((dirSum, file) => dirSum + file.size, 0),
    0
  );
  if (totalBytes <= limitBytes) {
    return 0;
  }
  const db = getDb();
  const rows = db
    .prepare("SELECT id, audio_path FROM generated_audios ORDER BY created_at ASC")
    .all();
  let removed = 0;
  for (const row of rows) {
    if (totalBytes <= limitBytes) {
      break;
    }
    let size = 0;
    try {
      size = fs.statSync(row.audio_path).size;
    } catch {
    }
    deleteAudioRow(db, row);
    totalBytes -= size;
    removed += 1;
  }

  if (totalBytes > limitBytes) {
    const voicesWithPreview = db
      .prepare(
        "SELECT id, preview_audio_path FROM voices WHERE preview_audio_path IS NOT NULL ORDER BY created_at ASC"
      )
      .all();
    for (const voice of voicesWithPreview) {
      if (totalBytes <= limitBytes) {
        break;
      }
      let size = 0;
      try {
        size = fs.statSync(voice.preview_audio_path).size;
      } catch {
      }
      safeUnlink(voice.preview_audio_path);
      db.prepare("UPDATE voices SET preview_audio_path = NULL WHERE id = ?").run(voice.id);
      totalBytes -= size;
      removed += 1;
    }
  }

  if (totalBytes > limitBytes) {
    logEvent("storage_cap_warning", "Storage masih melebihi batas setelah cleanup.", {
      totalBytes,
      limitBytes,
      note: "Sisa storage didominasi sampel suara; sampel tidak pernah dihapus otomatis."
    });
  }
  return removed;
}

export function cleanupOrphanFiles() {
  const db = getDb();
  const referenced = new Set();
  for (const row of db.prepare("SELECT audio_path FROM generated_audios").all()) {
    referenced.add(path.resolve(row.audio_path));
  }
  for (const row of db.prepare("SELECT sample_audio_path, preview_audio_path FROM voices").all()) {
    if (row.sample_audio_path) referenced.add(path.resolve(row.sample_audio_path));
    if (row.preview_audio_path) referenced.add(path.resolve(row.preview_audio_path));
  }

  let removed = 0;
  const now = Date.now();
  for (const dir of [config.outputsDir, config.samplesDir, config.previewsDir]) {
    for (const file of listFiles(dir)) {
      if (referenced.has(path.resolve(file.path))) continue;
      if (now - file.mtimeMs < ORPHAN_MIN_AGE_MS) continue;
      if (safeUnlink(file.path)) removed += 1;
    }
  }
  for (const file of listFiles(config.tmpDir)) {
    if (now - file.mtimeMs < TMP_MAX_AGE_MS) continue;
    if (safeUnlink(file.path)) removed += 1;
  }
  return removed;
}

export function backupDatabase() {
  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(config.backupsDir, `app-${today}.sqlite`);
  if (fs.existsSync(target)) {
    return false;
  }
  const escapedTarget = target.replaceAll("'", "''");
  getDb().exec(`VACUUM INTO '${escapedTarget}'`);

  const backups = listFiles(config.backupsDir)
    .filter((file) => /^app-\d{4}-\d{2}-\d{2}\.sqlite$/.test(file.name))
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const old of backups.slice(Math.max(1, config.backupKeep))) {
    safeUnlink(old.path);
  }
  return true;
}

export function runStorageMaintenance() {
  const summary = {};
  try {
    summary.retentionRemoved = applyRetention();
  } catch (err) {
    summary.retentionError = err.message;
  }
  try {
    summary.capRemoved = enforceStorageCap();
  } catch (err) {
    summary.capError = err.message;
  }
  try {
    summary.orphansRemoved = cleanupOrphanFiles();
  } catch (err) {
    summary.orphanError = err.message;
  }
  try {
    summary.backupCreated = backupDatabase();
  } catch (err) {
    summary.backupError = err.message;
  }
  logEvent("storage_maintenance", "Storage maintenance selesai.", summary);
  return summary;
}

export function startMaintenanceSchedule() {
  runStorageMaintenance();
  const intervalMs = Math.max(1, config.maintenanceIntervalHours) * 60 * 60 * 1000;
  const interval = setInterval(runStorageMaintenance, intervalMs);
  interval.unref();
  return interval;
}
