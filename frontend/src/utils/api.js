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
  const res = await fetch("/api/health");
  return parseResponse(res);
}

export async function getAuthConfig() {
  const res = await fetch("/api/auth/config");
  return parseResponse(res);
}

export async function getMe() {
  const res = await fetch("/api/auth/me");
  return parseResponse(res);
}

export async function loginWithGoogle(credential) {
  const res = await fetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential })
  });
  return parseResponse(res);
}

export async function logout() {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  return parseResponse(res);
}

export async function listVoices() {
  const res = await fetch("/api/voices");
  return parseResponse(res);
}

export async function createVoice({ name, audioFile, consentAccepted, sourceType }) {
  const form = new FormData();
  form.append("name", name);
  form.append("audio_file", audioFile);
  form.append("consent_accepted", String(consentAccepted));
  form.append("source_type", sourceType);
  const res = await fetch("/api/voices", { method: "POST", body: form });
  return parseResponse(res);
}

export async function deleteVoice(voiceId, { deleteProvider = true } = {}) {
  const res = await fetch(`/api/voices/${voiceId}?delete_provider=${deleteProvider}`, {
    method: "DELETE"
  });
  return parseResponse(res);
}

export async function generateSpeech({ voiceId, text }) {
  const res = await fetch("/api/speech/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voice_id: voiceId, text, output_format: "mp3" })
  });
  return parseResponse(res);
}

export async function listAudios() {
  const res = await fetch("/api/audios");
  return parseResponse(res);
}

export async function deleteAudio(audioId) {
  const res = await fetch(`/api/audios/${audioId}`, { method: "DELETE" });
  return parseResponse(res);
}
