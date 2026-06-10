import { useState } from "react";
import { deleteAudio } from "../utils/api.js";

function truncate(value, max = 120) {
  return value.length > max ? value.slice(0, max) + "…" : value;
}

export default function HistorySection({ audios, onAudiosChanged }) {
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  async function handleDelete(audioId) {
    if (!window.confirm("Hapus audio ini dari history?")) {
      return;
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
    <section className="section">
      <div className="section-header">
        <span className="step-number">3</span>
        <h2>History Audio</h2>
      </div>
      <div className="section-body">
        {error && <div className="alert">{error}</div>}
        {audios.length === 0 ? (
          <div className="empty-state">
            Belum ada audio yang dihasilkan. Hasil generate akan muncul di sini.
          </div>
        ) : (
          <div className="list">
            {audios.map((audio) => (
              <div className="history-item" key={audio.id}>
                <div className="history-top">
                  <div>
                    <span className="title">{audio.voice_name || "Voice terhapus"}</span>{" "}
                    <span className="meta">
                      · {new Date(audio.created_at).toLocaleString("id-ID")} ·{" "}
                      {audio.character_count} karakter
                    </span>
                  </div>
                  <div className="btn-row" style={{ marginTop: 0 }}>
                    <a className="btn small" href={audio.download_url}>
                      Download
                    </a>
                    <button
                      type="button"
                      className="btn small"
                      disabled={deletingId === audio.id}
                      onClick={() => handleDelete(audio.id)}
                    >
                      {deletingId === audio.id ? "Menghapus…" : "Hapus"}
                    </button>
                  </div>
                </div>
                <p className="history-text">"{truncate(audio.text)}"</p>
                <audio controls preload="none" src={audio.audio_url} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
