import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../utils/api.js";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

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
        <div className="mode-pill live">Ethical Voice AI</div>
      </header>

      <main className="login-hero">
        <section className="login-copy">
          <h1>Clone suaramu. Generate audio dengan kontrol penuh.</h1>
          <p>
            Masuk untuk membuat voice clone dari suara sendiri, menulis naskah, dan menyimpan
            hasil audio sebagai MP3.
          </p>
          <div className="login-highlights">
            <span>Consent wajib</span>
            <span>History privat</span>
            <span>Download MP3</span>
          </div>
        </section>

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
      </main>
    </div>
  );
}
