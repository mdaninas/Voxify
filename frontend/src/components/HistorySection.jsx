import { useEffect, useRef, useState } from "react";
import { deleteAudio } from "../utils/api.js";

const FILL_COLORS = ["#f4458e", "#5b3df5", "#ffb43a", "#00a87e"];
const PASTEL_SHADOWS = ["#d8ccf8", "#fbc7dd", "#b8f0d8", "#ffe2b0"];
const WAVE_BAR_COUNT = 44;

function truncate(value, max = 120) {
  return value.length > max ? value.slice(0, max) + "…" : value;
}

function waveHeights(id) {
  let seed = 0;
  for (const ch of id) {
    seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  }
  return Array.from({ length: WAVE_BAR_COUNT }, () => {
    seed = (seed * 137 + 71) % 9973;
    return 6 + (seed % 18);
  });
}

function formatHistoryDate(value) {
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(totalSeconds) {
  const s = Math.floor(totalSeconds || 0);
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

export default function HistorySection({ audios, onAudiosChanged }) {
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [playingId, setPlayingId] = useState("");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [durations, setDurations] = useState({});
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function stopPlayback() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId("");
    setProgress(0);
    setElapsed(0);
  }

  function togglePlay(item) {
    if (playingId === item.id) {
      stopPlayback();
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.audio_url);
    audio.onloadedmetadata = () => {
      setDurations((prev) => ({ ...prev, [item.id]: audio.duration }));
    };
    audio.ontimeupdate = () => {
      setElapsed(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    audio.onended = () => stopPlayback();
    audio.onerror = () => {
      stopPlayback();
      setError("File audio gagal dimuat.");
    };
    audioRef.current = audio;
    setPlayingId(item.id);
    setProgress(0);
    setElapsed(0);
    audio.play().catch(() => stopPlayback());
  }

  async function handleDelete(audioId) {
    if (!window.confirm("Hapus audio ini dari history?")) {
      return;
    }
    if (playingId === audioId) {
      stopPlayback();
    }
    setDeletingId(audioId);
    setError("");
    try {
      await deleteAudio(audioId);
      await onAudiosChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId("");
    }
  }

  return (
    <section className="step spaced">
      <div className="step-header">
        <div className="step-badge green">03</div>
        <div className="step-title">History audio</div>
        <div className="step-line green" />
        {audios.length > 0 && <div className="history-pill">{audios.length} audio</div>}
      </div>

      {error && <div className="error-box">{error}</div>}

      {audios.length === 0 ? (
        <div className="empty-dashed">
          Belum ada audio yang dihasilkan. Hasil generate akan muncul di sini.
        </div>
      ) : (
        <div className="history-list">
          {audios.map((audio, index) => {
            const playing = playingId === audio.id;
            return (
              <div
                className="history-card"
                key={audio.id}
                style={{ boxShadow: `4px 4px 0 ${PASTEL_SHADOWS[index % PASTEL_SHADOWS.length]}` }}
              >
                <div className="history-meta-row">
                  <div className="history-meta">
                    <strong>{audio.voice_name || "Voice terhapus"}</strong>
                    <span className="muted">
                      {" "}
                      · {formatHistoryDate(audio.created_at)} · {audio.character_count} karakter
                    </span>
                  </div>
                  <div className="history-actions">
                    <a className="mini-btn download" href={audio.download_url}>
                      ⬇ Download
                    </a>
                    <button
                      type="button"
                      className="mini-btn danger"
                      disabled={deletingId === audio.id}
                      onClick={() => handleDelete(audio.id)}
                    >
                      {deletingId === audio.id ? "Menghapus…" : "Hapus"}
                    </button>
                  </div>
                </div>
                <div className="history-quote">"{truncate(audio.text)}"</div>
                <div className={`player ${playing ? "playing" : ""}`}>
                  <button
                    type="button"
                    className={`player-btn ${playing ? "playing" : ""}`}
                    onClick={() => togglePlay(audio)}
                  >
                    {playing ? "❚❚" : "▶"}
                  </button>
                  <div className="player-wave">
                    {waveHeights(audio.id).map((height, barIndex) => {
                      const filled =
                        playing && barIndex < Math.round(progress * WAVE_BAR_COUNT);
                      return (
                        <span
                          key={barIndex}
                          style={{
                            height: `${height}px`,
                            background: filled
                              ? FILL_COLORS[index % FILL_COLORS.length]
                              : undefined
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="player-time">
                    {formatTime(playing ? elapsed : durations[audio.id])}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
