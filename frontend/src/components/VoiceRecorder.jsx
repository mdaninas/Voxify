import { useEffect, useRef, useState } from "react";

const RECORDING_SCRIPT = `Saya menyatakan bahwa ini suara saya sendiri dan saya mengizinkan aplikasi ini membuat versi sintetis dari suara saya.

Halo, saya sedang merekam suara untuk membuat profil suara pribadi. Saya berbicara dengan jelas, santai, dan alami. Satu, dua, tiga, mari kita mulai.`;

const MIN_SECONDS = 10;
const MAX_SECONDS = 30;

function formatDuration(totalSeconds) {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceRecorder({ recordedBlob, onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recError, setRecError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
        if (secondsRef.current < MIN_SECONDS) {
          setRecError(`Rekaman terlalu pendek (${secondsRef.current} detik). Minimal ${MIN_SECONDS} detik, silakan rekam ulang.`);
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

  function resetRecording() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl("");
    setSeconds(0);
    secondsRef.current = 0;
    setRecError("");
    onRecorded(null);
  }

  return (
    <div>
      <div className="field">
        <span className="field-label">Script Bacaan</span>
        <div className="script-box">{RECORDING_SCRIPT}</div>
        <p className="hint">
          Baca script di atas dengan jelas dan santai. Durasi rekaman {MIN_SECONDS}-{MAX_SECONDS} detik,
          otomatis berhenti di {MAX_SECONDS} detik.
        </p>
      </div>

      <div className="field">
        <span className="field-label">Rekaman</span>
        {recording ? (
          <div className="recorder-status">
            <span className="rec-dot" />
            <span>Merekam…</span>
            <span className="timer">
              {formatDuration(seconds)} / {formatDuration(MAX_SECONDS)}
            </span>
          </div>
        ) : recordedBlob ? (
          <div className="recorder-status">
            <span>Rekaman selesai ({formatDuration(seconds)})</span>
          </div>
        ) : (
          <div className="recorder-status">
            <span>Belum ada rekaman. Minimal {MIN_SECONDS} detik.</span>
          </div>
        )}

        <div className="btn-row">
          {!recording && (
            <button type="button" className="btn" onClick={startRecording}>
              {recordedBlob ? "Rekam Ulang" : "Start Recording"}
            </button>
          )}
          {recording && (
            <button type="button" className="btn primary" onClick={stopRecording}>
              Stop Recording
            </button>
          )}
          {recordedBlob && !recording && (
            <button type="button" className="btn small" onClick={resetRecording}>
              Hapus Rekaman
            </button>
          )}
        </div>

        {previewUrl && !recording && <audio controls src={previewUrl} />}
        {recError && <div className="alert">{recError}</div>}
      </div>
    </div>
  );
}
