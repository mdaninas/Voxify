const API_BASE = (import.meta.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

export function apiUrl(path) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  return `${API_BASE}${path}`;
}

export function createMediaAudio(path) {
  const audio = new Audio(apiUrl(path));
  if (API_BASE) {
    audio.crossOrigin = "use-credentials";
  }
  return audio;
}

async function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), { credentials: "include", ...options });
}

async function parseResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("Respons server tidak valid.");
  }
  if (!response.ok || body.success === false) {
    const message = body?.error?.message || "Terjadi kesalahan pada server.";
    const error = new Error(message);
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export async function getHealth() {
  return parseResponse(await apiFetch("/api/health"));
}

export async function getAuthConfig() {
  return parseResponse(await apiFetch("/api/auth/config"));
}

export async function getMe() {
  return parseResponse(await apiFetch("/api/auth/me"));
}

export async function loginWithGoogle(credential) {
  const res = await apiFetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential })
  });
  return parseResponse(res);
}

export async function logout() {
  return parseResponse(await apiFetch("/api/auth/logout", { method: "POST" }));
}

export async function listVoices() {
  return parseResponse(await apiFetch("/api/voices"));
}

export async function createVoice({ name, audioFile, consentAccepted, sourceType }) {
  const form = new FormData();
  form.append("name", name);
  form.append("audio_file", audioFile);
  form.append("consent_accepted", String(consentAccepted));
  form.append("source_type", sourceType);
  const res = await apiFetch("/api/voices", { method: "POST", body: form });
  return parseResponse(res);
}

export async function deleteVoice(voiceId, { deleteProvider = true } = {}) {
  const res = await apiFetch(`/api/voices/${voiceId}?delete_provider=${deleteProvider}`, {
    method: "DELETE"
  });
  return parseResponse(res);
}

export async function generateSpeech({ voiceId, text }) {
  const res = await apiFetch("/api/speech/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: voiceId, text, output_format: "mp3" })
  });
  return parseResponse(res);
}

export async function listAudios() {
  return parseResponse(await apiFetch("/api/audios"));
}

export async function deleteAudio(audioId) {
  return parseResponse(await apiFetch(`/api/audios/${audioId}`, { method: "DELETE" }));
}
