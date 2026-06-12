import { useCallback, useEffect, useState } from "react";
import CreateVoiceSection from "./components/CreateVoiceSection.jsx";
import GenerateSection from "./components/GenerateSection.jsx";
import HistorySection from "./components/HistorySection.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { getHealth, listVoices, listAudios, getAuthConfig, getMe, logout } from "./utils/api.js";

const DISCLAIMER =
  "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin. Jangan gunakan aplikasi ini untuk meniru orang lain tanpa izin, penipuan, ancaman, fitnah, atau aktivitas ilegal.";

export default function App() {
  const [auth, setAuth] = useState({ status: "loading", user: null, clientId: null });
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

  const loadAppData = useCallback(async () => {
    const healthResponse = await getHealth();
    setHealth(healthResponse);
    await Promise.all([refreshVoices(), refreshAudios()]);
  }, [refreshVoices, refreshAudios]);

  const initAuth = useCallback(async () => {
    try {
      const configResponse = await getAuthConfig();
      if (!configResponse.data.enabled) {
        setAuth({ status: "disabled", user: null, clientId: null });
        await loadAppData();
        return;
      }
      const clientId = configResponse.data.google_client_id;
      try {
        const meResponse = await getMe();
        setAuth({ status: "authed", user: meResponse.data.user, clientId });
        await loadAppData();
      } catch {
        setAuth({ status: "anon", user: null, clientId });
      }
    } catch {
      setBackendError(
        "Tidak dapat terhubung ke backend. Pastikan server backend berjalan di port 8000."
      );
      setAuth({ status: "error", user: null, clientId: null });
    }
  }, [loadAppData]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  async function handleLogout() {
    try {
      await logout();
    } catch {
    }
    setVoices([]);
    setAudios([]);
    setAuth((prev) => ({ ...prev, status: "anon", user: null }));
  }

  if (auth.status === "loading") {
    return (
      <div className="page">
        <div className="login-wrap">
          <p className="login-sub">Memuat…</p>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="page">
        <div className="login-wrap">
          <div className="error-box">{backendError}</div>
        </div>
      </div>
    );
  }

  if (auth.status === "anon") {
    return <LoginPage clientId={auth.clientId} onLoggedIn={initAuth} />;
  }

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
        <div className="top-bar-right">
          {health &&
            (health.demo_mode ? (
              <div className="mode-pill">Demo Mode</div>
            ) : (
              <div className="mode-pill live">Live AI</div>
            ))}
          {auth.status === "authed" && auth.user && (
            <div className="user-chip">
              {auth.user.picture && (
                <img className="user-avatar" src={auth.user.picture} alt="" referrerPolicy="no-referrer" />
              )}
              <span className="user-name">{auth.user.name || auth.user.email}</span>
              <button type="button" className="chip-btn small" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          )}
        </div>
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
          <strong>Demo Mode aktif.</strong> Hasil audio hanya nada placeholder, bukan suara clone
          asli. Isi <span className="env-chip">ELEVENLABS_API_KEY</span> di backend untuk hasil
          sungguhan.
        </div>
      )}

      {backendError && <div className="error-box">{backendError}</div>}

      <CreateVoiceSection
        voices={voices}
        maxUploadMb={health?.max_upload_mb}
        minSampleSeconds={health?.min_sample_seconds}
        onVoicesChanged={async () => {
          await refreshVoices();
          await refreshAudios();
        }}
      />

      <GenerateSection
        voices={voices}
        maxTextLength={health?.max_text_length}
        onGenerated={refreshAudios}
      />

      <HistorySection audios={audios} onAudiosChanged={refreshAudios} />

      <footer className="footer">
        <div className="footer-disclaimer">{DISCLAIMER}</div>
      </footer>
    </div>
  );
}
