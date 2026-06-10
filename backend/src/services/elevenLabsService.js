import fs from "node:fs/promises";
import path from "node:path";
import config from "../config.js";
import { AppError } from "../utils/errors.js";

const BASE_URL = "https://api.elevenlabs.io/v1";

const MIME_BY_EXT = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm"
};

async function parseProviderError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.detail?.message || body?.detail?.status || JSON.stringify(body?.detail || body);
  } catch {
    detail = await response.text().catch(() => "");
  }
  if (response.status === 401) {
    return new AppError("ELEVENLABS_API_ERROR", "API key ElevenLabs tidak valid atau tidak aktif.", 502);
  }
  if (response.status === 429 || String(detail).includes("quota")) {
    return new AppError("ELEVENLABS_API_ERROR", "Kuota ElevenLabs habis atau limit tercapai. Coba lagi nanti atau aktifkan Demo Mode.", 502);
  }
  return new AppError("ELEVENLABS_API_ERROR", `ElevenLabs error (${response.status}): ${detail}`, 502);
}

export async function createInstantVoiceClone(name, sampleFilePath) {
  const ext = path.extname(sampleFilePath).toLowerCase();
  const fileBuffer = await fs.readFile(sampleFilePath);
  const blob = new Blob([fileBuffer], { type: MIME_BY_EXT[ext] || "application/octet-stream" });

  const form = new FormData();
  form.append("name", name);
  form.append("files", blob, `sample${ext}`);

  const response = await fetch(`${BASE_URL}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": config.elevenLabsApiKey },
    body: form
  });

  if (!response.ok) {
    throw await parseProviderError(response);
  }

  const data = await response.json();
  if (!data?.voice_id) {
    throw new AppError("ELEVENLABS_API_ERROR", "ElevenLabs tidak mengembalikan voice_id.", 502);
  }
  return data.voice_id;
}

export async function textToSpeech(providerVoiceId, text) {
  const url = `${BASE_URL}/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=${encodeURIComponent(config.elevenLabsOutputFormat)}`;
  const response = await fetch(url, {
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

  if (!response.ok) {
    throw await parseProviderError(response);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function deleteProviderVoice(providerVoiceId) {
  const response = await fetch(`${BASE_URL}/voices/${encodeURIComponent(providerVoiceId)}`, {
    method: "DELETE",
    headers: { "xi-api-key": config.elevenLabsApiKey }
  });
  if (!response.ok) {
    throw await parseProviderError(response);
  }
}
