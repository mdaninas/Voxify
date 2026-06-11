import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import config, { isLiveProviderReady } from "../config.js";
import { getDb, logEvent } from "../database/db.js";
import { AppError, errorResponse } from "../utils/errors.js";
import { createInstantVoiceClone, deleteProviderVoice, textToSpeech } from "../services/elevenLabsService.js";
import { generateDemoMp3 } from "../utils/demoAudio.js";
import { validateUploadedAudio } from "../utils/audioValidation.js";

const router = Router();

const PREVIEW_TEXT = "Halo, ini adalah hasil clone suara kamu. Suara ini siap dipakai untuk membaca teks.";

const PREVIEW_MIME = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav"
};

async function generateVoicePreview(voiceId, providerVoiceId) {
  try {
    let buffer;
    let ext;
    if (config.demoMode) {
      buffer = generateDemoMp3(PREVIEW_TEXT, 5);
      ext = ".mp3";
    } else {
      buffer = await textToSpeech(providerVoiceId, PREVIEW_TEXT);
      ext = ".mp3";
    }
    const previewPath = path.join(config.previewsDir, `voice-preview-${voiceId}${ext}`);
    await fs.promises.writeFile(previewPath, buffer);
    return previewPath;
  } catch {
    return null;
  }
}

const CONSENT_TEXT =
  "Saya menyatakan bahwa suara yang saya unggah atau rekam adalah suara saya sendiri, atau saya memiliki izin resmi dari pemilik suara untuk membuat voice clone.";

const upload = multer({
  dest: config.tmpDir,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 }
});

function uploadMiddleware(req, res, next) {
  upload.single("audio_file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return errorResponse(
          res,
          new AppError("FILE_TOO_LARGE", `Ukuran file melebihi batas ${config.maxUploadMb} MB.`, 413)
        );
      }
      return errorResponse(res, err);
    }
    next();
  });
}

function cleanupTmpFile(file) {
  if (file?.path) {
    fs.promises.unlink(file.path).catch(() => {});
  }
}

router.post("/", uploadMiddleware, async (req, res) => {
  const file = req.file;
  try {
    const name = (req.body.name || "").trim();
    const consentAccepted = String(req.body.consent_accepted || "").toLowerCase() === "true";
    const sourceType = (req.body.source_type || "").trim();

    if (!file) {
      throw new AppError("VALIDATION_ERROR", "File audio wajib diunggah.");
    }
    const audioInfo = await validateUploadedAudio(file);
    const ext = audioInfo.extension;
    if (!name) {
      throw new AppError("VALIDATION_ERROR", "Nama voice wajib diisi.");
    }
    if (!consentAccepted) {
      throw new AppError("CONSENT_REQUIRED", "Consent wajib disetujui sebelum membuat voice clone.");
    }
    if (!["upload", "record"].includes(sourceType)) {
      throw new AppError("VALIDATION_ERROR", "source_type harus 'upload' atau 'record'.");
    }
    if (!config.demoMode && !isLiveProviderReady()) {
      throw new AppError(
        "ELEVENLABS_API_ERROR",
        "ELEVENLABS_API_KEY belum dikonfigurasi. Isi API key di file .env atau aktifkan DEMO_MODE=true.",
        503
      );
    }

    const voiceId = crypto.randomUUID();
    const sampleFileName = `voice-sample-${voiceId}${ext}`;
    const samplePath = path.join(config.samplesDir, sampleFileName);
    await fs.promises.rename(file.path, samplePath);

    let providerVoiceId;
    if (config.demoMode) {
      providerVoiceId = `demo_voice_${voiceId.slice(0, 8)}`;
    } else {
      try {
        providerVoiceId = await createInstantVoiceClone(name, samplePath);
      } catch (err) {
        await fs.promises.unlink(samplePath).catch(() => {});
        throw err;
      }
    }

    const previewPath = await generateVoicePreview(voiceId, providerVoiceId);

    const now = new Date().toISOString();
    getDb()
      .prepare(
        `INSERT INTO voices
          (id, provider, provider_voice_id, name, sample_audio_path, source_type,
           consent_accepted, consent_text, consent_accepted_at, status, created_at, updated_at,
           preview_audio_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        voiceId,
        "elevenlabs",
        providerVoiceId,
        name,
        samplePath,
        sourceType,
        1,
        CONSENT_TEXT,
        now,
        "ready",
        now,
        now,
        previewPath
      );

    logEvent("voice_created", `Voice clone dibuat: ${name}`, {
      voiceId,
      demoMode: config.demoMode,
      detectedMime: audioInfo.detectedMime,
      durationSeconds: audioInfo.durationSeconds
    });

    res.status(201).json({
      success: true,
      data: {
        id: voiceId,
        provider: "elevenlabs",
        provider_voice_id: providerVoiceId,
        name,
        status: "ready",
        preview_url: previewPath ? `/api/voices/${voiceId}/preview` : null,
        created_at: now
      }
    });
  } catch (err) {
    cleanupTmpFile(file);
    errorResponse(res, err);
  }
});

router.get("/", (req, res) => {
  try {
    const rows = getDb()
      .prepare(
        "SELECT id, name, provider, source_type, status, created_at, preview_audio_path FROM voices ORDER BY created_at DESC"
      )
      .all();
    const data = rows.map(({ preview_audio_path: previewPath, ...row }) => ({
      ...row,
      preview_url: previewPath ? `/api/voices/${row.id}/preview` : null
    }));
    res.json({ success: true, data });
  } catch (err) {
    errorResponse(res, err);
  }
});

router.get("/:voiceId/preview", (req, res) => {
  try {
    const voice = getDb()
      .prepare("SELECT preview_audio_path FROM voices WHERE id = ?")
      .get(req.params.voiceId);
    if (!voice) {
      throw new AppError("VOICE_NOT_FOUND", "Voice tidak ditemukan.", 404);
    }
    if (!voice.preview_audio_path || !fs.existsSync(voice.preview_audio_path)) {
      throw new AppError("AUDIO_NOT_FOUND", "Preview suara tidak tersedia untuk voice ini.", 404);
    }
    const ext = path.extname(voice.preview_audio_path).toLowerCase();
    res.setHeader("Content-Type", PREVIEW_MIME[ext] || "application/octet-stream");
    fs.createReadStream(voice.preview_audio_path).pipe(res);
  } catch (err) {
    errorResponse(res, err);
  }
});

router.delete("/:voiceId", async (req, res) => {
  try {
    const { voiceId } = req.params;
    const deleteProvider = String(req.query.delete_provider || "").toLowerCase() === "true";

    const voice = getDb().prepare("SELECT * FROM voices WHERE id = ?").get(voiceId);
    if (!voice) {
      throw new AppError("VOICE_NOT_FOUND", "Voice tidak ditemukan.", 404);
    }

    if (deleteProvider && !config.demoMode && isLiveProviderReady()) {
      await deleteProviderVoice(voice.provider_voice_id).catch(() => {});
    }

    const audios = getDb()
      .prepare("SELECT * FROM generated_audios WHERE voice_id = ?")
      .all(voiceId);
    for (const audio of audios) {
      await fs.promises.unlink(audio.audio_path).catch(() => {});
    }
    getDb().prepare("DELETE FROM generated_audios WHERE voice_id = ?").run(voiceId);

    await fs.promises.unlink(voice.sample_audio_path).catch(() => {});
    if (voice.preview_audio_path) {
      await fs.promises.unlink(voice.preview_audio_path).catch(() => {});
    }
    getDb().prepare("DELETE FROM voices WHERE id = ?").run(voiceId);

    logEvent("voice_deleted", `Voice dihapus: ${voice.name}`, { voiceId, deleteProvider });

    res.json({ success: true, data: { id: voiceId, deleted: true } });
  } catch (err) {
    errorResponse(res, err);
  }
});

export default router;
