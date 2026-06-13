import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const LANG_STORAGE_KEY = "voxify-lang";

export const translations = {
  id: {
    locale: "id-ID",
    nav: { workflow: "Cara kerja", safety: "Keamanan", login: "Masuk" },
    theme: { toLight: "Aktifkan mode terang", toDark: "Aktifkan mode gelap" },
    lang: { switchTo: "Ganti ke Bahasa Inggris", label: "Bahasa" },
    common: {
      voiceName: "Suara cloning milik {name}",
      download: "Download",
      delete: "Hapus",
      deleting: "Menghapus…",
      loading: "Memuat…",
      logout: "Keluar",
      demoMode: "Demo Mode",
      liveAI: "Live AI",
      backendError: "Tidak dapat terhubung ke backend. Pastikan server backend berjalan di port 8000."
    },
    demoBanner: {
      strong: "Demo Mode aktif.",
      before: " Hasil audio hanya nada placeholder, bukan suara clone asli. Isi ",
      after: " di backend untuk hasil sungguhan."
    },
    disclaimer:
      "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin. Jangan gunakan aplikasi ini untuk meniru orang lain tanpa izin, penipuan, ancaman, fitnah, atau aktivitas ilegal.",
    studio: {
      kicker: "Studio",
      title: "Mulai dari suara kamu sendiri.",
      subtitle: "Buat voice clone, generate speech, lalu kelola history audio dari studio yang sama."
    },
    login: {
      heroTitle: "Clone suaramu. Generate audio dengan kontrol penuh.",
      heroText:
        "Masuk untuk membuat voice clone dari suara sendiri, menulis naskah, dan menyimpan hasil audio sebagai MP3.",
      primaryCta: "Masuk ke studio",
      secondaryCta: "Lihat cara kerja",
      headerCta: "Masuk",
      highlights: ["Consent wajib", "History privat", "Download MP3"],
      processing: "Memproses login…",
      scriptError: "Gagal memuat layanan login Google. Periksa koneksi internet.",
      workflowKicker: "Cara kerja",
      workflowTitle: "Dari sampel suara ke audio siap pakai.",
      workflowText: "Landing page menjelaskan produknya. Setelah masuk, kamu langsung dibawa ke Studio.",
      safetyKicker: "Keamanan",
      safetyTitle: "Voice clone harus aman, jelas, dan berizin.",
      safetyText:
        "Voxify menaruh consent dan kontrol data sebagai bagian utama alur, bukan catatan kecil di belakang.",
      finalKicker: "Akses Studio",
      finalTitle: "Masuk dan langsung mulai dari Studio.",
      finalText:
        "Setelah login, halaman berikutnya fokus ke pembuatan voice, generate speech, dan history audio.",
      finalPoints: ["Studio bersih", "Data per akun", "History audio"],
      cardTagline: "Voice studio pribadi",
      cardText:
        "Gunakan akun Google untuk membuka studio dan menjaga data voice tetap terhubung ke akunmu.",
      cardFoot: "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin.",
      footerText:
        "Voice studio pribadi untuk membuat, mengelola, dan mengunduh audio dari suara yang berizin.",
      footerCopyright: "© 2026 Voxify.",
      footerDisclaimer: "Gunakan hanya suara milik sendiri atau suara yang sudah mendapat izin.",
      workflowSteps: [
        { number: "01", title: "Rekam", text: "Rekam langsung atau unggah sampel suara milikmu sendiri dengan izin yang jelas." },
        { number: "02", title: "Generate", text: "Tulis naskah, pilih voice, lalu ubah teks menjadi audio di studio." },
        { number: "03", title: "Download", text: "Putar hasilnya, simpan history, dan download file MP3 untuk kebutuhanmu." }
      ],
      safetyPoints: [
        { title: "Persetujuan adalah kunci", text: "Setiap voice clone harus dibuat dari suara sendiri atau suara yang sudah mendapat izin." },
        { title: "Data akun terhubung", text: "Login membantu memisahkan voice dan history audio berdasarkan akun pengguna." },
        { title: "Kontrol penghapusan", text: "Voice clone dan audio hasil generate bisa dihapus saat sudah tidak diperlukan." }
      ],
      preview: {
        voiceReady: "Voice ready",
        sampleStatus: "Sample bersinyal - consent aktif",
        generate: "Generate speech",
        quote: "\"Halo, ini suara saya untuk narasi produk baru.\"",
        download: "Download MP3",
        consentTitle: "Consent aktif",
        consentText: "Voice dibuat dari suara sendiri atau suara yang sudah mendapat izin."
      }
    },
    create: {
      stepTitle: "Buat voice clone",
      tabRecord: "Rekam langsung",
      tabUpload: "Unggah audio",
      dropClick: "Klik untuk",
      dropLink: "memilih file audio",
      dropMeta: ".mp3 / .wav / .m4a / .webm · maks {mb} MB · minimal {sec} detik",
      changeFile: "klik untuk mengganti",
      nameLabel: "Nama voice",
      namePlaceholder: "contoh: Dani",
      nameSavedAs: "Akan disimpan sebagai: \"{name}\"",
      consent:
        "Saya menyatakan bahwa suara yang saya unggah atau rekam adalah suara saya sendiri, atau saya memiliki izin resmi dari pemilik suara untuk membuat voice clone.",
      submit: "Create voice clone",
      submitting: "Membuat voice clone…",
      savedVoices: "VOICE CLONE TERSIMPAN",
      sourceRecord: "Rekaman browser",
      sourceUpload: "Upload file",
      playSample: "Putar sampel suara",
      noPreview: "Preview tidak tersedia",
      successMsg:
        "Voice clone \"{name}\" berhasil dibuat. Klik avatarnya di daftar bawah untuk mendengar sampel.",
      deleteConfirm:
        "Hapus voice \"{name}\" beserta seluruh audio hasil generate-nya? Pada Live Mode, voice juga akan dihapus dari ElevenLabs.",
      errUnsupported: "Format file tidak didukung. Gunakan: {exts}.",
      errTooLarge: "Ukuran file melebihi batas {mb} MB.",
      errEmpty: "File audio kosong.",
      errPreviewLoad: "Preview suara gagal dimuat."
    },
    generate: {
      stepTitle: "Generate speech",
      voiceLabel: "Pilih voice",
      voicePlaceholder: "-- pilih voice clone --",
      noVoiceHint: "Belum ada voice. Buat voice clone dulu di langkah 01.",
      textLabel: "Teks",
      textPlaceholder: "Ketik teks yang ingin dibacakan oleh suara kamu…",
      counter: "{count} / {limit} karakter",
      submit: "Generate audio",
      submitting: "Menghasilkan…",
      processing: "Memproses teks menjadi suara dengan {name}…",
      latest: "Hasil terakhir · {name}",
      errAudioLoad: "File audio gagal dimuat. Coba generate ulang."
    },
    history: {
      stepTitle: "History audio",
      pill: "{count} audio",
      empty: "Belum ada audio yang dihasilkan. Hasil generate akan muncul di sini.",
      deletedVoice: "Voice terhapus",
      chars: "{count} karakter",
      deleteConfirm: "Hapus audio ini dari history?",
      errAudioLoad: "File audio gagal dimuat."
    },
    recorder: {
      script:
        "Saya menyatakan bahwa ini suara saya sendiri dan saya mengizinkan aplikasi ini membuat versi sintetis dari suara saya.\n\nHalo, saya sedang merekam suara untuk membuat profil suara pribadi. Saya berbicara dengan jelas, santai, dan alami. Satu, dua, tiga, mari kita mulai.",
      recording: "Merekam… klik untuk berhenti",
      saved: "Rekaman tersimpan. Klik untuk rekam ulang",
      idle: "Klik untuk mulai merekam",
      hint: "Durasi {min}-{max} detik (berhenti otomatis di {max} detik), satu pembicara, tanpa musik latar keras.",
      tooShort: "Rekaman terlalu pendek ({sec} detik). Minimal {min} detik, silakan rekam ulang.",
      micDenied:
        "Akses microphone ditolak atau tidak tersedia. Izinkan akses microphone di browser lalu coba lagi."
    }
  },
  en: {
    locale: "en-US",
    nav: { workflow: "How it works", safety: "Safety", login: "Sign in" },
    theme: { toLight: "Switch to light mode", toDark: "Switch to dark mode" },
    lang: { switchTo: "Switch to Indonesian", label: "Language" },
    common: {
      voiceName: "{name}'s voice clone",
      download: "Download",
      delete: "Delete",
      deleting: "Deleting…",
      loading: "Loading…",
      logout: "Sign out",
      demoMode: "Demo Mode",
      liveAI: "Live AI",
      backendError: "Cannot connect to the backend. Make sure the backend server is running on port 8000."
    },
    demoBanner: {
      strong: "Demo Mode is active.",
      before: " Audio output is only a placeholder tone, not a real voice clone. Set ",
      after: " in the backend for real results."
    },
    disclaimer:
      "Only use your own voice or a voice you have permission to use. Do not use this app to impersonate others without consent, for fraud, threats, defamation, or any illegal activity.",
    studio: {
      kicker: "Studio",
      title: "Start from your own voice.",
      subtitle: "Create a voice clone, generate speech, and manage your audio history in one studio."
    },
    login: {
      heroTitle: "Clone your voice. Generate audio with full control.",
      heroText:
        "Sign in to create a voice clone from your own voice, write a script, and save the audio as MP3.",
      primaryCta: "Enter the studio",
      secondaryCta: "See how it works",
      headerCta: "Sign in",
      highlights: ["Consent required", "Private history", "Download MP3"],
      processing: "Processing sign in…",
      scriptError: "Failed to load Google sign-in. Check your internet connection.",
      workflowKicker: "How it works",
      workflowTitle: "From a voice sample to ready-to-use audio.",
      workflowText: "The landing page explains the product. After signing in, you go straight to the Studio.",
      safetyKicker: "Safety",
      safetyTitle: "Voice cloning must be safe, clear, and permitted.",
      safetyText:
        "Voxify puts consent and data control at the core of the flow, not as a footnote.",
      finalKicker: "Studio access",
      finalTitle: "Sign in and start right from the Studio.",
      finalText:
        "After signing in, the next page focuses on creating voices, generating speech, and audio history.",
      finalPoints: ["Clean studio", "Per-account data", "Audio history"],
      cardTagline: "Personal voice studio",
      cardText:
        "Use your Google account to open the studio and keep your voice data tied to your account.",
      cardFoot: "Only use your own voice or a voice you have permission to use.",
      footerText:
        "A personal voice studio to create, manage, and download audio from permitted voices.",
      footerCopyright: "© 2026 Voxify.",
      footerDisclaimer: "Only use your own voice or a voice you have permission to use.",
      workflowSteps: [
        { number: "01", title: "Record", text: "Record directly or upload a sample of your own voice with clear consent." },
        { number: "02", title: "Generate", text: "Write a script, pick a voice, then turn text into audio in the studio." },
        { number: "03", title: "Download", text: "Play the result, keep the history, and download the MP3 file for your needs." }
      ],
      safetyPoints: [
        { title: "Consent is key", text: "Every voice clone must come from your own voice or a voice that has given permission." },
        { title: "Account-linked data", text: "Signing in keeps voices and audio history separated per user account." },
        { title: "Deletion control", text: "Voice clones and generated audio can be deleted when no longer needed." }
      ],
      preview: {
        voiceReady: "Voice ready",
        sampleStatus: "Signal detected - consent active",
        generate: "Generate speech",
        quote: "\"Hello, this is my voice for a new product narration.\"",
        download: "Download MP3",
        consentTitle: "Consent active",
        consentText: "Voice made from your own voice or a voice that has given permission."
      }
    },
    create: {
      stepTitle: "Create voice clone",
      tabRecord: "Record live",
      tabUpload: "Upload audio",
      dropClick: "Click to",
      dropLink: "choose an audio file",
      dropMeta: ".mp3 / .wav / .m4a / .webm · max {mb} MB · min {sec} seconds",
      changeFile: "click to replace",
      nameLabel: "Voice name",
      namePlaceholder: "e.g. Dani",
      nameSavedAs: "Will be saved as: \"{name}\"",
      consent:
        "I confirm that the voice I upload or record is my own, or that I have official permission from the voice owner to create a voice clone.",
      submit: "Create voice clone",
      submitting: "Creating voice clone…",
      savedVoices: "SAVED VOICE CLONES",
      sourceRecord: "Browser recording",
      sourceUpload: "Uploaded file",
      playSample: "Play voice sample",
      noPreview: "Preview unavailable",
      successMsg:
        "Voice clone \"{name}\" created successfully. Click its avatar in the list below to hear a sample.",
      deleteConfirm:
        "Delete voice \"{name}\" along with all of its generated audio? In Live Mode the voice will also be removed from ElevenLabs.",
      errUnsupported: "File format not supported. Use: {exts}.",
      errTooLarge: "File size exceeds the {mb} MB limit.",
      errEmpty: "Audio file is empty.",
      errPreviewLoad: "Failed to load voice preview."
    },
    generate: {
      stepTitle: "Generate speech",
      voiceLabel: "Choose voice",
      voicePlaceholder: "-- choose a voice clone --",
      noVoiceHint: "No voice yet. Create a voice clone first in step 01.",
      textLabel: "Text",
      textPlaceholder: "Type the text you want your voice to read…",
      counter: "{count} / {limit} characters",
      submit: "Generate audio",
      submitting: "Generating…",
      processing: "Turning text into speech with {name}…",
      latest: "Latest result · {name}",
      errAudioLoad: "Failed to load audio. Try generating again."
    },
    history: {
      stepTitle: "Audio history",
      pill: "{count} audio",
      empty: "No audio generated yet. Your results will appear here.",
      deletedVoice: "Deleted voice",
      chars: "{count} characters",
      deleteConfirm: "Delete this audio from history?",
      errAudioLoad: "Failed to load audio."
    },
    recorder: {
      script:
        "I confirm that this is my own voice and I allow this app to create a synthetic version of my voice.\n\nHello, I am recording my voice to create a personal voice profile. I speak clearly, calmly, and naturally. One, two, three, let's begin.",
      recording: "Recording… click to stop",
      saved: "Recording saved. Click to record again",
      idle: "Click to start recording",
      hint: "Duration {min}-{max} seconds (auto-stops at {max} seconds), one speaker, no loud background music.",
      tooShort: "Recording too short ({sec} seconds). Minimum {min} seconds, please record again.",
      micDenied:
        "Microphone access was denied or is unavailable. Allow microphone access in your browser and try again."
    }
  }
};

function resolve(object, key) {
  return key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), object);
}

function interpolate(template, params) {
  if (typeof template !== "string" || !params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] != null ? String(params[name]) : match
  );
}

export function getInitialLang() {
  if (typeof window === "undefined") {
    return "id";
  }
  const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
  return saved === "en" || saved === "id" ? saved : "id";
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo(() => {
    const dict = translations[lang] || translations.id;
    const t = (key, params) => {
      const raw = resolve(dict, key);
      if (raw == null) {
        return key;
      }
      return interpolate(raw, params);
    };
    const tRaw = (key) => resolve(dict, key);
    const toggleLang = () => setLang((current) => (current === "id" ? "en" : "id"));
    return { lang, setLang, toggleLang, t, tRaw, locale: dict.locale };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
