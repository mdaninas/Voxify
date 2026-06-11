# Voxify - Voice Cloning + Text-to-Speech (MVP Fase 1)

Aplikasi web untuk membuat suara sintetis dari sampel suara milik sendiri. User dapat merekam suara langsung dari browser atau mengunggah file audio, lalu mengetik teks dan menghasilkan audio yang dibacakan dengan suara hasil clone. Voice cloning dan text-to-speech ditenagai oleh [ElevenLabs API](https://elevenlabs.io).

## Fitur Utama

- Rekam suara langsung dari browser menggunakan MediaRecorder API (10-30 detik, otomatis berhenti di 30 detik), lengkap dengan timer, script bacaan, dan preview rekaman.
- Upload file audio (`.mp3`, `.wav`, `.m4a`, `.webm`) sebagai alternatif sampel suara, maksimal 25 MB.
- Consent checkbox wajib sebelum membuat voice clone, divalidasi di frontend dan backend, tersimpan dengan timestamp.
- Pembuatan Instant Voice Clone via ElevenLabs.
- Preview suara otomatis: setelah clone selesai, sistem membuat audio template ±5 detik yang bisa langsung diputar dari daftar voice.
- Generate audio dari teks (maksimal 1.000 karakter) menggunakan voice clone yang dipilih.
- Audio player untuk memutar hasil generate langsung di browser.
- Download hasil audio sebagai file MP3.
- History audio tersimpan di SQLite dan tetap ada setelah refresh.
- Hapus voice clone dan audio dari penyimpanan lokal.
- Demo Mode agar aplikasi tetap bisa didemokan tanpa API key ElevenLabs.
- Error handling dengan format response dan kode error yang konsisten.

## Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js 24, Express 4, `node:sqlite` (SQLite bawaan Node), Multer |
| Frontend | React 18, Vite 6 |
| AI Provider | ElevenLabs (Instant Voice Cloning + Text-to-Speech) |
| Storage | Local filesystem (`backend/storage`) + SQLite (`backend/data/app.sqlite`) |

## Arsitektur Singkat

```text
Browser (React)
  │  upload/record audio, teks, perintah play/download
  ▼
Backend (Express, port 8000)
  │  validasi, simpan file & metadata, simpan history
  ├── SQLite (voices, generated_audios, app_events)
  ├── storage/samples   (sampel suara)
  ├── storage/previews  (preview suara hasil clone, ±5 detik)
  ├── storage/outputs   (audio hasil generate)
  ▼
ElevenLabs API
  ├── POST /v1/voices/add            → membuat voice clone, mengembalikan voice_id
  └── POST /v1/text-to-speech/:id    → mengubah teks menjadi audio
```

API key ElevenLabs hanya dibaca oleh backend dan tidak pernah dikirim ke frontend. Frontend tidak pernah memanggil ElevenLabs secara langsung. Integrasi provider dipisahkan ke `backend/src/services/elevenLabsService.js` sehingga mudah diganti atau ditambah provider lain.

## Struktur Project

```text
Voice Clone/
  backend/
    src/
      routes/        health, voices, speech, audios
      services/      elevenLabsService
      database/      koneksi & schema SQLite
      utils/         error handling, generator audio demo
      config.js
      server.js
    data/            app.sqlite (dibuat otomatis)
    storage/         samples / previews / outputs / tmp (dibuat otomatis)
    .env.example
  frontend/
    src/
      components/    CreateVoiceSection, VoiceRecorder, GenerateSection, HistorySection
      utils/         api client
      App.jsx
      styles.css
    vite.config.js
  README.md
```

## Setup Lokal

Prasyarat: Node.js 22.5 atau lebih baru (disarankan Node 24).

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env
npm start
```

Backend berjalan di `http://localhost:8000`. Cek `http://localhost:8000/api/health` untuk memastikan server hidup.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di `http://localhost:5173` dan otomatis mem-proxy request `/api/*` ke backend port 8000.

### Test Otomatis

```bash
cd backend
npm test

cd ../frontend
npm test
npm run build
```

## Environment Variables

Semua konfigurasi backend ada di `backend/.env` (salin dari `.env.example`):

| Variable | Default | Keterangan |
|---|---|---|
| `APP_ENV` | `development` | Mode environment |
| `APP_PORT` | `8000` | Port backend |
| `DATABASE_PATH` | `./data/app.sqlite` | Lokasi file SQLite |
| `STORAGE_DIR` | `./storage` | Folder penyimpanan audio |
| `MAX_UPLOAD_MB` | `25` | Batas ukuran file sampel |
| `MIN_SAMPLE_SECONDS` | `10` | Durasi minimal sampel audio yang diterima backend |
| `MAX_TEXT_LENGTH` | `1000` | Batas karakter teks per generate |
| `JSON_BODY_LIMIT` | `128kb` | Batas ukuran body JSON |
| `CORS_ORIGIN` | `http://localhost:5173,http://127.0.0.1:5173` | Origin frontend yang boleh mengakses backend |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Jendela rate limit API dalam milidetik |
| `RATE_LIMIT_MAX` | `120` | Maksimal request API per jendela |
| `GENERATION_RATE_LIMIT_MAX` | `20` | Maksimal request proses audio per jendela |
| `ELEVENLABS_API_KEY` | (kosong) | API key ElevenLabs, wajib untuk Live Mode |
| `ELEVENLABS_TTS_MODEL` | `eleven_multilingual_v2` | Model TTS (mendukung Bahasa Indonesia) |
| `ELEVENLABS_OUTPUT_FORMAT` | `mp3_44100_128` | Format output ElevenLabs |
| `ELEVENLABS_TIMEOUT_MS` | `30000` | Timeout request ke ElevenLabs dalam milidetik |
| `ELEVENLABS_MAX_RETRIES` | `2` | Jumlah retry (dengan exponential backoff) saat request ElevenLabs gagal |
| `STORAGE_RETENTION_DAYS` | `30` | Audio hasil generate yang lebih tua dari ini dihapus otomatis (`0` = nonaktif) |
| `MAX_STORAGE_MB` | `500` | Batas total storage; audio tertua dihapus jika terlampaui (`0` = nonaktif) |
| `BACKUP_KEEP` | `7` | Jumlah backup harian SQLite yang disimpan di `data/backups` |
| `MAINTENANCE_INTERVAL_HOURS` | `6` | Interval pemeliharaan storage (retention, cap, orphan cleanup, backup) |
| `DEMO_MODE` | `false` | `true` untuk menjalankan tanpa ElevenLabs |

Jangan commit file `.env`. Hanya `.env.example` yang masuk repository.

### Pemeliharaan Storage & Backup

Backend menjalankan pemeliharaan otomatis saat startup dan setiap `MAINTENANCE_INTERVAL_HOURS`:

1. Menghapus audio hasil generate yang melewati `STORAGE_RETENTION_DAYS`.
2. Menghapus audio tertua jika total storage melebihi `MAX_STORAGE_MB`.
3. Membersihkan file orphan (file di storage yang tidak tercatat di database) dan file temp lama.
4. Membuat backup harian SQLite via `VACUUM INTO` ke `data/backups`, menyimpan `BACKUP_KEEP` terakhir.

Skema database dikelola dengan migration versioning (`PRAGMA user_version`) di `backend/src/database/migrations.js`.

## Cara Menggunakan

1. Buka `http://localhost:5173`.
2. Di **Langkah 1**, rekam suara lewat tab Record Voice (baca script yang disediakan, durasi 10-30 detik) atau pilih file lewat tab Upload Audio.
3. Isi nama voice dan centang consent, lalu klik **Create Voice Clone**.
4. Setelah clone selesai, klik tombol **Play** di daftar voice untuk mendengar preview ±5 detik suara hasil clone.
5. Di **Langkah 2**, pilih voice yang sudah dibuat, ketik teks (maks. 1.000 karakter), lalu klik **Generate Audio**.
6. Putar hasilnya lewat audio player atau unduh sebagai MP3.
7. Semua hasil generate tersimpan di **Langkah 3 - History Audio** dan tetap ada setelah refresh.

## Demo Mode vs Live AI Mode

| | Demo Mode | Live AI Mode |
|---|---|---|
| Syarat | `DEMO_MODE=true` | `DEMO_MODE=false` + API key ElevenLabs valid |
| Voice clone | Membuat `provider_voice_id` palsu (`demo_voice_xxx`), tidak memanggil ElevenLabs | Memanggil ElevenLabs Create IVC Voice API |
| Preview suara | File MP3 placeholder 5 detik (nada) | MP3 ±5 detik dengan suara hasil clone |
| Generate audio | Menghasilkan file MP3 placeholder (nada) | Memanggil ElevenLabs TTS, hasil MP3 dengan suara clone |
| Kegunaan | Demo alur aplikasi tanpa kuota/API key | Hasil suara asli |

Saat Demo Mode aktif, UI menampilkan badge **Demo Mode Active**.

## API Endpoints

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/health` | Health check + status mode |
| POST | `/api/voices` | Buat voice clone (multipart: `name`, `audio_file`, `consent_accepted`, `source_type`) |
| GET | `/api/voices` | Daftar voice clone |
| GET | `/api/voices/:id/preview` | Stream preview suara hasil clone (±5 detik) |
| DELETE | `/api/voices/:id` | Hapus voice lokal (`?delete_provider=true` untuk hapus juga di ElevenLabs) |
| POST | `/api/speech/generate` | Generate audio (JSON: `voice_id`, `text`) |
| GET | `/api/audios` | History audio |
| GET | `/api/audios/:id/file` | Stream file audio untuk player |
| GET | `/api/audios/:id/download` | Download file audio |
| DELETE | `/api/audios/:id` | Hapus audio |

Format error konsisten:

```json
{
  "success": false,
  "error": {
    "code": "CONSENT_REQUIRED",
    "message": "Consent wajib disetujui sebelum membuat voice clone."
  }
}
```

Kode error: `VALIDATION_ERROR`, `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `CONSENT_REQUIRED`, `ELEVENLABS_API_ERROR`, `VOICE_NOT_FOUND`, `AUDIO_NOT_FOUND`, `INTERNAL_SERVER_ERROR`.

## Consent & Keamanan

- User wajib mencentang pernyataan bahwa suara yang digunakan adalah miliknya sendiri atau sudah mendapat izin resmi. Consent divalidasi ulang di backend dan disimpan dengan timestamp.
- API key ElevenLabs hanya berada di backend (`.env`) dan tidak pernah dikirim ke browser.
- File upload dibatasi format, ukuran, MIME asli, dan durasi minimal, disimpan dengan nama UUID, dan tidak pernah dieksekusi.
- Folder storage tidak diekspos langsung; file audio hanya bisa diakses lewat endpoint backend.
- Disclaimer penyalahgunaan ditampilkan di UI: aplikasi hanya boleh digunakan dengan suara milik sendiri atau yang sudah diizinkan, bukan untuk penipuan atau peniruan tanpa izin.
- Backend memakai security headers, origin whitelist, batas body JSON, dan rate limit dasar untuk endpoint API/proses audio.

## Screenshot

_Screenshot/video demo menyusul._
