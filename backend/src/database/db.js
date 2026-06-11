import { DatabaseSync } from "node:sqlite";
import config from "../config.js";
import { runMigrations } from "./migrations.js";

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(config.databasePath);
    db.exec("PRAGMA journal_mode = WAL");
    runMigrations(db, (migration) => {
      console.log(`Database migration diterapkan: v${migration.version} ${migration.name}`);
    });
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
