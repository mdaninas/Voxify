import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import config, { isLiveProviderReady } from "../config.js";
import { getDb, logEvent } from "../database/db.js";
import { AppError, errorResponse } from "../utils/errors.js";
import { textToSpeech } from "../services/elevenLabsService.js";
import { generateDemoMp3 } from "../utils/demoAudio.js";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { voice_id: voiceId, text } = req.body || {};

    if (!voiceId || typeof voiceId !== "string") {
      throw new AppError("VALIDATION_ERROR", "Voice wajib dipilih.");
    }
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new AppError("VALIDATION_ERROR", "Teks wajib diisi.");
    }
    if (text.length > config.maxTextLength) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Teks melebihi batas maksimal ${config.maxTextLength} karakter.`
      );
    }

    const voice = getDb().prepare("SELECT * FROM voices WHERE id = ?").get(voiceId);
    if (!voice) {
      throw new AppError("VOICE_NOT_FOUND", "Voice tidak ditemukan.", 404);
    }

    if (!config.demoMode && !isLiveProviderReady()) {
      throw new AppError(
        "ELEVENLABS_API_ERROR",
        "ELEVENLABS_API_KEY belum dikonfigurasi. Isi API key di file .env atau aktifkan DEMO_MODE=true.",
        503
      );
    }

    const audioId = crypto.randomUUID();
    let audioBuffer;
    let outputFormat;

    if (config.demoMode) {
      audioBuffer = generateDemoMp3(text);
      outputFormat = "mp3";
    } else {
      audioBuffer = await textToSpeech(voice.provider_voice_id, text);
      outputFormat = "mp3";
    }

    const audioPath = path.join(config.outputsDir, `generated-audio-${audioId}.${outputFormat}`);
    await fs.promises.writeFile(audioPath, audioBuffer);

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO generated_audios
          (id, voice_id, text, audio_path, output_format, provider, provider_voice_id, character_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(audioId, voiceId, text, audioPath, outputFormat, "elevenlabs", voice.provider_voice_id, text.length, now);

    logEvent("audio_generated", `Audio dibuat dari voice: ${voice.name}`, {
      audioId,
      characterCount: text.length,
      demoMode: config.demoMode
    });

    res.status(201).json({
      success: true,
      data: {
        audio_id: audioId,
        voice_id: voiceId,
        voice_name: voice.name,
        text,
        output_format: outputFormat,
        audio_url: `/api/audios/${audioId}/file`,
        download_url: `/api/audios/${audioId}/download`,
        created_at: now
      }
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

export default router;
