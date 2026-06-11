import { useEffect, useRef, useState } from "react";
import VoiceRecorder from "./VoiceRecorder.jsx";
import { createVoice, deleteVoice } from "../utils/api.js";

const CONSENT_LABEL =
  "Saya menyatakan bahwa suara yang saya unggah atau rekam adalah suara saya sendiri, atau saya memiliki izin resmi dari pemilik suara untuk membuat voice clone.";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm"];
const MAX_UPLOAD_MB = 25;

const AVATAR_COLORS = ["#5b3df5", "#f4458e", "#00a87e", "#ffb43a"];
const PASTEL_SHADOWS = ["#d8ccf8", "#fbc7dd", "#b8f0d8", "#ffe2b0"];

function formatFileSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " MB";
}

function formatVoiceDate(value) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function CreateVoiceSection({ voices, onVoicesChanged }) {
  const [tab, setTab] = useState("record");
  const [uploadFile, setUploadFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [voiceName, setVoiceName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [playingVoiceId, setPlayingVoiceId] = useState("");
  const fileInputRef = useRef(null);
  const previewAudioRef = useRef(null);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  function handleFileChange(event) {
    setError("");
    setSuccess("");
    const file = event.target.files?.[0];
    if (!file) {
      setUploadFile(null);
      return;
    }
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Format file tidak didukung. Gunakan: ${ALLOWED_EXTENSIONS.join(", ")}.`);
      setUploadFile(null);
      event.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Ukuran file melebihi batas ${MAX_UPLOAD_MB} MB.`);
      setUploadFile(null);
      event.target.value = "";
      return;
    }
    if (file.size === 0) {
      setError("File audio kosong.");
      setUploadFile(null);
      event.target.value = "";
      return;
    }
    setUploadFile(file);
  }

  const audioReady = tab === "upload" ? Boolean(uploadFile) : Boolean(recordedBlob);
  const canSubmit = audioReady && voiceName.trim().length > 0 && consent && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const audioFile =
        tab === "upload"
          ? uploadFile
          : new File([recordedBlob], "recording.webm", { type: recordedBlob.type || "audio/webm" });
      const result = await createVoice({
        name: voiceName.trim(),
        audioFile,
        consentAccepted: consent,
        sourceType: tab
      });
      setSuccess(
        `Voice clone "${result.data.name}" berhasil dibuat. Klik avatarnya di daftar bawah untuk mendengar sampel.`
      );
      setVoiceName("");
      setConsent(false);
      setUploadFile(null);
      setRecordedBlob(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      await onVoicesChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function stopPreview() {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setPlayingVoiceId("");
  }

  function togglePreview(voice) {
    if (playingVoiceId === voice.id) {
      stopPreview();
      return;
    }
    previewAudioRef.current?.pause();
    const audio = new Audio(voice.preview_url);
    audio.onended = () => setPlayingVoiceId("");
    audio.onerror = () => {
      setPlayingVoiceId("");
      setError("Preview suara gagal dimuat.");
    };
    previewAudioRef.current = audio;
    setPlayingVoiceId(voice.id);
    audio.play().catch(() => setPlayingVoiceId(""));
  }

  async function handleDeleteVoice(voiceId, name) {
    if (!window.confirm(`Hapus voice "${name}" beserta seluruh audio hasil generate-nya?`)) {
      return;
    }
    if (playingVoiceId === voiceId) {
      stopPreview();
    }
    setDeletingId(voiceId);
    setError("");
    try {
      await deleteVoice(voiceId);
      await onVoicesChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="step">
      <div className="step-header">
        <div className="step-badge purple">01</div>
        <div className="step-title">Buat voice clone</div>
        <div className="step-line purple" />
      </div>

      <div className="card shadow-purple">
        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${tab === "record" ? "active" : ""}`}
            onClick={() => setTab("record")}
          >
            🎙 Rekam langsung
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            📁 Unggah audio
          </button>
        </div>

        {tab === "record" ? (
          <VoiceRecorder recordedBlob={recordedBlob} onRecorded={setRecordedBlob} />
        ) : (
          <label className={`dropzone ${uploadFile ? "has-file" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.webm,audio/*"
              onChange={handleFileChange}
            />
            {uploadFile ? (
              <div className="file-chip">
                <div className="file-icon">♪</div>
                <div className="file-info">
                  <div className="file-name">{uploadFile.name}</div>
                  <div className="drop-meta">
                    {formatFileSize(uploadFile.size)} · klik untuk mengganti
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="drop-title">
                  Klik untuk <span className="drop-link">memilih file audio</span>
                </div>
                <div className="drop-meta">
                  .mp3 / .wav / .m4a / .webm · maks {MAX_UPLOAD_MB} MB · minimal 10 detik
                </div>
              </>
            )}
          </label>
        )}

        <div className="field">
          <label className="field-label" htmlFor="voice-name">
            Nama voice
          </label>
          <input
            id="voice-name"
            className="text-input"
            type="text"
            placeholder="contoh: Suara Saya"
            value={voiceName}
            onChange={(event) => setVoiceName(event.target.value)}
          />
        </div>

        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <div className={`consent-box ${consent ? "checked" : ""}`}>{consent ? "✓" : ""}</div>
          <div className="consent-text">{CONSENT_LABEL}</div>
        </label>

        <button type="button" className="cta purple" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? "Membuat voice clone…" : "✨ Create voice clone"}
        </button>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">✓ {success}</div>}
      </div>

      {voices.length > 0 && (
        <div className="voice-list">
          <div className="mini-label">VOICE CLONE TERSIMPAN</div>
          {voices.map((voice, index) => {
            const playing = playingVoiceId === voice.id;
            return (
              <div
                className="voice-card"
                key={voice.id}
                style={{ boxShadow: `4px 4px 0 ${PASTEL_SHADOWS[index % PASTEL_SHADOWS.length]}` }}
              >
                <button
                  type="button"
                  className={`avatar-btn ${playing ? "playing" : ""}`}
                  style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
                  disabled={!voice.preview_url}
                  onClick={() => togglePreview(voice)}
                  title={voice.preview_url ? "Putar sampel suara" : "Preview tidak tersedia"}
                >
                  {playing ? "❚❚" : voice.name.charAt(0).toUpperCase()}
                </button>
                <div className="voice-info">
                  <div className="voice-name">{voice.name}</div>
                  <div className="voice-meta">
                    {voice.source_type === "record" ? "Rekaman browser" : "Upload file"} ·{" "}
                    {formatVoiceDate(voice.created_at)}
                  </div>
                </div>
                <button
                  type="button"
                  className="chip-btn"
                  disabled={deletingId === voice.id}
                  onClick={() => handleDeleteVoice(voice.id, voice.name)}
                >
                  {deletingId === voice.id ? "Menghapus…" : "Hapus"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
