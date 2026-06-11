import assert from "node:assert/strict";
import test from "node:test";
import { createVoice, deleteAudio, generateSpeech, getHealth } from "./api.js";

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
