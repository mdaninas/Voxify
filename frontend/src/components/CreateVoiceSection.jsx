import { useEffect, useRef, useState } from "react";
import VoiceRecorder from "./VoiceRecorder.jsx";
import { createVoice, deleteVoice } from "../utils/api.js";
import { useI18n } from "../utils/i18n.jsx";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm"];
const DEFAULT_MAX_UPLOAD_MB = 25;
const DEFAULT_MIN_SAMPLE_SECONDS = 10;

const AVATAR_COLORS = ["#5b3df5", "#f4458e", "#00a87e", "#ffb43a"];
const PASTEL_SHADOWS = ["#d8ccf8", "#fbc7dd", "#b8f0d8", "#ffe2b0"];

function formatFileSize(bytes, locale) {
  const mb = bytes / (1024 * 1024);
  return mb.toLocaleString(locale, { maximumFractionDigits: 1 }) + " MB";
}

function formatVoiceDate(value, locale) {
  return new Date(value).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export default function CreateVoiceSection({
  voices,
  maxUploadMb,
  minSampleSeconds,
  onVoicesChanged
}) {
  const { t, locale } = useI18n();
  const uploadLimitMb = maxUploadMb || DEFAULT_MAX_UPLOAD_MB;
  const minSeconds = minSampleSeconds || DEFAULT_MIN_SAMPLE_SECONDS;
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
      setError(t("create.errUnsupported", { exts: ALLOWED_EXTENSIONS.join(", ") }));
      setUploadFile(null);
      event.target.value = "";
      return;
    }
    if (file.size > uploadLimitMb * 1024 * 1024) {
      setError(t("create.errTooLarge", { mb: uploadLimitMb }));
      setUploadFile(null);
      event.target.value = "";
      return;
    }
    if (file.size === 0) {
      setError(t("create.errEmpty"));
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
        t("create.successMsg", { name: t("common.voiceName", { name: result.data.name }) })
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
      setError(t("create.errPreviewLoad"));
    };
    previewAudioRef.current = audio;
    setPlayingVoiceId(voice.id);
    audio.play().catch(() => setPlayingVoiceId(""));
  }

  async function handleDeleteVoice(voiceId, name) {
    if (
      !window.confirm(
        t("create.deleteConfirm", { name: t("common.voiceName", { name }) })
      )
    ) {
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
        <div className="step-title">{t("create.stepTitle")}</div>
        <div className="step-line purple" />
      </div>

      <div className="card shadow-purple">
        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${tab === "record" ? "active" : ""}`}
            onClick={() => setTab("record")}
          >
            {t("create.tabRecord")}
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === "upload" ? "active" : ""}`}
            onClick={() => setTab("upload")}
          >
            {t("create.tabUpload")}
          </button>
        </div>

        {tab === "record" ? (
          <VoiceRecorder
            recordedBlob={recordedBlob}
            onRecorded={setRecordedBlob}
            minSeconds={minSeconds}
          />
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
                    {formatFileSize(uploadFile.size, locale)} · {t("create.changeFile")}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="drop-title">
                  {t("create.dropClick")} <span className="drop-link">{t("create.dropLink")}</span>
                </div>
                <div className="drop-meta">
                  {t("create.dropMeta", { mb: uploadLimitMb, sec: minSeconds })}
                </div>
              </>
            )}
          </label>
        )}

        <div className="field">
          <label className="field-label" htmlFor="voice-name">
            {t("create.nameLabel")}
          </label>
          <input
            id="voice-name"
            className="text-input"
            type="text"
            placeholder={t("create.namePlaceholder")}
            value={voiceName}
            onChange={(event) => setVoiceName(event.target.value)}
          />
          {voiceName.trim() && (
            <div className="hint-preview">
              {t("create.nameSavedAs", {
                name: t("common.voiceName", { name: voiceName.trim() })
              })}
            </div>
          )}
        </div>

        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <div className={`consent-box ${consent ? "checked" : ""}`}>{consent ? "✓" : ""}</div>
          <div className="consent-text">{t("create.consent")}</div>
        </label>

        <button type="button" className="cta purple" disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? t("create.submitting") : t("create.submit")}
        </button>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">{success}</div>}
      </div>

      {voices.length > 0 && (
        <div className="voice-list">
          <div className="mini-label">{t("create.savedVoices")}</div>
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
                  title={voice.preview_url ? t("create.playSample") : t("create.noPreview")}
                >
                  {playing ? "❚❚" : voice.name.charAt(0).toUpperCase()}
                </button>
                <div className="voice-info">
                  <div className="voice-name">{t("common.voiceName", { name: voice.name })}</div>
                  <div className="voice-meta">
                    {voice.source_type === "record"
                      ? t("create.sourceRecord")
                      : t("create.sourceUpload")}{" "}
                    · {formatVoiceDate(voice.created_at, locale)}
                  </div>
                </div>
                <button
                  type="button"
                  className="chip-btn"
                  disabled={deletingId === voice.id}
                  onClick={() => handleDeleteVoice(voice.id, voice.name)}
                >
                  {deletingId === voice.id ? t("common.deleting") : t("common.delete")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
