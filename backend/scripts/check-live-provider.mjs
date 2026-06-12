import fs from "node:fs";
import path from "node:path";
import config, { ensureDirectories, isLiveProviderReady } from "../src/config.js";
import {
  createInstantVoiceClone,
  textToSpeech,
  deleteProviderVoice
} from "../src/services/elevenLabsService.js";
import { generateDemoMp3 } from "../src/utils/demoAudio.js";

function fail(message) {
  console.error(`GAGAL: ${message}`);
  process.exit(1);
}

if (config.demoMode) {
  fail("DEMO_MODE masih true. Set DEMO_MODE=false di backend/.env lalu jalankan ulang.");
}
if (!isLiveProviderReady()) {
  fail("ELEVENLABS_API_KEY belum diisi di backend/.env.");
}

console.log("Validasi Live ElevenLabs dimulai. Script ini memakai sedikit kuota ElevenLabs.");
ensureDirectories();

const samplePath = path.join(config.tmpDir, `live-check-sample-${Date.now()}.mp3`);
fs.writeFileSync(samplePath, generateDemoMp3("Sampel audio untuk validasi live provider.", 12));

let providerVoiceId;
try {
  console.log("1/3 Membuat Instant Voice Clone percobaan…");
  providerVoiceId = await createInstantVoiceClone(`Voxify Live Check ${Date.now()}`, samplePath);
  console.log(`    OK, voice_id: ${providerVoiceId}`);

  console.log("2/3 Menguji Text-to-Speech…");
  const audio = await textToSpeech(providerVoiceId, "Tes live ElevenLabs berhasil.");
  if (!audio || audio.length < 1000) {
    throw new Error(`Audio TTS terlalu kecil (${audio?.length || 0} bytes).`);
  }
  console.log(`    OK, audio diterima: ${audio.length} bytes.`);

  console.log("3/3 Menghapus voice percobaan dari ElevenLabs…");
  await deleteProviderVoice(providerVoiceId);
  providerVoiceId = null;
  console.log("    OK, voice percobaan dihapus.");

  console.log("");
  console.log("SUKSES: create voice, TTS, dan delete voice berjalan di Live Mode.");
} catch (err) {
  if (providerVoiceId) {
    await deleteProviderVoice(providerVoiceId).catch(() => {});
  }
  fail(err.message);
} finally {
  fs.promises.unlink(samplePath).catch(() => {});
}
