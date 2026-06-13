import { useEffect, useRef, useState } from "react";
import { generateSpeech, apiUrl, createMediaAudio } from "../utils/api.js";
import { playExclusive, releaseAudio } from "../utils/audioBus.js";
import { useI18n } from "../utils/i18n.jsx";

const DEFAULT_MAX_TEXT_LENGTH = 1000;

const WAVE_HEIGHTS = [
  10, 22, 14, 30, 18, 34, 24, 12, 28, 20, 36, 16, 26, 32, 14, 22, 30, 18, 12, 28, 34, 20, 24, 14
];
const WAVE_COLORS = ["#f4458e", "#5b3df5", "#ffb43a", "#00a87e"];

function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds || 0);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

export default function GenerateSection({ voices, maxTextLength, onGenerated }) {
  const { t, tRaw } = useI18n();
  const textLimit = maxTextLength || DEFAULT_MAX_TEXT_LENGTH;
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const hasVoices = voices.length > 0;

  useEffect(() => {
    if (!hasVoices) {
      setSelectedVoiceId("");
      return;
    }
    if (!voices.some((voice) => voice.id === selectedVoiceId)) {
      setSelectedVoiceId(voices[0].id);
    }
  }, [voices, hasVoices, selectedVoiceId]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId) || null;
  const charCount = text.length;
  const canGenerate = Boolean(selectedVoice) && text.trim().length > 0 && !generating;

  function resetPlayer() {
    if (audioRef.current) {
      audioRef.current.pause();
      releaseAudio(audioRef.current);
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setElapsed(0);
    setDuration(0);
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setError("");
    setGenerating(true);
    resetPlayer();
    try {
      const response = await generateSpeech({ voiceId: selectedVoiceId, text });
      setResult(response.data);
      setText("");
      await onGenerated();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function togglePlay() {
    if (!result) return;
    if (playing) {
      audioRef.current?.pause();
      releaseAudio(audioRef.current);
      setPlaying(false);
      return;
    }
    if (!audioRef.current) {
      const audio = createMediaAudio(result.audio_url);
      audio.onloadedmetadata = () => setDuration(audio.duration);
      audio.ontimeupdate = () => {
        setElapsed(audio.currentTime);
        setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
      };
      audio.onended = () => {
        releaseAudio(audio);
        setPlaying(false);
        setProgress(0);
        setElapsed(0);
      };
      audio.onerror = () => {
        releaseAudio(audio);
        setPlaying(false);
        setError(t("generate.errAudioLoad"));
      };
      audioRef.current = audio;
    }
    setPlaying(true);
    playExclusive(audioRef.current, () => setPlaying(false)).catch(() => setPlaying(false));
  }

  const coloredBars = playing ? Math.max(1, Math.round(progress * WAVE_HEIGHTS.length)) : 0;

  return (
    <section
      className="step spaced"
      style={{ opacity: hasVoices ? 1 : 0.5, transition: "opacity 0.3s" }}
    >
      <div className="step-header">
        <div className="step-badge pink">02</div>
        <div className="step-title">{t("generate.stepTitle")}</div>
        <div className="step-line pink" />
      </div>

      <div className="card shadow-pink gap-16">
        <div className="field">
          <label className="field-label" htmlFor="voice-select">
            {t("generate.voiceLabel")}
          </label>
          <select
            id="voice-select"
            className="select-input"
            value={selectedVoiceId}
            disabled={!hasVoices}
            onChange={(event) => setSelectedVoiceId(event.target.value)}
          >
            {hasVoices ? (
              voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {t("common.voiceName", { name: voice.name })}
                </option>
              ))
            ) : (
              <option value="">{t("generate.voicePlaceholder")}</option>
            )}
          </select>
          {!hasVoices && <div className="gen-hint">{t("generate.noVoiceHint")}</div>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="speech-text">
            {t("generate.textLabel")}
          </label>
          <div className="template-row">
            <span className="template-label">{t("generate.templatesLabel")}</span>
            <div className="template-chips">
              {(tRaw("generate.templates") || []).map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  className="template-chip"
                  disabled={!hasVoices}
                  onClick={() => setText(tpl.text.slice(0, textLimit))}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="speech-text"
            className="textarea-input"
            rows={5}
            placeholder={t("generate.textPlaceholder")}
            value={text}
            disabled={!hasVoices}
            onChange={(event) => setText(event.target.value.slice(0, textLimit))}
          />
        </div>

        <div className="gen-row">
          <div className={`char-counter ${charCount > textLimit * 0.9 ? "warn" : ""}`}>
            {t("generate.counter", { count: charCount, limit: textLimit })}
          </div>
          <button type="button" className="cta pink" disabled={!canGenerate} onClick={handleGenerate}>
            {generating ? t("generate.submitting") : t("generate.submit")}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {generating && (
          <div className="gen-status">
            <div className="eq">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="gen-status-text">
              {t("generate.processing", {
                name: selectedVoice ? t("common.voiceName", { name: selectedVoice.name }) : ""
              })}
            </div>
          </div>
        )}

        {result && !generating && (
          <div className="latest-card">
            <div className="latest-label">
              {t("generate.latest", {
                name: t("common.voiceName", { name: result.voice_name })
              })}
            </div>
            <div className="latest-row">
              <button type="button" className="latest-play" onClick={togglePlay}>
                {playing ? "❚❚" : "▶"}
              </button>
              <div className="waveform">
                {WAVE_HEIGHTS.map((height, index) => (
                  <span
                    key={index}
                    style={{
                      height: `${height}px`,
                      background:
                        index < coloredBars ? WAVE_COLORS[index % WAVE_COLORS.length] : "#5a5378"
                    }}
                  />
                ))}
              </div>
              <div className="latest-time">{formatTime(playing ? elapsed : duration)}</div>
            </div>
            <div className="latest-bottom">
              <div className="latest-quote">
                "{result.text.length > 70 ? result.text.slice(0, 70) + "…" : result.text}"
              </div>
              <a className="download-btn" href={apiUrl(result.download_url)}>
                {t("common.download")} {String(result.output_format || "mp3").toUpperCase()}
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
