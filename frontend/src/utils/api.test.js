import assert from "node:assert/strict";
import test from "node:test";
import {
  createVoice,
  deleteAudio,
  deleteVoice,
  generateSpeech,
  getAuthConfig,
  getHealth,
  loginWithGoogle,
  logout
} from "./api.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

test("api client sends expected requests", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse({ success: true, data: { ok: true } });
  };

  try {
    await getHealth();
    await createVoice({
      name: "Voice Test",
      audioFile: new File(["audio"], "sample.wav", { type: "audio/wav" }),
      consentAccepted: true,
      sourceType: "upload"
    });
    await generateSpeech({ voiceId: "voice-1", text: "Halo" });
    await deleteAudio("audio-1");
    await deleteVoice("voice-1");
    await deleteVoice("voice-2", { deleteProvider: false });
    await getAuthConfig();
    await loginWithGoogle("google-credential");
    await logout();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls[0].url, "/api/health");

  assert.equal(calls[1].url, "/api/voices");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.body.get("name"), "Voice Test");
  assert.equal(calls[1].options.body.get("consent_accepted"), "true");
  assert.equal(calls[1].options.body.get("source_type"), "upload");

  assert.equal(calls[2].url, "/api/speech/generate");
  assert.equal(calls[2].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    voice_id: "voice-1",
    text: "Halo",
    output_format: "mp3"
  });

  assert.equal(calls[3].url, "/api/audios/audio-1");
  assert.equal(calls[3].options.method, "DELETE");

  assert.equal(calls[4].url, "/api/voices/voice-1?delete_provider=true");
  assert.equal(calls[4].options.method, "DELETE");

  assert.equal(calls[5].url, "/api/voices/voice-2?delete_provider=false");
  assert.equal(calls[5].options.method, "DELETE");

  assert.equal(calls[6].url, "/api/auth/config");

  assert.equal(calls[7].url, "/api/auth/google");
  assert.equal(calls[7].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[7].options.body), { credential: "google-credential" });

  assert.equal(calls[8].url, "/api/auth/logout");
  assert.equal(calls[8].options.method, "POST");
});

test("api client exposes backend error messages and codes", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse(
      {
        success: false,
        error: { code: "CONSENT_REQUIRED", message: "Consent wajib disetujui." }
      },
      400
    );

  try {
    await assert.rejects(
      () => getHealth(),
      (error) => {
        assert.equal(error.message, "Consent wajib disetujui.");
        assert.equal(error.code, "CONSENT_REQUIRED");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
