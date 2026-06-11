import fs from "node:fs";
import path from "node:path";
import config from "../config.js";
import { getDb } from "../database/db.js";
import { generateDemoMp3 } from "./demoAudio.js";

const PREVIEW_TEXT = "Halo, ini adalah hasil clone suara kamu. Suara ini siap dipakai untuk membaca teks.";

function replaceFile(oldPath, newPath, buffer) {
  fs.writeFileSync(newPath, buffer);
  if (oldPath && oldPath !== newPath && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }
}

export function migrateDemoAudioPlaceholders() {
  if (!config.demoMode) {
    return;
  }

  const db = getDb();
  const audios = db
    .prepare("SELECT id, text, audio_path, output_format FROM generated_audios WHERE output_format != 'mp3'")
    .all();

  for (const audio of audios) {
    const audioPath = path.join(config.outputsDir, `generated-audio-${audio.id}.mp3`);
    replaceFile(audio.audio_path, audioPath, generateDemoMp3(audio.text));
    db.prepare("UPDATE generated_audios SET audio_path = ?, output_format = 'mp3' WHERE id = ?").run(
      audioPath,
      audio.id
    );
  }

  const voices = db
    .prepare("SELECT id, preview_audio_path FROM voices WHERE preview_audio_path IS NOT NULL")
    .all();

  for (const voice of voices) {
    if (path.extname(voice.preview_audio_path).toLowerCase() === ".mp3") {
      continue;
    }
    const previewPath = path.join(config.previewsDir, `voice-preview-${voice.id}.mp3`);
    replaceFile(voice.preview_audio_path, previewPath, generateDemoMp3(PREVIEW_TEXT, 5));
    db.prepare("UPDATE voices SET preview_audio_path = ? WHERE id = ?").run(previewPath, voice.id);
  }
}
