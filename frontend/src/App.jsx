import { useCallback, useEffect, useState } from "react";
import CreateVoiceSection from "./components/CreateVoiceSection.jsx";
import GenerateSection from "./components/GenerateSection.jsx";
import HistorySection from "./components/HistorySection.jsx";
import LoginPage from "./components/LoginPage.jsx";
import { getHealth, listVoices, listAudios, getAuthConfig, getMe, logout } from "./utils/api.js";

const DISCLAIMER =
  "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin. Jangan gunakan aplikasi ini untuk meniru orang lain tanpa izin, penipuan, ancaman, fitnah, atau aktivitas ilegal.";

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Rekam atau unggah suara",
    text: "Gunakan sampel suara milikmu sendiri, minimal sesuai batas backend, lalu beri nama voice."
  },
  {
    number: "02",
    title: "Tulis naskah",
    text: "Pilih voice, tulis teks, dan biarkan studio mengubahnya menjadi audio siap pakai."
  },
  {
    number: "03",
    title: "Download MP3",
    text: "Putar hasilnya, simpan history, lalu download file audio untuk konten atau presentasi."
  }
];

const SAFETY_POINTS = [
  {
    title: "Consent wajib",
    text: "Upload dan rekaman selalu meminta pernyataan izin sebelum voice clone dibuat."
  },
  {
    title: "Riwayat mudah dikontrol",
    text: "Audio hasil generate dan voice clone bisa dihapus dari halaman yang sama."
  },
  {
    title: "Batasan jelas",
    text: "Upload, durasi sampel, dan panjang teks mengikuti konfigurasi backend."
  }
];

function StudioPreview() {
  const bars = [24, 42, 30, 56, 36, 68, 46, 28, 52, 34, 60, 40];

  return (
    <div className="studio-preview" aria-hidden="true">
      <div className="preview-window-bar">
        <span />
        <span />
        <span />
        <strong>Voxify Studio</strong>
      </div>
      <div className="preview-grid">
        <div className="preview-panel voice-panel">
          <div className="preview-label">Voice ready</div>
          <div className="preview-voice-row">
            <div className="preview-avatar">D</div>
            <div>
              <strong>Suara cloning milik Dani</strong>
              <span>Sample bersinyal - consent aktif</span>
            </div>
          </div>
          <div className="preview-wave">
            {bars.map((height, index) => (
              <span key={index} style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>

        <div className="preview-panel generate-panel">
          <div className="preview-label">Generate speech</div>
          <p>"Halo, ini suara saya untuk narasi produk baru."</p>
          <div className="preview-progress">
            <span />
          </div>
          <button type="button">Download MP3</button>
        </div>
      </div>
      <div className="preview-consent">
        <span>OK</span>
        <div>
          <strong>Ethical by default</strong>
          <p>Voice hanya untuk suara sendiri atau yang sudah mendapat izin.</p>
        </div>
      </div>
    </div>
  );
}

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
      <div className="page page-state">
        <div className="login-wrap">
          <p className="login-sub">Memuat...</p>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="page page-state">
        <div className="login-wrap">
          <div className="error-box">{backendError}</div>
        </div>
      </div>
    );
  }

  if (auth.status === "anon") {
    return <LoginPage clientId={auth.clientId} onLoggedIn={initAuth} />;
  }

  const minSeconds = health?.min_sample_seconds || 10;
  const maxUploadMb = health?.max_upload_mb || 25;
  const maxTextLength = health?.max_text_length || 1000;

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

        <nav className="main-nav" aria-label="Navigasi utama">
          <a href="#workflow">Cara kerja</a>
          <a href="#safety">Keamanan</a>
          <a href="#studio">Studio</a>
        </nav>

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
                <img
                  className="user-avatar"
                  src={auth.user.picture}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="user-name">{auth.user.name || auth.user.email}</span>
              <button type="button" className="chip-btn small" onClick={handleLogout}>
                Keluar
              </button>
            </div>
          )}
          <a className="header-cta" href="#studio">
            Coba sekarang
          </a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <h1>
            Clone suaramu. <span>Ubah teks jadi audio.</span>
          </h1>
          <p>
            Rekam atau unggah suara yang sudah kamu izinkan, tulis naskah, lalu download
            hasilnya sebagai MP3. Dibuat untuk creator, educator, dan tim kecil yang butuh
            voice workflow cepat.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#studio">
              Buka studio
            </a>
            <a className="secondary-link" href="#safety">
              Lihat keamanan
            </a>
          </div>
          <div className="hero-metrics" aria-label="Batas utama aplikasi">
            <div>
              <strong>{minSeconds}s</strong>
              <span>minimal sampel</span>
            </div>
            <div>
              <strong>{maxUploadMb}MB</strong>
              <span>batas upload</span>
            </div>
            <div>
              <strong>{maxTextLength}</strong>
              <span>karakter teks</span>
            </div>
          </div>
        </div>
        <StudioPreview />
      </section>

      <section id="workflow" className="landing-section workflow-section">
        <div className="section-heading">
          <span className="section-kicker">Cara kerja</span>
          <h2>Satu halaman dari sampel suara ke file siap pakai.</h2>
          <p>Alurnya dibuat pendek supaya proses clone, generate, dan download tidak terasa ribet.</p>
        </div>
        <div className="workflow-grid">
          {WORKFLOW_STEPS.map((step) => (
            <article className="workflow-card" key={step.number}>
              <div className="workflow-number">{step.number}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="safety" className="landing-section safety-section">
        <div className="safety-copy">
          <span className="section-kicker">Keamanan</span>
          <h2>Didesain untuk voice cloning yang bertanggung jawab.</h2>
          <p>
            Landing page ini bukan menutupi risikonya. Consent, batas upload, history, dan
            penghapusan dibuat terlihat karena voice clone butuh kontrol yang serius.
          </p>
        </div>
        <div className="safety-grid">
          {SAFETY_POINTS.map((point) => (
            <article className="safety-card" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="studio" className="studio-section">
        <div className="section-heading studio-heading">
          <span className="section-kicker">Studio</span>
          <h2>Mulai dari suara kamu sendiri.</h2>
          <p>
            Buat voice clone, generate speech, lalu kelola history audio dari studio yang sama.
          </p>
        </div>

        {health?.demo_mode && (
          <div className="demo-banner">
            <strong>Demo Mode aktif.</strong> Hasil audio hanya nada placeholder, bukan suara clone
            asli. Isi <span className="env-chip">ELEVENLABS_API_KEY</span> di backend untuk hasil
            sungguhan.
          </div>
        )}

        {backendError && <div className="error-box">{backendError}</div>}

        <main className="app-layout">
          <div className="primary-column">
            <CreateVoiceSection
              voices={voices}
              maxUploadMb={health?.max_upload_mb}
              minSampleSeconds={health?.min_sample_seconds}
              onVoicesChanged={async () => {
                await refreshVoices();
                await refreshAudios();
              }}
            />
          </div>

          <div className="side-column">
            <GenerateSection
              voices={voices}
              maxTextLength={health?.max_text_length}
              onGenerated={refreshAudios}
            />

            <HistorySection audios={audios} onAudiosChanged={refreshAudios} />
          </div>
        </main>
      </section>

      <section className="final-cta">
        <div>
          <h2>Siap bikin audio dengan suara sendiri?</h2>
          <p>Mulai dari sampel suara yang legal, lalu simpan hasilnya sebagai MP3.</p>
        </div>
        <a className="primary-link" href="#studio">
          Masuk ke studio
        </a>
      </section>

      <footer className="footer">
        <div className="footer-disclaimer">{DISCLAIMER}</div>
      </footer>
    </div>
  );
}
