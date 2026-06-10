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
      <header className="app-header">
        <div>
          <h1>Voxify - Voice Cloning MVP</h1>
          <p>Clone suaramu, ketik teks, dan hasilkan audio dengan suaramu sendiri.</p>
        </div>
        {health &&
          (health.demo_mode ? (
            <span className="badge demo">Demo Mode Active</span>
          ) : (
            <span className="badge live">Live AI Mode</span>
          ))}
      </header>

      <div className="disclaimer">{DISCLAIMER}</div>

      {health?.demo_mode && (
        <div className="demo-warning">
          <strong>Demo Mode aktif.</strong> Hasil audio hanya berupa nada placeholder, bukan suara
          clone asli. Untuk hasil suara sungguhan, isi <code>ELEVENLABS_API_KEY</code> di{" "}
          <code>backend/.env</code>, ubah <code>DEMO_MODE=false</code>, lalu restart backend.
        </div>
      )}

      {backendError && <div className="alert">{backendError}</div>}

      <CreateVoiceSection voices={voices} onVoicesChanged={async () => {
        await refreshVoices();
        await refreshAudios();
      }} />

      <GenerateSection voices={voices} onGenerated={refreshAudios} />

      <HistorySection audios={audios} onAudiosChanged={refreshAudios} />

      <footer className="app-footer">
        Voxify - MVP Fase 1 · Voice cloning ditenagai ElevenLabs API
      </footer>
    </div>
  );
}
