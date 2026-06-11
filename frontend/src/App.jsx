import { useCallback, useEffect, useState } from "react";
import CreateVoiceSection from "./components/CreateVoiceSection.jsx";
import GenerateSection from "./components/GenerateSection.jsx";
import HistorySection from "./components/HistorySection.jsx";
import { getHealth, listVoices, listAudios } from "./utils/api.js";

const DISCLAIMER =
  "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin. Jangan gunakan aplikasi ini untuk meniru orang lain tanpa izin, penipuan, ancaman, fitnah, atau aktivitas ilegal.";

export default function App() {
  const [health, setHealth] = useState(null);
  const [voices, setVoices] = useState([]);
  const [audios, setAudios] = useState([]);
  const [backendError, setBackendError] = useState("");

  const refreshVoices = useCallback(async () => {
    const response = await listVoices();
    setVoices(response.data);
  }, []);

  const refreshAudios = useCallback(async () => {
    const response = await listAudios();
    setAudios(response.data);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const healthResponse = await getHealth();
        setHealth(healthResponse);
        await Promise.all([refreshVoices(), refreshAudios()]);
      } catch {
        setBackendError(
          "Tidak dapat terhubung ke backend. Pastikan server backend berjalan di port 8000."
        );
      }
    }
    init();
  }, [refreshVoices, refreshAudios]);

  return (
    <div className="page">
      <header className="top-bar">
        <div className="logo-row">
          <div className="logo-box">
            <div className="logo-bars">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="wordmark">Voxify</div>
        </div>
        {health &&
          (health.demo_mode ? (
            <div className="mode-pill">Demo Mode</div>
          ) : (
            <div className="mode-pill live">Live AI</div>
          ))}
      </header>

      <section className="hero">
        <h1>
          Suaramu, untuk teks apa pun. <span className="accent-purple">Dalam</span>{" "}
          <span className="accent-pink">hitungan</span> <span className="accent-green">detik.</span>
        </h1>
        <p>Clone suaramu, ketik teks, dan dengarkan hasilnya. Semuanya di satu halaman.</p>
      </section>

      {health?.demo_mode && (
        <div className="demo-banner">
          <strong>⚡ Demo Mode aktif.</strong> Hasil audio hanya nada placeholder, bukan suara
          clone asli. Isi <span className="env-chip">ELEVENLABS_API_KEY</span> di backend untuk
          hasil sungguhan.
        </div>
      )}

      {backendError && <div className="error-box">{backendError}</div>}

      <CreateVoiceSection
        voices={voices}
        onVoicesChanged={async () => {
          await refreshVoices();
          await refreshAudios();
        }}
      />

      <GenerateSection voices={voices} onGenerated={refreshAudios} />

      <HistorySection audios={audios} onAudiosChanged={refreshAudios} />

      <footer className="footer">
        <div className="footer-disclaimer">{DISCLAIMER}</div>
      </footer>
    </div>
  );
}
