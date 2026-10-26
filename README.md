# Web TTS ID — EAM Playground (Go + Gin)

Aplikasi web permainan Teka-Teki Silang (TTS) modern, interaktif, dan responsif yang dibangun menggunakan **Go (Gin Framework)**, **GORM**, dan **PostgreSQL (Supabase)** di sisi backend, serta **HTML5, CSS Grid, dan Vanilla JavaScript** di sisi frontend.

Proyek ini telah dikonfigurasi agar **100% Hostless-Ready** dan dapat langsung di-deploy ke platform cloud seperti **Hostless Cloud** (`hostless.cloud`).

---

## 🚀 Fitur Utama

1. **Autentikasi & Otorisasi:**
   - Registrasi dan Login akun berbasis JWT (JSON Web Token) dengan masa aktif 24 jam.
   - Enkripsi kata sandi menggunakan standar industri `bcrypt`.
   - Pemisahan hak akses antara pemain biasa (**User**) dan pengelola konten (**Administrator**).

2. **Permainan TTS Interaktif:**
   - Papan TTS dinamis berbasis **CSS Grid** yang presisi dan kontras tinggi.
   - Kursor keyboard pintar: otomatis maju saat mengetik, mundur saat menekan Backspace, dan navigasi panah.
   - Deteksi persilangan kata: klik dua kali pada kotak silang untuk membalik arah kata (Mendatar $\leftrightarrow$ Menurun).
   - Klik kartu soal di panel kanan untuk langsung menyorot dan memfokuskan kursor ke kotak yang bersangkutan.

3. **Keamanan Skor & Validasi Backend:**
   - Penambahan skor divalidasi langsung di sisi server (`POST /api/score`) guna mencegah manipulasi DevTools browser.
   - Aturan skor: Benar **+10 Poin**, Hint **-10 Poin**, Papan Selesai tercatat ke profil.

4. **Leaderboard & Profil Pemain Real-Time:**
   - **Leaderboard Top 10:** Peringkat pemain terbaik dengan skor tertinggi dan medali kejuaraan (🥇, 🥈, 🥉).
   - **Profil & Statistik Pemain:** Menampilkan total skor, peringkat global (*Global Rank*), total kata terpecahkan, riwayat papan selesai, dan jumlah hint yang digunakan.

5. **Dashboard Administrator (CRUD Papan TTS):**
   - Panel khusus di `/admin` untuk melihat daftar papan, menambah papan baru, mengedit dimensi/status aktif, dan menghapus papan.

6. **Audio Engine & Efek Visual:**
   - Suara ketikan keyboard, efek suara kata benar (*chime*), suara peringatan salah (*buzzer* & getaran merah), serta musik latar santai (*ambient BGM synthesizer*) menggunakan **Web Audio API** bawaan tanpa jeda jaringan (*zero-lag*).
   - Animasi ledakan konfeti & kembang api (*canvas-confetti*) saat seluruh papan berhasil diselesaikan.

---

## 🛠️ Persyaratan Sistem

- **Go:** Versi 1.21 atau lebih baru (`go version`)
- **Database:** PostgreSQL (Supabase / Neon / PostgreSQL Lokal)
- **Git:** Version Control

---

## ⚙️ Konfigurasi Environment Variable

Aplikasi membaca konfigurasi rahasia dari variabel lingkungan atau file `.env`.

1. Salin template `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Sesuaikan isi file `.env`:
   ```dotenv
   APP_PORT=8080
   DATABASE_URL=postgresql://username:password@hostname:5432/database_name?sslmode=require
   JWT_SECRET=kunci-rahasia-jwt-super-aman
   ```
   > **Catatan:** File `.env` sudah masuk ke dalam `.gitignore` sehingga kredensial sensitif tidak akan terunggah ke repositori Git.

---

## 📦 Cara Instalasi & Menjalankan Aplikasi

### 1. Unduh Dependensi Modul Go
```bash
go mod tidy
```

### 2. Jalankan Server (Mode Pengembangan)
```bash
go run main.go
```
Aplikasi akan menyala dan dapat diakses di peramban melalui alamat:
```text
http://localhost:8080
```

### 3. Kompilasi & Jalankan Binary Produksi (Sesuai Job Sheet)
Untuk menguji proses build sebelum deployment:
```bash
# Kompilasi aplikasi menjadi binary 'app'
go build -o app .

# Jalankan binary
./app
```
*(Di sistem Windows PowerShell, jalankan dengan `.\app.exe`)*.

---

## 🧪 Panduan Pengujian Fitur (Testing Checklist)

| No | Fitur yang Diuji | Hasil yang Diharapkan |
|:--:|:-----------------|:----------------------|
| 1 | **Registrasi Akun** | Pengguna berhasil mendaftar akun baru di `/register`. |
| 2 | **Login Akun** | Pengguna berhasil masuk dan menerima token JWT di `/login`. |
| 3 | **Proteksi Halaman Game** | Pengguna yang belum login otomatis diarahkan ke halaman login. |
| 4 | **Penyajian Papan TTS** | Papan TTS tampil dengan geometri yang rapi dan daftar soal mendatar/menurun lengkap. |
| 5 | **Validasi Jawaban** | Huruf salah menghasilkan getaran merah dan suara buzzer; kata benar berubah menjadi hijau (+10 poin). |
| 6 | **Sistem Bantuan (Hint)** | Tombol hint membuka 1 huruf bantuan dan mengurangi skor 10 poin (-10). |
| 7 | **Kemenangan Papan** | Selesainya papan memicu animasi konfeti/kembang api dan modal kemenangan. |
| 8 | **Sinkronisasi Skor** | Skor bertambah dan tersimpan permanen di database PostgreSQL. |
| 9 | **Papan Peringkat** | Modal peringkat menampilkan Top 10 pemain dengan skor tertinggi. |
| 10 | **Profil Pengguna** | Modal profil menampilkan statistik lengkap dan peringkat global akun. |
| 11 | **Dashboard Admin** | Pengguna dengan role admin dapat mengelola papan di `/admin`. |

---

## ☁️ Panduan Deployment ke Hostless Cloud (`hostless.cloud`)

1. **Persiapan Git:**
   - Pastikan kode telah diuji secara lokal dengan `go build -o app .`.
   - Lakukan commit dan push ke repositori GitHub pribadi Anda:
     ```bash
     git add .
     git commit -m "feat: complete Web TTS project hostless-ready"
     git push origin main
     ```

2. **Deploy di Hostless Cloud:**
   - Akses [https://hostless.cloud](https://hostless.cloud) dan login menggunakan akun GitHub Anda.
   - Pilih menu **Create an app**.
   - Berikan izin akses repository GitHub ke **Hostless App**.
   - Tentukan **App Name** tanpa spasi (misalnya: `govibetest`).
   - Masukkan konfigurasi **Environment Variables** di dashboard Hostless:
     - `DATABASE_URL`: Connection string PostgreSQL Supabase Anda.
     - `JWT_SECRET`: Kunci rahasia JWT Anda.
     - `APP_PORT`: `8080` (atau gunakan default port yang disediakan Hostless via `PORT`).
   - Klik **Deploy / Launch**, tunggu hingga proses *Building application* dan *Starting application* selesai bertanda hijau.
   - Aplikasi web TTS Anda kini telah aktif dan dapat diakses secara publik di seluruh dunia!

