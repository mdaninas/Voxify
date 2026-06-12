import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voxify-api-test-"));

process.env.APP_ENV = "test";
process.env.APP_PORT = "0";
process.env.DATABASE_PATH = path.join(tempRoot, "data", "app.sqlite");
process.env.STORAGE_DIR = path.join(tempRoot, "storage");
process.env.DEMO_MODE = "true";
process.env.GOOGLE_CLIENT_ID = "";
process.env.MIN_SAMPLE_SECONDS = "10";
process.env.RATE_LIMIT_MAX = "1000";
process.env.GENERATION_RATE_LIMIT_MAX = "1000";
process.env.CORS_ORIGIN = "http://localhost:5173,http://127.0.0.1:5173";

const [{ createApp }, { closeDb }, { generateDemoWav }] = await Promise.all([
  import("../src/server.js"),
  import("../src/database/db.js"),
  import("../src/utils/demoAudio.js")
]);

let server;
let baseUrl;

test.before(async () => {
  server = createApp().listen(0);
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function makeWavFile(seconds, name = "sample.wav") {
  const wav = generateDemoWav("Sampel suara untuk pengujian otomatis Voxify.", seconds);
  return new File([wav], name, { type: "audio/wav" });
}

function makeSilentWavFile(seconds, name = "silent.wav") {
  const sampleRate = 22050;
  const totalSamples = Math.floor(sampleRate * seconds);
  const dataSize = totalSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return new File([buffer], name, { type: "audio/wav" });
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const body = await response.json();
  return { response, body };
}

async function createVoice({ consent = true, file = makeWavFile(11), name = "Voice Test" } = {}) {
  const form = new FormData();
  form.append("name", name);
  form.append("audio_file", file);
  form.append("consent_accepted", String(consent));
  form.append("source_type", "upload");
  return requestJson("/api/voices", { method: "POST", body: form });
}

test("voice upload, consent, generate, history, download, delete, and error cases", async () => {
  const health = await requestJson("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.demo_mode, true);
  assert.equal(health.body.min_sample_seconds, 10);

  const noConsent = await createVoice({ consent: false });
  assert.equal(noConsent.response.status, 400);
  assert.equal(noConsent.body.error.code, "CONSENT_REQUIRED");

  const corrupt = await createVoice({
    file: new File([Buffer.from("not-a-real-audio")], "corrupt.wav", { type: "audio/wav" })
  });
  assert.equal(corrupt.response.status, 400);
  assert.match(corrupt.body.error.message, /audio|ekstensi|metadata/i);

  const tooShort = await createVoice({ file: makeWavFile(2, "short.wav") });
  assert.equal(tooShort.response.status, 400);
  assert.match(tooShort.body.error.message, /minimal 10 detik/i);

  const silent = await createVoice({ file: makeSilentWavFile(11) });
  assert.equal(silent.response.status, 400);
  assert.match(silent.body.error.message, /sinyal suara/i);

  const created = await createVoice();
  assert.equal(created.response.status, 201);
  assert.equal(created.body.success, true);
  assert.ok(created.body.data.id);
  assert.ok(created.body.data.preview_url.endsWith("/preview"));

  const duplicateName = await createVoice();
  assert.equal(duplicateName.response.status, 400);
  assert.equal(duplicateName.body.error.code, "VALIDATION_ERROR");
  assert.match(duplicateName.body.error.message, /sudah dipakai/i);

  const duplicateNameCaseInsensitive = await createVoice({ name: "VOICE TEST" });
  assert.equal(duplicateNameCaseInsensitive.response.status, 400);
  assert.match(duplicateNameCaseInsensitive.body.error.message, /sudah dipakai/i);

  const preview = await fetch(`${baseUrl}${created.body.data.preview_url}`);
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get("content-type"), /audio\/mpeg/);

  const missingText = await requestJson("/api/speech/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: created.body.data.id, text: "" })
  });
  assert.equal(missingText.response.status, 400);
  assert.equal(missingText.body.error.code, "VALIDATION_ERROR");

  const generated = await requestJson("/api/speech/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: created.body.data.id, text: "Halo dari automated test." })
  });
  assert.equal(generated.response.status, 201);
  assert.equal(generated.body.data.output_format, "mp3");
  assert.ok(generated.body.data.audio_url);
  assert.ok(generated.body.data.download_url);

  const stream = await fetch(`${baseUrl}${generated.body.data.audio_url}`);
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type"), /audio\/mpeg/);
  assert.ok((await stream.arrayBuffer()).byteLength > 0);

  const download = await fetch(`${baseUrl}${generated.body.data.download_url}`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /\.mp3"/);

  const history = await requestJson("/api/audios");
  assert.equal(history.response.status, 200);
  assert.ok(history.body.data.some((item) => item.id === generated.body.data.audio_id));

  const deleteAudio = await requestJson(`/api/audios/${generated.body.data.audio_id}`, { method: "DELETE" });
  assert.equal(deleteAudio.response.status, 200);
  assert.equal(deleteAudio.body.data.deleted, true);

  const missingVoice = await requestJson("/api/speech/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: crypto.randomUUID(), text: "Tidak ada voice." })
  });
  assert.equal(missingVoice.response.status, 404);
  assert.equal(missingVoice.body.error.code, "VOICE_NOT_FOUND");

  const deleteVoice = await requestJson(`/api/voices/${created.body.data.id}`, { method: "DELETE" });
  assert.equal(deleteVoice.response.status, 200);
  assert.equal(deleteVoice.body.data.deleted, true);

  const voices = await requestJson("/api/voices");
  assert.equal(voices.response.status, 200);
  assert.equal(voices.body.data.some((voice) => voice.id === created.body.data.id), false);
});
