import { useEffect, useRef, useState } from "react";

const RECORDING_SCRIPT = `Saya menyatakan bahwa ini suara saya sendiri dan saya mengizinkan aplikasi ini membuat versi sintetis dari suara saya.

Halo, saya sedang merekam suara untuk membuat profil suara pribadi. Saya berbicara dengan jelas, santai, dan alami. Satu, dua, tiga, mari kita mulai.`;

const DEFAULT_MIN_SECONDS = 10;
const MAX_SECONDS = 30;
const BAR_COUNT = 28;
const WAVE_COLORS = ["#f4458e", "#5b3df5", "#ffb43a", "#00a87e"];

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceRecorder({ recordedBlob, onRecorded, minSeconds = DEFAULT_MIN_SECONDS }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recError, setRecError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [levels, setLevels] = useState(() => new Array(BAR_COUNT).fill(4));
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function startVisualizer(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setLevels(
          Array.from({ length: BAR_COUNT }, (_, i) => {
            const value = data[Math.floor((i * data.length) / BAR_COUNT)] || 0;
            return 4 + Math.round((value / 255) * 36);
          })
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
    }
  }

  function stopVisualizer() {
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setLevels(new Array(BAR_COUNT).fill(4));
  }

  async function startRecording() {
    setRecError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    onRecorded(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopVisualizer();
        if (secondsRef.current < minSeconds) {
          setRecError(
            `Rekaman terlalu pendek (${secondsRef.current} detik). Minimal ${minSeconds} detik, silakan rekam ulang.`
          );
          setSeconds(0);
          secondsRef.current = 0;
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onRecorded(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      startVisualizer(stream);
      secondsRef.current = 0;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setRecError(
        "Akses microphone ditolak atau tidak tersedia. Izinkan akses microphone di browser lalu coba lagi."
      );
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    setRecording(false);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function handleToggle() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const statusLabel = recording
    ? "Merekam… klik untuk berhenti"
    : recordedBlob
      ? "Rekaman tersimpan. Klik untuk rekam ulang"
      : "Klik untuk mulai merekam";

  return (
    <div className="record-panel">
      <div className="script-quote">{RECORDING_SCRIPT}</div>
      <button
        type="button"
        className={`rec-button ${recording ? "recording" : ""}`}
        onClick={handleToggle}
        aria-label={statusLabel}
      >
        <div className="rec-shape" />
      </button>
      <div className={`live-wave ${recording ? "active" : ""}`}>
        {levels.map((height, index) => (
          <span
            key={index}
            style={{
              height: `${height}px`,
              background: recording ? WAVE_COLORS[index % WAVE_COLORS.length] : "#d9d2ea"
            }}
          />
        ))}
      </div>
      <div className="rec-label">{statusLabel}</div>
      <div className={`rec-timer ${recording ? "active" : ""}`}>{formatTimer(seconds)}</div>
      <div className="rec-hint">
        Durasi {minSeconds}-{MAX_SECONDS} detik (berhenti otomatis di {MAX_SECONDS} detik), satu
        pembicara, tanpa musik latar keras.
      </div>
      {previewUrl && !recording && <audio className="recorded-audio" controls src={previewUrl} />}
      {recError && <div className="error-box">{recError}</div>}
    </div>
  );
}
