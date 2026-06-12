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
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo-box">
          <div className="logo-bars">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="wordmark">Voxify</div>
        <p className="login-sub">
          Masuk dengan akun Google untuk membuat voice clone dan generate audio dengan suaramu
          sendiri.
        </p>
        <div className="gsi-slot" ref={buttonRef} />
        {loading && <p className="login-sub">Memproses login…</p>}
        {error && <div className="error-box">{error}</div>}
        <p className="login-foot">
          Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin.
        </p>
      </div>
    </div>
  );
}
