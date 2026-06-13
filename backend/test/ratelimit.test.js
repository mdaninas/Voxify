import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voxify-ratelimit-test-"));

process.env.APP_ENV = "test";
process.env.DATABASE_PATH = path.join(tempRoot, "data", "app.sqlite");
process.env.STORAGE_DIR = path.join(tempRoot, "storage");
process.env.DEMO_MODE = "true";
process.env.GOOGLE_CLIENT_ID = "";
process.env.MIN_SAMPLE_SECONDS = "10";
process.env.RATE_LIMIT_MAX = "1000";
process.env.GENERATION_RATE_LIMIT_MAX = "2";

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
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  await fs.rm(tempRoot, { recursive: true, force: true });
});

async function postVoice(name) {
  const form = new FormData();
  form.append("name", name);
  form.append("audio_file", new File([generateDemoWav("Sampel rate limit.", 11)], "s.wav", { type: "audio/wav" }));
  form.append("consent_accepted", "true");
  form.append("source_type", "upload");
  return fetch(`${baseUrl}/api/voices`, { method: "POST", body: form });
}

test("limiter ketat hanya untuk POST, GET list tidak ikut terblokir", async () => {
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${baseUrl}/api/voices`);
    assert.equal(res.status, 200, `GET ke-${i} seharusnya 200`);
  }

  const first = await postVoice("Voice A");
  assert.equal(first.status, 201);
  const second = await postVoice("Voice B");
  assert.equal(second.status, 201);

  const third = await postVoice("Voice C");
  const thirdBody = await third.json();
  assert.equal(third.status, 429);
  assert.equal(thirdBody.error.code, "RATE_LIMITED");

  const listAfter = await fetch(`${baseUrl}/api/voices`);
  assert.equal(listAfter.status, 200);
});
