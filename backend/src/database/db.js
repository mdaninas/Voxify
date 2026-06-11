import { DatabaseSync } from "node:sqlite";
import config from "../config.js";

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(config.databasePath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS voices (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'elevenlabs',
        provider_voice_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sample_audio_path TEXT NOT NULL,
        source_type TEXT NOT NULL,
        consent_accepted INTEGER NOT NULL DEFAULT 0,
        consent_text TEXT,
        consent_accepted_at TEXT,
        status TEXT NOT NULL DEFAULT 'ready',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS generated_audios (
        id TEXT PRIMARY KEY,
        voice_id TEXT NOT NULL,
        text TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        output_format TEXT NOT NULL DEFAULT 'mp3',
        provider TEXT NOT NULL DEFAULT 'elevenlabs',
        provider_voice_id TEXT NOT NULL,
        character_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (voice_id) REFERENCES voices(id)
      )
    `);
    const voiceColumns = db.prepare("PRAGMA table_info(voices)").all().map((col) => col.name);
    if (!voiceColumns.includes("preview_audio_path")) {
      db.exec("ALTER TABLE voices ADD COLUMN preview_audio_path TEXT");
    }
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        message TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

export function logEvent(eventType, message, metadata) {
  try {
    const stmt = getDb().prepare(
      "INSERT INTO app_events (id, event_type, message, metadata_json, created_at) VALUES (?, ?, ?, ?, ?)"
    );
    stmt.run(
      crypto.randomUUID(),
      eventType,
      message || null,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString()
    );
  } catch {
  }
}
