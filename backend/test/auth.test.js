import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "voxify-auth-test-"));

process.env.APP_ENV = "test";
process.env.DATABASE_PATH = path.join(tempRoot, "data", "app.sqlite");
process.env.STORAGE_DIR = path.join(tempRoot, "storage");
process.env.DEMO_MODE = "true";
process.env.GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.SESSION_SECRET = "rahasia-test";
process.env.RATE_LIMIT_MAX = "1000";
process.env.GENERATION_RATE_LIMIT_MAX = "1000";

const [{ createApp }, { getDb, closeDb }, session] = await Promise.all([
  import("../src/server.js"),
  import("../src/database/db.js"),
  import("../src/utils/session.js")
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

test("session token bisa dibuat, diverifikasi, dan menolak manipulasi", () => {
  const token = session.createSessionToken("user-abc");
  assert.equal(session.verifySessionToken(token), "user-abc");

  const [payload, signature] = token.split(".");
  assert.equal(session.verifySessionToken(`${payload}.salahtandatangan${signature.slice(16)}`), null);
  assert.equal(session.verifySessionToken("token-ngawur"), null);

  const expired = session.createSessionToken("user-abc", -1000);
  assert.equal(session.verifySessionToken(expired), null);
});

test("auth config menyatakan login aktif", async () => {
  const response = await fetch(`${baseUrl}/api/auth/config`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.enabled, true);
  assert.equal(body.data.google_client_id, process.env.GOOGLE_CLIENT_ID);
});

test("route terlindungi menolak request tanpa login", async () => {
  for (const pathname of ["/api/voices", "/api/audios"]) {
    const response = await fetch(`${baseUrl}${pathname}`);
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.error.code, "UNAUTHORIZED");
  }

  const me = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(me.status, 401);

  const generate = await fetch(`${baseUrl}/api/speech/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: "x", text: "halo" })
  });
  assert.equal(generate.status, 401);
});

test("cookie session valid membuka route terlindungi", async () => {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      "INSERT INTO users (id, google_sub, email, name, picture, created_at, last_login_at) VALUES (?, ?, ?, ?, NULL, ?, ?)"
    )
    .run("user-test", "google-sub-1", "tes@example.com", "Tester", now, now);

  const cookie = `${session.SESSION_COOKIE}=${session.createSessionToken("user-test")}`;

  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  const meBody = await me.json();
  assert.equal(me.status, 200);
  assert.equal(meBody.data.user.email, "tes@example.com");

  const voices = await fetch(`${baseUrl}/api/voices`, { headers: { Cookie: cookie } });
  const voicesBody = await voices.json();
  assert.equal(voices.status, 200);
  assert.deepEqual(voicesBody.data, []);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(logout.status, 200);
});

test("login google menolak credential tidak valid", async () => {
  const response = await fetch(`${baseUrl}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "bukan-jwt-google" })
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "UNAUTHORIZED");
});
