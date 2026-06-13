import { useEffect, useRef, useState } from "react";
import { loginWithGoogle } from "../utils/api.js";
import { useI18n } from "../utils/i18n.jsx";
import HeaderControls from "./HeaderControls.jsx";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let googleClientId = "";
let googleClientInitialized = false;
let googleCredentialCallback = null;

function LandingPreview({ t }) {
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
          <div className="preview-label">{t("login.preview.voiceReady")}</div>
          <div className="preview-voice-row">
            <div className="preview-avatar">D</div>
            <div>
              <strong>{t("common.voiceName", { name: "Dani" })}</strong>
              <span>{t("login.preview.sampleStatus")}</span>
            </div>
          </div>
          <div className="preview-wave">
            {bars.map((height, index) => (
              <span key={index} style={{ height: `${height}px` }} />
            ))}
          </div>
        </div>

        <div className="preview-panel generate-panel">
          <div className="preview-label">{t("login.preview.generate")}</div>
          <p>{t("login.preview.quote")}</p>
          <div className="preview-progress">
            <span />
          </div>
          <button type="button">{t("login.preview.download")}</button>
        </div>
      </div>
      <div className="preview-consent">
        <span>OK</span>
        <div>
          <strong>{t("login.preview.consentTitle")}</strong>
          <p>{t("login.preview.consentText")}</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage({ clientId, theme, onThemeToggle, onLoggedIn }) {
  const { t, tRaw } = useI18n();
  const buttonRef = useRef(null);
  const hasRenderedGoogleButtonRef = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const workflowSteps = tRaw("login.workflowSteps") || [];
  const safetyPoints = tRaw("login.safetyPoints") || [];

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
        setError(t("login.scriptError"));
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
          <a href="#workflow" onClick={handleAnchorClick}>{t("nav.workflow")}</a>
          <a href="#safety" onClick={handleAnchorClick}>{t("nav.safety")}</a>
          <a href="#login" onClick={handleAnchorClick}>{t("nav.login")}</a>
        </nav>
        <div className="header-actions">
          <HeaderControls theme={theme} onThemeToggle={onThemeToggle} />
          <a className="header-cta" href="#login" onClick={handleAnchorClick}>
            {t("login.headerCta")}
          </a>
        </div>
      </header>

      <main className="login-hero">
        <section className="login-copy">
          <h1>{t("login.heroTitle")}</h1>
          <p>{t("login.heroText")}</p>
          <div className="hero-actions">
            <a className="primary-link" href="#login" onClick={handleAnchorClick}>
              {t("login.primaryCta")}
            </a>
            <a className="secondary-link" href="#workflow" onClick={handleAnchorClick}>
              {t("login.secondaryCta")}
            </a>
          </div>
          <div className="login-highlights">
            {(tRaw("login.highlights") || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <LandingPreview t={t} />
      </main>

      <section id="workflow" className="landing-section workflow-section">
        <div className="section-heading">
          <span className="section-kicker">{t("login.workflowKicker")}</span>
          <h2>{t("login.workflowTitle")}</h2>
          <p>{t("login.workflowText")}</p>
        </div>
        <div className="workflow-grid">
          {workflowSteps.map((step) => (
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
          <span className="section-kicker">{t("login.safetyKicker")}</span>
          <h2>{t("login.safetyTitle")}</h2>
          <p>{t("login.safetyText")}</p>
        </div>
        <div className="safety-grid">
          {safetyPoints.map((point) => (
            <article className="safety-card" key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="login" className="final-cta login-final-cta">
        <div className="login-final-copy">
          <span className="section-kicker">{t("login.finalKicker")}</span>
          <h2>{t("login.finalTitle")}</h2>
          <p>{t("login.finalText")}</p>
          <div className="login-cta-points" aria-label={t("login.finalKicker")}>
            {(tRaw("login.finalPoints") || []).map((item) => (
              <span key={item}>{item}</span>
            ))}
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
              <p className="login-sub">{t("login.cardTagline")}</p>
            </div>
          </div>
          <p className="login-sub">{t("login.cardText")}</p>
          <div className="gsi-slot" ref={buttonRef} />
          {loading && <p className="login-sub">{t("login.processing")}</p>}
          {error && <div className="error-box">{error}</div>}
          <p className="login-foot">{t("login.cardFoot")}</p>
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
            <p>{t("login.footerText")}</p>
          </div>
          <nav className="footer-nav" aria-label="Navigasi footer">
            <a href="#workflow" onClick={handleAnchorClick}>{t("nav.workflow")}</a>
            <a href="#safety" onClick={handleAnchorClick}>{t("nav.safety")}</a>
            <a href="#login" onClick={handleAnchorClick}>{t("nav.login")}</a>
          </nav>
        </div>
        <div className="landing-footer-bottom">
          <span>{t("login.footerCopyright")}</span>
          <span>{t("login.footerDisclaimer")}</span>
        </div>
      </footer>
    </div>
  );
}
