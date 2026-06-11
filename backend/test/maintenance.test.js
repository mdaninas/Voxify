import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import lamejs from "@breezystack/lamejs";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voxify-maintenance-test-"));

process.env.APP_ENV = "test";
process.env.DATABASE_PATH = path.join(tempRoot, "data", "app.sqlite");
process.env.STORAGE_DIR = path.join(tempRoot, "storage");
process.env.DEMO_MODE = "true";
process.env.STORAGE_RETENTION_DAYS = "30";
process.env.MAX_STORAGE_MB = "500";
process.env.BACKUP_KEEP = "7";
process.env.MIN_SAMPLE_SECONDS = "10";

const [config, dbModule, maintenance, audioValidation, demoAudio] = await Promise.all([
  import("../src/config.js").then((m) => m.default),
  import("../src/database/db.js"),
  import("../src/utils/storageMaintenance.js"),
  import("../src/utils/audioValidation.js"),
  import("../src/utils/demoAudio.js")
]);

const { ensureDirectories } = await import("../src/config.js");
const { getDb, closeDb } = dbModule;

test.before(() => {
  ensureDirectories();
  getDb()
    .prepare(
      `INSERT INTO voices
        (id, provider, provider_voice_id, name, sample_audio_path, source_type,
         consent_accepted, status, created_at, updated_at)
       VALUES ('voice-x', 'elevenlabs', 'demo_voice', 'Voice Uji', 'sample.webm', 'upload',
         1, 'ready', ?, ?)`
    )
    .run(new Date().toISOString(), new Date().toISOString());
});

test.after(async () => {
  closeDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function insertAudioRow(id, audioPath, createdAt) {
  getDb()
    .prepare(
      `INSERT INTO generated_audios
        (id, voice_id, text, audio_path, output_format, provider, provider_voice_id, character_count, created_at)
       VALUES (?, ?, ?, ?, 'mp3', 'elevenlabs', 'demo_voice', ?, ?)`
    )
    .run(id, "voice-x", "teks uji", audioPath, 8, createdAt);
}

test("retention menghapus audio yang lebih tua dari batas", async () => {
  const oldId = crypto.randomUUID();
  const newId = crypto.randomUUID();
  const oldPath = path.join(config.outputsDir, `generated-audio-${oldId}.mp3`);
  const newPath = path.join(config.outputsDir, `generated-audio-${newId}.mp3`);
  await fs.writeFile(oldPath, Buffer.from("old"));
  await fs.writeFile(newPath, Buffer.from("new"));
  const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  insertAudioRow(oldId, oldPath, oldDate);
  insertAudioRow(newId, newPath, new Date().toISOString());

  const removed = maintenance.applyRetention();

  assert.equal(removed, 1);
  await assert.rejects(fs.access(oldPath));
  await fs.access(newPath);
  const rows = getDb().prepare("SELECT id FROM generated_audios").all();
  assert.equal(rows.some((row) => row.id === oldId), false);
  assert.equal(rows.some((row) => row.id === newId), true);
});

test("orphan cleanup menghapus file tak terdaftar yang sudah lama, menjaga file terdaftar", async () => {
  const orphanPath = path.join(config.outputsDir, "generated-audio-orphan.mp3");
  await fs.writeFile(orphanPath, Buffer.from("orphan"));
  const oldTime = new Date(Date.now() - 60 * 60 * 1000);
  await fs.utimes(orphanPath, oldTime, oldTime);

  const freshOrphanPath = path.join(config.outputsDir, "generated-audio-fresh.mp3");
  await fs.writeFile(freshOrphanPath, Buffer.from("fresh"));

  const keptId = crypto.randomUUID();
  const keptPath = path.join(config.outputsDir, `generated-audio-${keptId}.mp3`);
  await fs.writeFile(keptPath, Buffer.from("kept"));
  await fs.utimes(keptPath, oldTime, oldTime);
  insertAudioRow(keptId, keptPath, new Date().toISOString());

  const removed = maintenance.cleanupOrphanFiles();

  assert.ok(removed >= 1);
  await assert.rejects(fs.access(orphanPath));
  await fs.access(freshOrphanPath);
  await fs.access(keptPath);
});

test("backup database dibuat sekali per hari", async () => {
  const created = maintenance.backupDatabase();
  assert.equal(created, true);
  const repeat = maintenance.backupDatabase();
  assert.equal(repeat, false);
  const backups = await fs.readdir(config.backupsDir);
  assert.equal(backups.filter((name) => name.endsWith(".sqlite")).length, 1);
});

function encodeSilentMp3(seconds) {
  const sampleRate = 22050;
  const samples = new Int16Array(sampleRate * seconds);
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 64);
  const chunks = [];
  for (let i = 0; i < samples.length; i += 1152) {
    const chunk = encoder.encodeBuffer(samples.subarray(i, i + 1152));
    if (chunk.length > 0) chunks.push(Buffer.from(chunk));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));
  return Buffer.concat(chunks);
}

test("validasi menolak mp3 hening dan menerima mp3 bersinyal", async () => {
  const silentPath = path.join(config.tmpDir, "silent-test.mp3");
  const silentBuffer = encodeSilentMp3(12);
  await fs.writeFile(silentPath, silentBuffer);
  await assert.rejects(
    audioValidation.validateUploadedAudio({
      originalname: "silent.mp3",
      path: silentPath,
      size: silentBuffer.length
    }),
    /hening|sinyal|bitrate/i
  );

  const tonePath = path.join(config.tmpDir, "tone-test.mp3");
  const toneBuffer = demoAudio.generateDemoMp3("Sampel suara pengujian validasi.", 12);
  await fs.writeFile(tonePath, toneBuffer);
  const info = await audioValidation.validateUploadedAudio({
    originalname: "tone.mp3",
    path: tonePath,
    size: toneBuffer.length
  });
  assert.equal(info.extension, ".mp3");
  assert.ok(info.durationSeconds >= 10);
});
