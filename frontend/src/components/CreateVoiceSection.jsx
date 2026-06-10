import { useRef, useState } from "react";
import VoiceRecorder from "./VoiceRecorder.jsx";
import { createVoice, deleteVoice } from "../utils/api.js";

const CONSENT_LABEL =
  "Saya menyatakan bahwa suara yang saya unggah atau rekam adalah suara saya sendiri, atau saya memiliki izin resmi dari pemilik suara untuk membuat voice clone.";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm"];
const MAX_UPLOAD_MB = 25;

export default function CreateVoiceSection({ voices, onVoicesChanged }) {
  const [tab, setTab] = useState("record");
  const [playingVoiceId, setPlayingVoiceId] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [voiceName, setVoiceName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const fileInputRef = useRef(null);

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
        `Voice clone "${result.data.name}" berhasil dibuat. Klik tombol Play di daftar bawah untuk mendengar hasilnya.`
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

  async function handleDeleteVoice(voiceId, name) {
    if (!window.confirm(`Hapus voice "${name}" beserta seluruh audio hasil generate-nya?`)) {
      return;
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
    <section className="section">
      <div className="section-header">
        <span className="step-number">1</span>
        <h2>Buat Voice Clone</h2>
      </div>
      <div className="section-body">
        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "record" ? "active" : ""}`}
            onClick={() => setTab("record")}
          >
            Record Voice
          </button>
          <button
            type="button"
            className={`tab ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            Upload Audio
          </button>
        </div>

        {tab === "record" ? (
          <VoiceRecorder recordedBlob={recordedBlob} onRecorded={setRecordedBlob} />
        ) : (
          <div className="field">
            <span className="field-label">File Audio</span>
            <label className="dropzone">
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.webm,audio/*"
                onChange={handleFileChange}
              />
              <div>Klik untuk memilih file audio</div>
              <div className="hint">Format: .mp3 / .wav / .m4a / .webm - maks. {MAX_UPLOAD_MB} MB</div>
              {uploadFile && <div className="file-name">{uploadFile.name}</div>}
            </label>
            <p className="hint">
              Durasi minimal 10 detik, satu pembicara, tanpa musik latar keras.
            </p>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="voice-name">
            Nama Voice
          </label>
          <input
            id="voice-name"
            type="text"
            placeholder="contoh: Suara Saya"
            value={voiceName}
            onChange={(event) => setVoiceName(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="consent-box">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>{CONSENT_LABEL}</span>
          </label>
        </div>

        <div className="btn-row">
          <button type="button" className="btn primary" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? "Membuat Voice Clone…" : "Create Voice Clone"}
          </button>
          {submitting && <span className="loading-note">Mengirim audio ke server…</span>}
        </div>

        {error && <div className="alert">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <div className="field">
          <span className="field-label">Voice Clone Tersimpan</span>
          {voices.length === 0 ? (
            <div className="empty-state">Belum ada voice clone. Buat voice pertama kamu di atas.</div>
          ) : (
            <div className="list">
              {voices.map((voice) => (
                <div className="list-item" key={voice.id}>
                  <div className="list-row">
                    <div>
                      <div className="title">{voice.name}</div>
                      <div className="meta">
                        {voice.source_type === "record" ? "Rekaman browser" : "Upload file"} ·{" "}
                        {new Date(voice.created_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                    <div className="btn-row" style={{ marginTop: 0 }}>
                      {voice.preview_url && (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() =>
                            setPlayingVoiceId(playingVoiceId === voice.id ? "" : voice.id)
                          }
                        >
                          {playingVoiceId === voice.id ? "Tutup" : "▶ Play"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn small"
                        disabled={deletingId === voice.id}
                        onClick={() => handleDeleteVoice(voice.id, voice.name)}
                      >
                        {deletingId === voice.id ? "Menghapus…" : "Hapus"}
                      </button>
                    </div>
                  </div>
                  {playingVoiceId === voice.id && voice.preview_url && (
                    <div className="preview-player">
                      <audio controls autoPlay src={voice.preview_url} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
