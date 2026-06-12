function columnExists(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((col) => col.name === column);
}

export const migrations = [
  {
    version: 1,
    name: "initial-schema",
    up(db) {
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
  },
  {
    version: 2,
    name: "voices-preview-audio-path",
    up(db) {
      if (!columnExists(db, "voices", "preview_audio_path")) {
        db.exec("ALTER TABLE voices ADD COLUMN preview_audio_path TEXT");
      }
    }
  },
  {
    version: 3,
    name: "generated-audios-created-at-index",
    up(db) {
      db.exec(
        "CREATE INDEX IF NOT EXISTS idx_generated_audios_created_at ON generated_audios(created_at)"
      );
      db.exec("CREATE INDEX IF NOT EXISTS idx_generated_audios_voice_id ON generated_audios(voice_id)");
    }
  },
  {
    version: 4,
    name: "users-and-ownership",
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          google_sub TEXT UNIQUE,
          email TEXT,
          name TEXT,
          picture TEXT,
          created_at TEXT NOT NULL,
          last_login_at TEXT
        )
      `);
      if (!columnExists(db, "voices", "user_id")) {
        db.exec("ALTER TABLE voices ADD COLUMN user_id TEXT");
      }
      if (!columnExists(db, "generated_audios", "user_id")) {
        db.exec("ALTER TABLE generated_audios ADD COLUMN user_id TEXT");
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_voices_user_id ON voices(user_id)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_generated_audios_user_id ON generated_audios(user_id)");
    }
  }
];

export function runMigrations(db, logger) {
  const currentVersion = db.prepare("PRAGMA user_version").get().user_version;
  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    db.exec("BEGIN");
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
      logger?.(migration);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration v${migration.version} (${migration.name}) gagal: ${err.message}`);
    }
  }
}
