import fs from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import config from "../config.js";
import { AppError } from "./errors.js";

export const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm"];

const MIME_BY_EXTENSION = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".webm": "audio/webm"
};

function hasMp3Frame(buffer) {
  return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

function detectAudioType(buffer) {
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") {
    return { ext: ".wav", mime: "audio/wav" };
  }
  if (buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "ID3") {
    return { ext: ".mp3", mime: "audio/mpeg" };
  }
  if (hasMp3Frame(buffer)) {
    return { ext: ".mp3", mime: "audio/mpeg" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["M4A ", "mp42", "isom", "iso2"].includes(brand)) {
      return { ext: ".m4a", mime: "audio/mp4" };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return { ext: ".webm", mime: "audio/webm" };
  }
  return null;
}

async function assertAudibleWav(filePath) {
  const buffer = await fs.readFile(filePath);
  let offset = 12;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataStart = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt " && chunkDataStart + 16 <= buffer.length) {
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    }

    if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataSize = Math.min(chunkSize, buffer.length - chunkDataStart);
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (dataStart < 0 || dataSize <= 0) {
    throw new AppError("VALIDATION_ERROR", "File WAV tidak memiliki data audio.");
  }

  if (audioFormat !== 1 || ![8, 16].includes(bitsPerSample)) {
    return;
  }

  let maxAmplitude = 0;
  const dataEnd = dataStart + dataSize;
  const step = bitsPerSample === 16 ? 2 : 1;
  for (let i = dataStart; i + step <= dataEnd; i += step) {
    const amplitude =
      bitsPerSample === 16
        ? Math.abs(buffer.readInt16LE(i))
        : Math.abs(buffer.readUInt8(i) - 128);
    if (amplitude > maxAmplitude) {
      maxAmplitude = amplitude;
    }
    if (maxAmplitude > 128) {
      return;
    }
  }

  throw new AppError("VALIDATION_ERROR", "File audio tidak memiliki sinyal suara yang terbaca.");
}

export async function validateUploadedAudio(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      `Format file tidak didukung. Gunakan: ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}.`
    );
  }

  if (file.size === 0) {
    throw new AppError("VALIDATION_ERROR", "File audio kosong.");
  }

  const handle = await fs.open(file.path, "r");
  const header = Buffer.alloc(64);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(header, 0, header.length, 0));
  } finally {
    await handle.close();
  }
  const detected = detectAudioType(header.subarray(0, bytesRead));
  if (!detected) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      "Tipe file tidak dikenali sebagai audio valid. Pastikan file bukan hasil rename ekstensi."
    );
  }

  if (detected.ext !== ext) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      `Ekstensi file tidak cocok dengan isi file. Terdeteksi ${detected.mime}, tetapi ekstensi ${ext}.`
    );
  }

  let metadata;
  try {
    metadata = await parseFile(file.path, { duration: true });
  } catch {
    throw new AppError("VALIDATION_ERROR", "File audio rusak atau metadata audionya tidak bisa dibaca.");
  }

  const duration = Number(metadata?.format?.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError("VALIDATION_ERROR", "Durasi audio tidak bisa dibaca. Gunakan file audio yang valid.");
  }

  if (duration < config.minSampleSeconds) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Durasi audio minimal ${config.minSampleSeconds} detik. File ini sekitar ${duration.toFixed(1)} detik.`
    );
  }

  if (detected.ext === ".wav") {
    await assertAudibleWav(file.path);
  }

  return {
    extension: ext,
    mime: MIME_BY_EXTENSION[ext],
    detectedMime: detected.mime,
    durationSeconds: duration
  };
}
