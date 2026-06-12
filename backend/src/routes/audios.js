import { Router } from "express";
import fs from "node:fs";
import { getDb, logEvent } from "../database/db.js";
import { AppError, errorResponse } from "../utils/errors.js";

const router = Router();

const MIME_BY_FORMAT = {
  mp3: "audio/mpeg",
  wav: "audio/wav"
};

function findAudio(audioId, userId) {
  const audio = getDb()
    .prepare(
      `SELECT ga.*, v.name AS voice_name
       FROM generated_audios ga
       LEFT JOIN voices v ON v.id = ga.voice_id
       WHERE ga.id = ? AND ga.user_id = ?`
    )
    .get(audioId, userId);
  if (!audio) {
    throw new AppError("AUDIO_NOT_FOUND", "Audio tidak ditemukan.", 404);
  }
  return audio;
}

router.get("/", (req, res) => {
  try {
    const rows = getDb()
      .prepare(
        `SELECT ga.id, ga.voice_id, ga.text, ga.output_format, ga.character_count, ga.created_at,
                v.name AS voice_name
         FROM generated_audios ga
         LEFT JOIN voices v ON v.id = ga.voice_id
         WHERE ga.user_id = ?
         ORDER BY ga.created_at DESC`
      )
      .all(req.user.id);
    const data = rows.map((row) => ({
      ...row,
      audio_url: `/api/audios/${row.id}/file`,
      download_url: `/api/audios/${row.id}/download`
    }));
    res.json({ success: true, data });
  } catch (err) {
    errorResponse(res, err);
  }
});

router.get("/:audioId/file", (req, res) => {
  try {
    const audio = findAudio(req.params.audioId, req.user.id);
    if (!fs.existsSync(audio.audio_path)) {
      throw new AppError("AUDIO_NOT_FOUND", "File audio tidak ditemukan di storage.", 404);
    }
    res.setHeader("Content-Type", MIME_BY_FORMAT[audio.output_format] || "application/octet-stream");
    fs.createReadStream(audio.audio_path).pipe(res);
  } catch (err) {
    errorResponse(res, err);
  }
});

router.get("/:audioId/download", (req, res) => {
  try {
    const audio = findAudio(req.params.audioId, req.user.id);
    if (!fs.existsSync(audio.audio_path)) {
      throw new AppError("AUDIO_NOT_FOUND", "File audio tidak ditemukan di storage.", 404);
    }
    const datePart = audio.created_at.slice(0, 10);
    const fileName = `generated-audio-${datePart}.${audio.output_format}`;
    res.download(audio.audio_path, fileName);
  } catch (err) {
    errorResponse(res, err);
  }
});

router.delete("/:audioId", async (req, res) => {
  try {
    const audio = findAudio(req.params.audioId, req.user.id);
    await fs.promises.unlink(audio.audio_path).catch(() => {});
    getDb().prepare("DELETE FROM generated_audios WHERE id = ?").run(audio.id);
    logEvent("audio_deleted", "Audio dihapus.", { audioId: audio.id });
    res.json({ success: true, data: { id: audio.id, deleted: true } });
  } catch (err) {
    errorResponse(res, err);
  }
});

export default router;
