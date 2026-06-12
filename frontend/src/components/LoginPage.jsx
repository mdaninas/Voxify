import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../utils/api.js";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Rekam",
    text: "Rekam langsung atau unggah sampel suara milikmu sendiri dengan izin yang jelas."
  },
  {
    number: "02",
    title: "Generate",
    text: "Tulis naskah, pilih voice, lalu ubah teks menjadi audio di studio."
  },
  {
    number: "03",
    title: "Download",
    text: "Putar hasilnya, simpan history, dan download file MP3 untuk kebutuhanmu."
  }
];

const SAFETY_POINTS = [
  {
    title: "Persetujuan adalah kunci",
    text: "Setiap voice clone harus dibuat dari suara sendiri atau suara yang sudah mendapat izin."
  },
  {
    title: "Data akun terhubung",
    text: "Login membantu memisahkan voice dan history audio berdasarkan akun pengguna."
  },
  {
    title: "Kontrol penghapusan",
    text: "Voice clone dan audio hasil generate bisa dihapus saat sudah tidak diperlukan."
  }
];

function LandingPreview() {
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

export default function LoginPage({ clientId, onLoggedIn }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function renderButton() {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          setError("");
          setLoading(true);
          try {
            await loginWithGoogle(response.credential);
            onLoggedIn();
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 280
      });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.onload = renderButton;
    script.onerror = () => {
      if (!cancelled) {
        setError("Gagal memuat layanan login Google. Periksa koneksi internet.");
      }
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [clientId, onLoggedIn]);

  return (
    <div className="login-landing">
      <header className="top-bar login-top-bar">
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
        <nav className="main-nav" aria-label="Navigasi landing">
          <a href="#workflow">Cara kerja</a>
          <a href="#safety">Keamanan</a>
          <a href="#login">Masuk</a>
        </nav>
        <div className="mode-pill live">Ethical Voice AI</div>
      </header>

      <main className="login-hero">
        <section className="login-copy">
          <h1>Clone suaramu. Generate audio dengan kontrol penuh.</h1>
          <p>
            Masuk untuk membuat voice clone dari suara sendiri, menulis naskah, dan menyimpan
            hasil audio sebagai MP3.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#login">
              Masuk ke studio
            </a>
            <a className="secondary-link" href="#workflow">
              Lihat cara kerja
            </a>
          </div>
          <div className="login-highlights">
            <span>Consent wajib</span>
            <span>History privat</span>
            <span>Download MP3</span>
          </div>
        </section>

        <LandingPreview />
      </main>

      <section id="workflow" className="landing-section workflow-section">
        <div className="section-heading">
          <span className="section-kicker">Cara kerja</span>
          <h2>Dari sampel suara ke audio siap pakai.</h2>
          <p>Landing page menjelaskan produknya. Setelah masuk, kamu langsung dibawa ke Studio.</p>
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
          <h2>Voice clone harus aman, jelas, dan berizin.</h2>
          <p>
            Voxify menaruh consent dan kontrol data sebagai bagian utama alur, bukan catatan kecil
            di belakang.
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

      <section id="login" className="final-cta login-final-cta">
        <div>
          <h2>Masuk untuk membuka Studio.</h2>
          <p>Setelah login, halaman berikutnya hanya berisi Studio untuk membuat dan mengelola audio.</p>
        </div>
        <section className="login-card" aria-label="Login Voxify">
          <div className="login-card-mark">
            <div className="logo-box">
              <div className="logo-bars">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div>
              <div className="wordmark">Voxify</div>
              <p className="login-sub">Voice studio pribadi</p>
            </div>
          </div>
          <p className="login-sub">
            Gunakan akun Google untuk membuka studio dan menjaga data voice tetap terhubung
            ke akunmu.
          </p>
          <div className="gsi-slot" ref={buttonRef} />
          {loading && <p className="login-sub">Memproses login...</p>}
          {error && <div className="error-box">{error}</div>}
          <p className="login-foot">
            Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin.
          </p>
        </section>
      </section>
    </div>
  );
}
