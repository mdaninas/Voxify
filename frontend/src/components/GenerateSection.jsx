import { useState } from "react";
import { generateSpeech } from "../utils/api.js";

const MAX_TEXT_LENGTH = 1000;

export default function GenerateSection({ voices, onGenerated }) {
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const overLimit = text.length > MAX_TEXT_LENGTH;
  const canGenerate =
    selectedVoiceId && text.trim().length > 0 && !overLimit && !generating;

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const response = await generateSpeech({ voiceId: selectedVoiceId, text });
      setResult(response.data);
      await onGenerated();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="section">
      <div className="section-header">
        <span className="step-number">2</span>
        <h2>Generate Speech</h2>
      </div>
      <div className="section-body">
        <div className="field">
          <label className="field-label" htmlFor="voice-select">
            Pilih Voice
          </label>
          <select
            id="voice-select"
            value={selectedVoiceId}
            onChange={(event) => setSelectedVoiceId(event.target.value)}
          >
            <option value="">-- pilih voice clone --</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
          {voices.length === 0 && (
            <p className="hint">Belum ada voice. Buat voice clone dulu di Langkah 1.</p>
          )}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="speech-text">
            Teks
          </label>
          <textarea
            id="speech-text"
            placeholder="Ketik teks yang ingin dibacakan oleh suara kamu…"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className={`char-counter ${overLimit ? "over" : ""}`}>
            {text.length} / {MAX_TEXT_LENGTH} karakter
          </div>
          {overLimit && (
            <div className="alert">Teks melebihi batas maksimal {MAX_TEXT_LENGTH} karakter.</div>
          )}
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {generating ? "Menghasilkan Audio…" : "Generate Audio"}
          </button>
          {generating && <span className="loading-note">Memproses teks menjadi suara…</span>}
        </div>

        {error && <div className="alert">{error}</div>}

        {result && (
          <div className="result-box">
            <span className="result-label">Hasil Terakhir - {result.voice_name}</span>
            <audio
              controls
              src={result.audio_url}
              onError={() => setError("File audio gagal dimuat. Coba generate ulang.")}
            />
            <div className="btn-row">
              <a className="btn small" href={result.download_url}>
                Download {String(result.output_format || "mp3").toUpperCase()}
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
