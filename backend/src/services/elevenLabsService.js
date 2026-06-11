import fs from "node:fs/promises";
import path from "node:path";
import config from "../config.js";
import { AppError } from "../utils/errors.js";
import { getDb, logEvent } from "../database/db.js";

const BASE_URL = "https://api.elevenlabs.io/v1";

const SAFE_RETRY_STATUS = new Set([429, 503]);
const AMBIGUOUS_STATUS = new Set([500, 502, 504]);

const MIME_BY_EXT = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm"
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt) {
  return Math.min(500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250), 8000);
}

async function parseProviderError(response, requestId) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.detail?.message || body?.detail?.status || JSON.stringify(body?.detail || body);
  } catch {
    detail = await response.text().catch(() => "");
  }
  const ref = ` [ref: ${requestId.slice(0, 8)}]`;
  if (response.status === 401) {
    return new AppError("ELEVENLABS_API_ERROR", `API key ElevenLabs tidak valid atau tidak aktif.${ref}`, 502);
  }
  if (response.status === 429 || String(detail).includes("quota")) {
    return new AppError(
      "ELEVENLABS_API_ERROR",
      `Kuota ElevenLabs habis atau limit tercapai. Coba lagi nanti atau aktifkan Demo Mode.${ref}`,
      502
    );
  }
  return new AppError("ELEVENLABS_API_ERROR", `ElevenLabs error (${response.status}): ${detail}${ref}`, 502);
}

async function providerFetch(operation, url, init, { idempotent = true } = {}) {
  const requestId = crypto.randomUUID();
  const maxAttempts = Math.max(1, config.elevenLabsMaxRetries + 1);

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = Date.now();
    let response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(config.elevenLabsTimeoutMs)
      });
    } catch (err) {
      const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
      logEvent("provider_request", `${operation} gagal: ${timedOut ? "timeout" : "network error"}`, {
        requestId,
        attempt,
        durationMs: Date.now() - startedAt
      });
      lastError = new AppError(
        "ELEVENLABS_API_ERROR",
        timedOut
          ? `ElevenLabs tidak merespons dalam ${Math.round(config.elevenLabsTimeoutMs / 1000)} detik. [ref: ${requestId.slice(0, 8)}]`
          : `Tidak dapat terhubung ke ElevenLabs. Periksa koneksi internet server. [ref: ${requestId.slice(0, 8)}]`,
        timedOut ? 504 : 502
      );
      lastError.ambiguous = true;
      if (idempotent && attempt < maxAttempts) {
        await sleep(backoffDelayMs(attempt));
        continue;
      }
      throw lastError;
    }

    const providerRequestId =
      response.headers.get("request-id") || response.headers.get("xi-request-id") || null;
    logEvent("provider_request", `${operation} status ${response.status}`, {
      requestId,
      providerRequestId,
      attempt,
      status: response.status,
      durationMs: Date.now() - startedAt
    });

    if (response.ok) {
      return response;
    }

    const error = await parseProviderError(response, requestId);
    if (AMBIGUOUS_STATUS.has(response.status)) {
      error.ambiguous = true;
    }
    const canRetry =
      SAFE_RETRY_STATUS.has(response.status) || (idempotent && AMBIGUOUS_STATUS.has(response.status));
    if (canRetry && attempt < maxAttempts) {
      lastError = error;
      await sleep(backoffDelayMs(attempt));
      continue;
    }
    throw error;
  }

  throw lastError;
}

async function findRecoverableProviderVoice(name) {
  const response = await providerFetch("list_voices", `${BASE_URL}/voices`, {
    method: "GET",
    headers: { "xi-api-key": config.elevenLabsApiKey }
  });
  const data = await response.json();
  const knownIds = new Set(
    getDb()
      .prepare("SELECT provider_voice_id FROM voices")
      .all()
      .map((row) => row.provider_voice_id)
  );
  const candidates = (data?.voices || []).filter(
    (voice) => voice?.name === name && voice?.voice_id && !knownIds.has(voice.voice_id)
  );
  return candidates.length === 1 ? candidates[0].voice_id : null;
}

export async function createInstantVoiceClone(name, sampleFilePath) {
  const ext = path.extname(sampleFilePath).toLowerCase();
  const fileBuffer = await fs.readFile(sampleFilePath);
  const blob = new Blob([fileBuffer], { type: MIME_BY_EXT[ext] || "application/octet-stream" });

  const form = new FormData();
  form.append("name", name);
  form.append("files", blob, `sample${ext}`);

  let response;
  try {
    response = await providerFetch(
      "create_voice",
      `${BASE_URL}/voices/add`,
      {
        method: "POST",
        headers: { "xi-api-key": config.elevenLabsApiKey },
        body: form
      },
      { idempotent: false }
    );
  } catch (err) {
    if (err?.ambiguous) {
      const recoveredId = await findRecoverableProviderVoice(name).catch(() => null);
      if (recoveredId) {
        logEvent("provider_voice_recovered", "Voice ditemukan di provider setelah request ambigu.", {
          name,
          providerVoiceId: recoveredId
        });
        return recoveredId;
      }
    }
    throw err;
  }

  const data = await response.json();
  if (!data?.voice_id) {
    throw new AppError("ELEVENLABS_API_ERROR", "ElevenLabs tidak mengembalikan voice_id.", 502);
  }
  return data.voice_id;
}

export async function textToSpeech(providerVoiceId, text) {
  const url = `${BASE_URL}/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=${encodeURIComponent(config.elevenLabsOutputFormat)}`;
  const response = await providerFetch("text_to_speech", url, {
    method: "POST",
    headers: {
      "xi-api-key": config.elevenLabsApiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: config.elevenLabsTtsModel
    })
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteProviderVoice(providerVoiceId) {
  await providerFetch("delete_voice", `${BASE_URL}/voices/${encodeURIComponent(providerVoiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": config.elevenLabsApiKey }
  });
}
