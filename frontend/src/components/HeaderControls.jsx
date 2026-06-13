import { useI18n } from "../utils/i18n.jsx";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="2.5" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.5" />
        <line x1="2.5" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.5" y2="12" />
        <line x1="5.2" y1="5.2" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="18.8" y2="18.8" />
        <line x1="18.8" y1="5.2" x2="17.1" y2="6.9" />
        <line x1="6.9" y1="17.1" x2="5.2" y2="18.8" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeaderControls({ theme, onThemeToggle }) {
  const { lang, toggleLang, t } = useI18n();
  const isDark = theme === "dark";

  return (
    <div className="header-controls">
      <button
        type="button"
        className="lang-toggle"
        onClick={toggleLang}
        aria-label={t("lang.switchTo")}
        title={t("lang.switchTo")}
      >
        <span className={lang === "id" ? "active" : ""}>ID</span>
        <span className={lang === "en" ? "active" : ""}>EN</span>
      </button>
      <button
        type="button"
        className="theme-toggle"
        onClick={onThemeToggle}
        aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
        title={isDark ? t("theme.toLight") : t("theme.toDark")}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
}
