# Project Specification — Vibe Coding

> **Tugas 1:** Isi spesifikasi aplikasi sebelum mulai melakukan vibe coding.
>
> Tentukan kebutuhan aplikasi dan pilih teknologi yang akan digunakan. Jangan mulai membuat kode sebelum spesifikasi selesai.

## 1. Informasi Aplikasi

**Nama aplikasi:**  
Web EAM Playground / TTS ID

**Deskripsi aplikasi:**  
Versi web dari permainan Teka-Teki Silang (TTS) dengan tampilan modern dan interaktif, mempertahankan geometri dan aturan permainan dari versi bot Telegram.

**Target pengguna:**  
Pemain TTS yang menginginkan pengalaman bermain yang lebih visual dan interaktif melalui browser (laptop dan ponsel).

**Masalah yang ingin diselesaikan:**  
Mengubah pengalaman bermain TTS dari sekadar membalas pesan dan melihat gambar statis (PNG) menjadi interaksi langsung di atas papan (grid) interaktif berbasis web, dengan memisahkan data pengguna web dari pengguna Telegram.

## 2. Kebutuhan Aplikasi

Fitur utama aplikasi:

1. Registrasi dan Login pengguna web (terpisah dari Telegram).
2. Menampilkan daftar papan TTS yang tersedia dari database master.
3. Permainan TTS interaktif dengan papan berbasis CSS Grid.
4. Memilih soal (mendatar/menurun), mengisi jawaban, dan menggunakan hint.
5. Menyimpan progres permainan dan skor khusus untuk pengguna web.

**Halaman aplikasi:**

- Login
- Register
- Main Page — Papan TTS Interaktif (Daftar papan & Skor)

Pada Main Page, pengguna dapat melihat daftar papan TTS, bermain TTS, mengisi jawaban, menggunakan hint, dan logout.

## 3. Pilihan Teknologi

Pilih satu opsi untuk setiap komponen yang diperlukan. Sesuaikan dengan kebutuhan aplikasi. isiskan [x] hanya satu saja

### A. Backend Framework

- [ ] 1. Go Standard Library (`net/http`)
- [x] 2. Gin
- [ ] 3. Lainnya sebutkan

**Pilihan saya:** 2

### B. ORM (Object-Relational Mapping)

- [ ] 1. Tidak menggunakan ORM (SQL manual)
- [x] 2. GORM
- [ ] 3. Lainnya sebutkan

**Pilihan saya:** 2

**Ketentuan:** Memakai GORM dengan driver PostgreSQL untuk mengelola tabel `web_users`, `web_games`, dan membaca tabel master TTS.

### C. Database

- [x] 1. PostgreSQL
- [ ] 2. MySQL
- [ ] 3. SQLite

**Pilihan saya:** 1

### D. Frontend

- [x] 1. HTML, CSS, JavaScript murni
- [ ] 2. React
- [ ] 3. Vue

**Pilihan saya:** 1

### E. Sistem Autentikasi

- [ ] 1. Session
- [x] 2. JWT

**Pilihan saya:** 2

**Ketentuan:** Gunakan JWT berbasis server untuk mengelola status login pengguna web.

### F. Penyimpanan Sesi atau Token

- [ ] 1. Cookie
- [x] 2. localStorage
- [ ] 3. Tidak diperlukan

**Pilihan saya:** 2

**Ketentuan:** Simpan token JWT dalam localStorage dengan penanganan otorisasi pada header API.

### G. API

- [x] 1. REST API
- [ ] 2. Tidak membutuhkan API terpisah

**Pilihan saya:** 1

**Ketentuan:** Backend Gin menyediakan REST API. Frontend mengakses API menggunakan `fetch()`.

### H. Version Control

- [x] 1. Git
- [ ] 2. Tidak menggunakan Git

**Pilihan saya:** 1

## 4. Detail Autentikasi

**Registrasi akun:** Ya

**Login:** Ya

**Logout:** Ya

**Role pengguna:** User saja. Tidak ada role Admin.

**Aturan akses:**

1. Pengguna harus login untuk mengakses permainan TTS.
2. Pengguna yang belum login hanya dapat mengakses halaman Login dan Register.
3. Setiap permainan harus memiliki `user_id` (web user) sebagai pemainnya.
4. Backend harus memeriksa kepemilikan sesi permainan pada setiap operasi mengisi jawaban atau meminta hint.
5. Pengguna tidak boleh melihat atau mengubah progres permainan pengguna lain, termasuk dengan mengubah ID pada URL atau request API.
6. Password harus disimpan dalam bentuk hash menggunakan algoritma yang sesuai (bcrypt), bukan sebagai teks biasa.
7. Setelah logout, token JWT dihapus dari localStorage.
8. Data user Telegram (chat_id, user_id) tidak digunakan di versi web.

## 5. Konfigurasi Environment dan Database

**Ketentuan wajib:**

1. Semua konfigurasi aplikasi yang sensitif harus menggunakan environment variable.
2. Gunakan file `.env` untuk konfigurasi saat pengembangan lokal.
3. Sediakan file `.env.example` sebagai contoh konfigurasi tanpa kredensial asli.
4. File `.env` tidak boleh dimasukkan ke Git.
5. URL atau connection string PostgreSQL harus dibaca dari environment variable bernama `DATABASE_URL`.
6. Jangan menulis URL database, username, password database, session secret, atau kredensial lainnya secara langsung di kode.
7. Aplikasi harus memberikan pesan error yang jelas jika konfigurasi wajib belum tersedia, tanpa membocorkan password atau rahasia lainnya.

Contoh `.env.example`:

```dotenv
APP_PORT=8080
DATABASE_URL=postgres://username:password@localhost:5432/tts_db?sslmode=disable
JWT_SECRET=rahasia-jwt-super-aman