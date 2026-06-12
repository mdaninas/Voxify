import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../utils/api.js";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleClientId = "";
let googleClientInitialized = false;
let googleCredentialCallback = null;

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
          <strong>Consent aktif</strong>
          <p>Voice dibuat dari suara sendiri atau suara yang sudah mendapat izin.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage({ clientId, theme, onThemeToggle, onLoggedIn }) {
  const buttonRef = useRef(null);
  const hasRenderedGoogleButtonRef = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isDarkTheme = theme === "dark";

  function handleAnchorClick(event) {
    const href = event.currentTarget.getAttribute("href");
    if (!href?.startsWith("#")) {
      return;
    }

    const target = document.querySelector(href);
    if (!target) {
      return;
    }

    event.preventDefault();
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const headerOffset = 96;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.history.pushState(null, "", href);
    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  useEffect(() => {
    let cancelled = false;

    const handleCredential = async (response) => {
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
    };

    googleCredentialCallback = handleCredential;

    function ensureGoogleInitialized() {
      if (googleClientInitialized && googleClientId === clientId) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          googleCredentialCallback?.(response);
        }
      });
      googleClientId = clientId;
      googleClientInitialized = true;
    }

    function renderButton() {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !buttonRef.current ||
        hasRenderedGoogleButtonRef.current
      ) {
        return;
      }

      ensureGoogleInitialized();
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 280
      });
      hasRenderedGoogleButtonRef.current = true;
    }

    function handleScriptError() {
      if (!cancelled) {
        setError("Gagal memuat layanan login Google. Periksa koneksi internet.");
      }
    }

    function cleanup() {
      cancelled = true;
      if (googleCredentialCallback === handleCredential) {
        googleCredentialCallback = null;
      }
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return cleanup;
    }

    let script = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GSI_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderButton);
    script.addEventListener("error", handleScriptError);

    return () => {
      script.removeEventListener("load", renderButton);
      script.removeEventListener("error", handleScriptError);
      cleanup();
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
          <a href="#workflow" onClick={handleAnchorClick}>Cara kerja</a>
          <a href="#safety" onClick={handleAnchorClick}>Keamanan</a>
          <a href="#login" onClick={handleAnchorClick}>Masuk</a>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={onThemeToggle}
            aria-label={isDarkTheme ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
          >
            <span className="theme-toggle-dot" />
            {isDarkTheme ? "Terang" : "Gelap"}
          </button>
          <a className="header-cta" href="#login" onClick={handleAnchorClick}>
            Masuk
          </a>
        </div>
      </header>

      <main className="login-hero">
        <section className="login-copy">
          <h1>Clone suaramu. Generate audio dengan kontrol penuh.</h1>
          <p>
            Masuk untuk membuat voice clone dari suara sendiri, menulis naskah, dan menyimpan
            hasil audio sebagai MP3.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#login" onClick={handleAnchorClick}>
              Masuk ke studio
            </a>
            <a className="secondary-link" href="#workflow" onClick={handleAnchorClick}>
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
        <div className="login-final-copy">
          <span className="section-kicker">Akses Studio</span>
          <h2>Masuk dan langsung mulai dari Studio.</h2>
          <p>Setelah login, halaman berikutnya fokus ke pembuatan voice, generate speech, dan history audio.</p>
          <div className="login-cta-points" aria-label="Fitur studio setelah login">
            <span>Studio bersih</span>
            <span>Data per akun</span>
            <span>History audio</span>
          </div>
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

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="footer-brand-block">
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
            <p>Voice studio pribadi untuk membuat, mengelola, dan mengunduh audio dari suara yang berizin.</p>
          </div>
          <nav className="footer-nav" aria-label="Navigasi footer">
            <a href="#workflow" onClick={handleAnchorClick}>Cara kerja</a>
            <a href="#safety" onClick={handleAnchorClick}>Keamanan</a>
            <a href="#login" onClick={handleAnchorClick}>Masuk</a>
          </nav>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 Voxify.</span>
          <span>Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin.</span>
        </div>
      </footer>
    </div>
  );
}
