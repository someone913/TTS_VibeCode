/**
 * tts.js - Logika Interaktif Papan TTS ID & Mode Turnamen Real-Time
 * Fitur:
 * - Keamanan Admin Terpusat: Tombol admin hanya tampil jika is_admin == true dari Supabase
 * - Mode Turnamen & WebSockets: Melacak pemain online & pertukaran serangan real-time
 * - Mekanik Item & Inventori: Soal berhadiah Bom 💣 & Freeze ❄️, Amunisi & Lempar Target
 * - Efek Serangan & SFX: Freeze (kunci input 5s + suara es), Bom (shake + blur 5s + meme ketawa ngakak)
 * - Audio Engine (Ketik, Chime Benar, Buzzer Salah, BGM, Fanfare) & Konfeti Kemenangan
 */

document.addEventListener("DOMContentLoaded", () => {
    // 1. Validasi Autentikasi Pengguna
    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    // Inisialisasi Tampilan User
    const user = getUser();
    const displayUsername = document.getElementById("display-username");
    if (displayUsername) {
        displayUsername.textContent = user ? user.username : "Pemain";
    }

    // State Permainan
    let currentBoard = null;
    let gridMatrix = [];
    let boardWords = [];
    let activeCell = { row: -1, col: -1 };
    let activeDirection = "HORIZONTAL"; // "HORIZONTAL" (Mendatar) atau "VERTICAL" (Menurun)
    let currentScore = 0;
    let completedBoardsCount = 0;
    let completedWordsCount = 0;

    // State Turnamen & Serangan
    let tournamentWS = null;
    let onlinePlayers = [];
    let currentItemToThrow = null;
    let isAttackedFrozen = false;
    let isAttackedBombed = false;
    let freezeTimerTimeout = null;
    let bombTimerTimeout = null;
    let attackToastInterval = null;

    // State Match Bersama / Duel / Room Mabar (1 Papan Sama)
    let activeMatchRoom = null;
    let availableRooms = [];
    let incomingChallenge = null;

    // Inventori Amunisi Pemain
    const inventory = {
        bomb: 0,
        freeze: 0
    };

    // Elemen DOM Utama
    const boardEl = document.getElementById("tts-board");
    const boardViewport = document.getElementById("board-viewport");
    const boardPill = document.getElementById("board-pill");
    const progressText = document.getElementById("board-progress-text");
    const acrossCluesList = document.getElementById("across-clues");
    const downCluesList = document.getElementById("down-clues");
    const clueCountBadge = document.getElementById("clue-count-badge");
    const scoreCounter = document.getElementById("score-counter");
    const scoreBox = document.getElementById("score-box");
    const hintBtn = document.getElementById("hint-btn");
    const nextBoardBtn = document.getElementById("next-board-btn");
    const modeSelect = document.getElementById("mode-select");
    const logoutBtn = document.getElementById("logout-btn");
    const adminNavBtn = document.getElementById("admin-nav-btn");

    // Elemen Turnamen & Inventori
    const onlineCountEl = document.getElementById("online-players-count");
    const openPlayersBtn = document.getElementById("open-players-btn");
    const openLobbyBtn = document.getElementById("open-lobby-btn");
    const itemBtnBomb = document.getElementById("item-btn-bomb");
    const itemBtnFreeze = document.getElementById("item-btn-freeze");
    const countBombEl = document.getElementById("count-bomb");
    const countFreezeEl = document.getElementById("count-freeze");

    // Bilah Status Pertandingan Aktif (1 Papan Bersama)
    const matchStatusBar = document.getElementById("match-status-bar");
    const matchRoomName = document.getElementById("match-room-name");
    const matchPlayersProgress = document.getElementById("match-players-progress");
    const leaveMatchBtn = document.getElementById("leave-match-btn");

    // Modal Lobby Tantangan & Room
    const lobbyModal = document.getElementById("lobby-modal");
    const closeLobbyBtn = document.getElementById("close-lobby-btn");
    const tabDuelBtn = document.getElementById("tab-duel-btn");
    const tabRoomsBtn = document.getElementById("tab-rooms-btn");
    const lobbyDuelPanel = document.getElementById("lobby-duel-panel");
    const lobbyRoomsPanel = document.getElementById("lobby-rooms-panel");
    const refreshOnlineBtn = document.getElementById("refresh-online-btn");
    const lobbyPlayersList = document.getElementById("lobby-players-list");
    const openCreateRoomBtn = document.getElementById("open-create-room-btn");
    const lobbyRoomsList = document.getElementById("lobby-rooms-list");

    // Modal Tantangan Masuk
    const challengeModal = document.getElementById("challenge-modal");
    const challengeModalMsg = document.getElementById("challenge-modal-msg");
    const acceptChallengeBtn = document.getElementById("accept-challenge-btn");
    const rejectChallengeBtn = document.getElementById("reject-challenge-btn");

    // Modal Buat Kamar Mabar Baru
    const createRoomModal = document.getElementById("create-room-modal");
    const closeCreateRoomBtn = document.getElementById("close-create-room-btn");
    const createRoomForm = document.getElementById("create-room-form");
    const roomNameInput = document.getElementById("room-name-input");
    const roomMaxPlayers = document.getElementById("room-max-players");

    // Modal Hasil Pertandingan Turnamen (Match Over)
    const matchOverModal = document.getElementById("match-over-modal");
    const matchOverTitle = document.getElementById("match-over-title");
    const matchOverDesc = document.getElementById("match-over-desc");
    const matchOverScoreboard = document.getElementById("match-over-scoreboard");
    const closeMatchOverBtn = document.getElementById("close-match-over-btn");

    // Modal Pilih Target
    const targetModal = document.getElementById("target-modal");
    const closeTargetBtn = document.getElementById("close-target-btn");
    const targetPlayersList = document.getElementById("target-players-list");
    const selectedItemLabel = document.getElementById("selected-item-label");
    const targetModalAlert = document.getElementById("target-modal-alert");

    // Toast Notifikasi Serangan
    const attackToast = document.getElementById("attack-toast");
    const attackToastIcon = document.getElementById("attack-toast-icon");
    const attackToastTitle = document.getElementById("attack-toast-title");
    const attackToastMsg = document.getElementById("attack-toast-msg");
    const attackToastTimer = document.getElementById("attack-toast-timer");

    // Modal Profil
    const profileBtn = document.getElementById("profile-btn");
    const profileModal = document.getElementById("profile-modal");
    const closeProfileBtn = document.getElementById("close-profile-btn");
    const profileModalUsername = document.getElementById("profile-modal-username");
    const profileModalRole = document.getElementById("profile-modal-role");
    const profileStatScore = document.getElementById("profile-stat-score");
    const profileStatRank = document.getElementById("profile-stat-rank");
    const profileStatBoards = document.getElementById("profile-stat-boards");
    const profileStatWords = document.getElementById("profile-stat-words");
    const profileStatHints = document.getElementById("profile-stat-hints");
    const profileStatDate = document.getElementById("profile-stat-date");

    // Modal Leaderboard
    const leaderboardBtn = document.getElementById("leaderboard-btn");
    const leaderboardModal = document.getElementById("leaderboard-modal");
    const closeLeaderboardBtn = document.getElementById("close-leaderboard-btn");
    const leaderboardBody = document.getElementById("leaderboard-body");

    // Modal Kemenangan
    const victoryModal = document.getElementById("victory-modal");
    const modalBoardId = document.getElementById("modal-board-id");
    const modalTotalScore = document.getElementById("modal-total-score");
    const modalNextBtn = document.getElementById("modal-next-btn");

    // Tombol Musik Latar & Tema
    const bgmToggleBtn = document.getElementById("bgm-toggle-btn");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = document.getElementById("theme-icon");
    const themeText = document.getElementById("theme-text");

    function initTheme() {
        const savedTheme = localStorage.getItem("tts_theme") ||
            (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        applyTheme(savedTheme);

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener("click", () => {
                const current = document.documentElement.getAttribute("data-theme") || "dark";
                const next = current === "dark" ? "light" : "dark";
                applyTheme(next);
                playTypeSound();
            });
        }
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("tts_theme", theme);
        if (themeIcon) themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
        if (themeText) themeText.textContent = theme === "dark" ? "Gelap" : "Terang";
        if (themeToggleBtn) {
            themeToggleBtn.title = theme === "dark" ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)";
        }
    }

    initTheme();

    /* ==========================================================================
       Web Audio API Sound Engine & SFX Serangan
       ========================================================================== */
    let audioCtx = null;
    let bgmOscillators = [];
    let isBgmPlaying = false;

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // Suara Ketikan Halus (Click Blip)
    function playTypeSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.035);

            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch {}
    }

    // Suara Huruf Salah (Soft Buzzer)
    function playWrongSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(180, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.16);

            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(350, ctx.currentTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.17);
        } catch {}
    }

    // Suara Sukses Kata Benar (Harmonic 4-Tone Chime)
    function playWordSuccessSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);

                gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.35);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + idx * 0.07);
                osc.stop(ctx.currentTime + idx * 0.07 + 0.36);
            });
        } catch {}
    }

    // Suara Mendapatkan Amunisi Item (Powerup Fanfare)
    function playItemClaimSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
            notes.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);

                gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + idx * 0.06);
                osc.stop(ctx.currentTime + idx * 0.06 + 0.28);
            });
        } catch {}
    }

    // Suara Es Membeku (Freeze Attack SFX)
    function playFreezeSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;

            // Suara kristal es membeku dengan frekuensi menurun
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(1500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.45);

            gain.gain.setValueAtTime(0.28, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);

            // Shimmer kristal es sekunder
            const shimmer = ctx.createOscillator();
            const sGain = ctx.createGain();
            shimmer.type = "triangle";
            shimmer.frequency.setValueAtTime(2400, ctx.currentTime + 0.05);
            shimmer.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 0.4);

            sGain.gain.setValueAtTime(0.18, ctx.currentTime + 0.05);
            sGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

            shimmer.connect(sGain);
            sGain.connect(ctx.destination);
            shimmer.start(ctx.currentTime + 0.05);
            shimmer.stop(ctx.currentTime + 0.48);
        } catch {}
    }

    // Suara Meme Ketawa Ngakak (Bom Attack SFX)
    function playBombMemeSound() {
        try {
            const laughAudio = new Audio("https://www.myinstants.com/media/sounds/ngakak-laugh-annoying-79255.mp3");
            laughAudio.volume = 0.9;
            laughAudio.play().catch(() => {
                // Fallback jika diblok autoplay browser: gunakan synth buzzer
                playWrongSound();
            });
        } catch {
            playWrongSound();
        }
    }

    // Suara Hint
    function playHintSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(850, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.18);

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.19);
        } catch {}
    }

    // Fanfare Kemenangan
    function playVictoryFanfare() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const fanfareNotes = [
                { f: 523.25, d: 0.12 },
                { f: 659.25, d: 0.12 },
                { f: 783.99, d: 0.12 },
                { f: 1046.50, d: 0.40 }
            ];
            let timeOffset = 0;
            fanfareNotes.forEach((note) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "triangle";
                osc.frequency.setValueAtTime(note.f, ctx.currentTime + timeOffset);

                gain.gain.setValueAtTime(0.18, ctx.currentTime + timeOffset);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + note.d);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + timeOffset);
                osc.stop(ctx.currentTime + timeOffset + note.d + 0.05);

                timeOffset += note.d + 0.04;
            });
        } catch {}
    }

    // Musik Latar Santai (Ambient BGM)
    function startAmbientBgm() {
        try {
            const ctx = getAudioContext();
            if (!ctx || isBgmPlaying) return;

            stopAmbientBgm();

            const freqs = [174.61, 220.00, 261.63, 329.63]; // F3 chord ambient
            freqs.forEach((freq) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, ctx.currentTime);

                gain.gain.setValueAtTime(0.012, ctx.currentTime);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start();
                bgmOscillators.push(osc);
            });

            isBgmPlaying = true;
            if (bgmToggleBtn) {
                bgmToggleBtn.textContent = "🎵 Musik: ON";
                bgmToggleBtn.classList.add("active");
            }
        } catch {}
    }

    function stopAmbientBgm() {
        bgmOscillators.forEach((osc) => {
            try { osc.stop(); osc.disconnect(); } catch {}
        });
        bgmOscillators = [];
        isBgmPlaying = false;
        if (bgmToggleBtn) {
            bgmToggleBtn.textContent = "🎵 Musik: OFF";
            bgmToggleBtn.classList.remove("active");
        }
    }

    if (bgmToggleBtn) {
        bgmToggleBtn.addEventListener("click", () => {
            if (isBgmPlaying) {
                stopAmbientBgm();
                localStorage.setItem("tts_bgm_state", "off");
            } else {
                startAmbientBgm();
                localStorage.setItem("tts_bgm_state", "on");
            }
        });
    }

    /* ==========================================================================
       Keamanan Admin Terpusat & Sinkronisasi Profil
       ========================================================================== */
    async function syncUserData() {
        try {
            const res = await apiFetch("/api/auth/me");
            if (res && res.user) {
                currentScore = res.user.score || 0;
                completedBoardsCount = res.user.boards_completed || 0;
                updateScoreDisplay();
                if (displayUsername) {
                    displayUsername.textContent = res.user.username;
                }

                // Keamanan Tombol Admin: hanya muncul jika role admin terkonfirmasi
                if (res.user.is_admin && adminNavBtn) {
                    adminNavBtn.classList.remove("hidden");
                    adminNavBtn.href = `/admin?token=${encodeURIComponent(token)}`;
                } else if (adminNavBtn) {
                    adminNavBtn.classList.add("hidden");
                }
            }
        } catch (err) {
            console.error("Gagal sinkronisasi data user:", err);
        }
    }

    async function sendScoreAction(action, triggerEl) {
        try {
            const res = await apiFetch("/api/score", {
                method: "POST",
                body: JSON.stringify({ action })
            });

            if (res && typeof res.score === "number") {
                const diff = res.score - currentScore;
                currentScore = res.score;
                completedBoardsCount = res.boards_completed || completedBoardsCount;
                updateScoreDisplay();

                if (diff !== 0) {
                    showFloatingScore(diff, triggerEl || scoreBox);
                }
            }
        } catch (err) {
            console.error("Gagal sinkronisasi skor:", err);
        }
    }

    function updateScoreDisplay() {
        if (scoreCounter) {
            scoreCounter.textContent = currentScore;
        }
    }

    function showFloatingScore(points, sourceEl) {
        const floatEl = document.createElement("div");
        floatEl.className = `score-float ${points >= 0 ? "score-plus" : "score-minus"}`;
        floatEl.textContent = points >= 0 ? `+${points}` : `${points}`;

        const rect = (sourceEl || scoreBox).getBoundingClientRect();
        floatEl.style.left = `${rect.left + rect.width / 2}px`;
        floatEl.style.top = `${rect.top}px`;

        document.body.appendChild(floatEl);

        setTimeout(() => {
            floatEl.remove();
        }, 1200);
    }

    /* ==========================================================================
       Infrastruktur WebSockets (Mode Turnamen Real-Time & Tantang Duel)
       ========================================================================== */
    function initTournamentWebSocket() {
        if (!token) return;

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/ws/tournament?token=${encodeURIComponent(token)}`;

        try {
            tournamentWS = new WebSocket(wsUrl);

            tournamentWS.onopen = () => {
                console.log("[Tournament WS] Terhubung ke arena turnamen real-time");
                fetchTournamentStatus();
            };

            tournamentWS.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleTournamentWSMessage(data);
                } catch (err) {
                    console.error("[Tournament WS] Gagal membaca pesan:", err);
                }
            };

            tournamentWS.onclose = () => {
                console.warn("[Tournament WS] Koneksi terputus, mencoba menghubungkan kembali...");
                setTimeout(initTournamentWebSocket, 3500);
            };

            tournamentWS.onerror = (err) => {
                console.error("[Tournament WS] Error koneksi:", err);
            };
        } catch (err) {
            console.error("[Tournament WS] Gagal inisialisasi:", err);
        }
    }

    // Polling status turnamen sebagai fallback & heartbeat ping
    async function fetchTournamentStatus() {
        try {
            const res = await apiFetch("/api/tournament/status");
            if (res) {
                if (Array.isArray(res.online_players)) {
                    onlinePlayers = res.online_players;
                    if (onlineCountEl) {
                        onlineCountEl.textContent = onlinePlayers.length;
                    }
                }
                if (Array.isArray(res.rooms)) {
                    availableRooms = res.rooms;
                }
                if (lobbyModal && lobbyModal.classList.contains("show")) {
                    renderLobbyPlayers();
                    renderLobbyRooms();
                }
                if (targetModal && targetModal.classList.contains("show")) {
                    renderTargetPlayers();
                }
            }
        } catch (err) {
            // Silently ignore background polling errors
        }

        if (tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
            tournamentWS.send(JSON.stringify({ action: "ping" }));
        }
    }

    // Heartbeat berkala setiap 8 detik
    setInterval(fetchTournamentStatus, 8000);

    function handleTournamentWSMessage(data) {
        // 1. Pembaruan Daftar Pemain Online & Rooms
        if (data.type === "online_players") {
            onlinePlayers = data.players || [];
            if (data.rooms) {
                availableRooms = data.rooms;
            }
            if (onlineCountEl) {
                onlineCountEl.textContent = onlinePlayers.length;
            }
            if (lobbyModal && lobbyModal.classList.contains("show")) {
                renderLobbyPlayers();
                renderLobbyRooms();
            }
            if (targetModal && targetModal.classList.contains("show")) {
                renderTargetPlayers();
            }
        }
        // 2. Tantangan Duel Masuk dari Pemain Lain
        else if (data.type === "challenge_received") {
            incomingChallenge = {
                from_user: data.from_user,
                board_id: data.board_id
            };
            if (challengeModalMsg) {
                challengeModalMsg.innerHTML = `⚔️ Pemain <strong>${data.from_user}</strong> menantang Anda bertanding di <strong>Papan ${data.board_id}</strong>!<br><br>Papan dan soal akan sama persis. Apakah Anda menerima tantangan duel ini?`;
            }
            if (challengeModal) {
                challengeModal.classList.add("show");
            }
            playHintSound();
        }
        // 3. Konfirmasi Tantangan Terkirim
        else if (data.type === "challenge_sent") {
            showAttackToast("⏳", "Tantangan Terkirim", data.message || "Menunggu jawaban dari lawan...", 4);
        }
        // 4. Tantangan Ditolak
        else if (data.type === "challenge_rejected") {
            showAttackToast("❌", "Tantangan Ditolak", data.message || "Lawan menolak tantangan duel Anda.", 4);
        }
        // 5. Kesalahan Tantangan
        else if (data.type === "challenge_error") {
            alert(data.message || "Gagal mengirim tantangan.");
        }
        // 6. Pertandingan Dimulai (Duel 1v1 atau Room Mabar di Papan Sama)
        else if (data.type === "match_start") {
            activeMatchRoom = data.room || {
                id: data.room_id,
                board_id: data.board_id,
                name: data.room_name || "Duel 1 vs 1",
                players: {}
            };

            if (matchStatusBar) {
                matchStatusBar.classList.remove("hidden");
            }
            if (matchRoomName) {
                matchRoomName.textContent = activeMatchRoom.name || `Tanding Papan ${data.board_id}`;
            }

            renderMatchProgress(activeMatchRoom);

            // Muat papan yang sama persis untuk semua pemain!
            loadBoard(data.board_id);

            // Tutup semua modal lobby yang terbuka
            if (lobbyModal) lobbyModal.classList.remove("show");
            if (challengeModal) challengeModal.classList.remove("show");
            if (createRoomModal) createRoomModal.classList.remove("show");

            showAttackToast("⚔️", "PERTANDINGAN DIMULAI!", data.message || `Tanding di Papan ${data.board_id}!`, 4);
            playWordSuccessSound();
        }
        // 7. Live Siaran Progres Lawan di Room
        else if (data.type === "progress_broadcast") {
            updateOpponentProgress(data.from_user, data.words_solved, data.total_words);
        }
        // 8. Pertandingan Selesai / Juara Ditentukan
        else if (data.type === "match_over") {
            showMatchOver(data.winner, data.message);
        }
        // 9. Status Kamar Baru Dibuat
        else if (data.type === "room_created") {
            activeMatchRoom = data.room;
            if (createRoomModal) createRoomModal.classList.remove("show");
            showAttackToast("🏠", "Kamar Berhasil Dibuat", data.message || "Menunggu pemain bergabung...", 4);
            renderLobbyRooms();
        }
        // 10. Status Berhasil Masuk Kamar
        else if (data.type === "room_joined") {
            activeMatchRoom = data.room;
            showAttackToast("✅", "Berhasil Masuk Kamar", data.message || "Menunggu pertandingan dimulai...", 4);
            renderLobbyRooms();
        }
        // 11. Pembaruan Status Kamar
        else if (data.type === "room_updated") {
            if (data.room) {
                if (activeMatchRoom && activeMatchRoom.id === data.room.id) {
                    activeMatchRoom = data.room;
                    renderMatchProgress(activeMatchRoom);
                }
                const rIdx = availableRooms.findIndex(r => r.id === data.room.id);
                if (rIdx >= 0) availableRooms[rIdx] = data.room;
                else availableRooms.push(data.room);

                if (lobbyModal && lobbyModal.classList.contains("show")) {
                    renderLobbyRooms();
                }
            }
            if (data.message) {
                showAttackToast("ℹ️", "Info Room", data.message, 3);
            }
        }
        // 12. Kesalahan Kamar
        else if (data.type === "room_error") {
            alert(data.message || "Terjadi kesalahan pada room");
        }
        // 13. Menerima Serangan dari Pemain Lain
        else if (data.type === "attack_received") {
            const fromUser = data.from_user || "Pemain Lain";
            const duration = data.duration || 5;

            if (data.item_type === "freeze") {
                applyFreezeAttack(fromUser, duration);
            } else if (data.item_type === "bomb") {
                applyBombAttack(fromUser, duration);
            }
        }
        // 14. Konfirmasi Serangan Berhasil Dikirim
        else if (data.type === "attack_success") {
            const itemEmoji = data.item_type === "bomb" ? "Bom 💣" : "Freeze ❄️";
            showAttackToast("🚀", "Serangan Berhasil!", `Kamu berhasil melemparkan ${itemEmoji} ke ${data.target_user}!`, 3);
        }
        // 15. Kesalahan Serangan
        else if (data.type === "attack_error") {
            if (targetModalAlert) {
                targetModalAlert.textContent = data.message || "Gagal mengirim serangan";
                targetModalAlert.classList.remove("hidden");
            } else {
                alert(data.message || "Gagal mengirim serangan");
            }
        }
        // 16. Pengumuman Arena Turnamen
        else if (data.type === "tournament_event") {
            console.log("[Tournament Event]", data.message);
        }
    }

    /* ==========================================================================
       Efek Serangan (Freeze ❄️ & Bom 💣)
       ========================================================================== */
    function showAttackToast(icon, title, message, durationSeconds = 5) {
        if (!attackToast) return;

        if (attackToastIcon) attackToastIcon.textContent = icon;
        if (attackToastTitle) attackToastTitle.textContent = title;
        if (attackToastMsg) attackToastMsg.textContent = message;

        attackToast.classList.remove("hidden");

        if (attackToastInterval) clearInterval(attackToastInterval);

        let remaining = durationSeconds;
        if (attackToastTimer) attackToastTimer.textContent = `${remaining}s`;

        attackToastInterval = setInterval(() => {
            remaining--;
            if (attackToastTimer) attackToastTimer.textContent = `${remaining}s`;
            if (remaining <= 0) {
                clearInterval(attackToastInterval);
                attackToast.classList.add("hidden");
            }
        }, 1000);
    }

    // Efek Freeze: Kunci input papan selama 5 detik & putar suara es
    function applyFreezeAttack(fromUser, durationSeconds = 5) {
        isAttackedFrozen = true;

        if (boardViewport) {
            boardViewport.classList.add("board-frozen");
        }

        playFreezeSound();
        showAttackToast("❄️", "SERANGAN FREEZE MASUK!", `⚠️ Anda diserang oleh ${fromUser}! Kotak TTS membeku & terkunci selama 5 detik.`, durationSeconds);

        if (freezeTimerTimeout) clearTimeout(freezeTimerTimeout);
        freezeTimerTimeout = setTimeout(() => {
            isAttackedFrozen = false;
            if (boardViewport) {
                boardViewport.classList.remove("board-frozen");
            }
        }, durationSeconds * 1000);
    }

    // Efek Bom: Animasi getar (shake) + filter blur selama 5 detik & putar meme ketawa ngakak
    function applyBombAttack(fromUser, durationSeconds = 5) {
        isAttackedBombed = true;

        if (boardViewport) {
            boardViewport.classList.add("board-bombed");
        }

        playBombMemeSound();
        showAttackToast("💣", "SERANGAN BOM MASUK!", `⚠️ Anda diserang oleh ${fromUser}! Papan berguncang & kabur selama 5 detik.`, durationSeconds);

        if (bombTimerTimeout) clearTimeout(bombTimerTimeout);
        bombTimerTimeout = setTimeout(() => {
            isAttackedBombed = false;
            if (boardViewport) {
                boardViewport.classList.remove("board-bombed");
            }
        }, durationSeconds * 1000);
    }

    /* ==========================================================================
       Mekanik Inventori Amunisi & Lempar Target
       ========================================================================== */
    function updateInventoryUI() {
        if (countBombEl) countBombEl.textContent = inventory.bomb;
        if (countFreezeEl) countFreezeEl.textContent = inventory.freeze;

        if (itemBtnBomb) {
            itemBtnBomb.disabled = inventory.bomb <= 0;
            if (inventory.bomb > 0) itemBtnBomb.classList.add("has-stock");
            else itemBtnBomb.classList.remove("has-stock");
        }

        if (itemBtnFreeze) {
            itemBtnFreeze.disabled = inventory.freeze <= 0;
            if (inventory.freeze > 0) itemBtnFreeze.classList.add("has-stock");
            else itemBtnFreeze.classList.remove("has-stock");
        }
    }

    function claimTournamentItem(itemType) {
        if (itemType === "bomb") {
            inventory.bomb++;
        } else if (itemType === "freeze") {
            inventory.freeze++;
        }

        updateInventoryUI();
        playItemClaimSound();

        const itemName = itemType === "bomb" ? "Bom 💣" : "Freeze ❄️";
        showAttackToast("🎒", "Amunisi Didapatkan!", `Hebat! Anda mendapatkan 1x ${itemName}. Buka panel amunisi untuk menyerang lawan online!`, 4);
    }

    if (itemBtnBomb) {
        itemBtnBomb.addEventListener("click", () => {
            if (inventory.bomb > 0) openTargetModal("bomb");
        });
    }

    if (itemBtnFreeze) {
        itemBtnFreeze.addEventListener("click", () => {
            if (inventory.freeze > 0) openTargetModal("freeze");
        });
    }

    function openTargetModal(itemType) {
        currentItemToThrow = itemType;
        if (selectedItemLabel) {
            selectedItemLabel.textContent = itemType === "bomb" ? "Bom 💣" : "Freeze ❄️";
            selectedItemLabel.style.color = itemType === "bomb" ? "#ef4444" : "#38bdf8";
        }

        renderTargetPlayers();
        if (targetModal) targetModal.classList.add("show");
    }

    function renderTargetPlayers() {
        if (!targetPlayersList) return;
        targetPlayersList.innerHTML = "";
        if (targetModalAlert) targetModalAlert.classList.add("hidden");

        const me = getUser();
        const myName = me ? me.username.toLowerCase() : "";
        const targetList = onlinePlayers.filter((p) => p.toLowerCase() !== myName);

        if (targetList.length === 0) {
            targetPlayersList.innerHTML = `
                <div class="no-targets-notice">
                    <p style="font-weight: 700; margin-bottom: 6px;">Belum ada pemain lain yang online</p>
                    <p style="font-size: 0.85rem;">Buka tab penyamaran (incognito) atau ajak teman login untuk mencoba saling serang!</p>
                </div>
            `;
            return;
        }

        targetList.forEach((playerName) => {
            const row = document.createElement("div");
            row.className = "target-player-row";
            row.innerHTML = `
                <div class="target-player-name">
                    <span style="font-size: 1.3rem;">👤</span>
                    <span>${playerName}</span>
                </div>
                <button class="btn-attack">Lempar 💥</button>
            `;

            const attackBtn = row.querySelector(".btn-attack");
            attackBtn.addEventListener("click", () => {
                throwItemTo(playerName);
            });

            targetPlayersList.appendChild(row);
        });
    }

    function throwItemTo(targetUsername) {
        if (!currentItemToThrow || inventory[currentItemToThrow] <= 0) {
            alert("Amunisi tidak mencukupi!");
            return;
        }

        if (!tournamentWS || tournamentWS.readyState !== WebSocket.OPEN) {
            alert("Koneksi turnamen WebSocket terputus. Silakan muat ulang halaman.");
            return;
        }

        // Kirim payload WebSocket: { action: "throw_item", item_type: "bomb/freeze", target_user: "username" }
        tournamentWS.send(JSON.stringify({
            action: "throw_item",
            item_type: currentItemToThrow,
            target_user: targetUsername
        }));

        // Kurangi inventori
        inventory[currentItemToThrow]--;
        updateInventoryUI();

        if (targetModal) targetModal.classList.remove("show");
    }

    if (closeTargetBtn) {
        closeTargetBtn.addEventListener("click", () => {
            if (targetModal) targetModal.classList.remove("show");
        });
    }

    if (targetModal) {
        targetModal.addEventListener("click", (e) => {
            if (e.target === targetModal) targetModal.classList.remove("show");
        });
    }

    /* ==========================================================================
       Mode Tantangan Duel 1v1 & Kamar Mabar 1 Papan Sama
       ========================================================================== */

    // 1. Tampilkan Bilah Status Pertandingan & Progress Bar Tiap Pemain
    function renderMatchProgress(room) {
        if (!matchPlayersProgress) return;
        matchPlayersProgress.innerHTML = "";

        const myUsername = (getUser() ? getUser().username : "").toLowerCase();
        const playersObj = room && room.players ? room.players : {};
        const playerKeys = Object.keys(playersObj);

        if (playerKeys.length === 0) {
            const selfItem = createPlayerProgressItem(getUser() ? getUser().username : "Anda", completedWordsCount, boardWords.length || 10, true);
            matchPlayersProgress.appendChild(selfItem);
            return;
        }

        playerKeys.forEach((uname) => {
            const p = playersObj[uname];
            const isMe = uname.toLowerCase() === myUsername;
            const wordsSolved = isMe ? completedWordsCount : (p ? p.words_solved : 0);
            const totalWords = p && p.total_words > 0 ? p.total_words : (boardWords.length || 10);
            const item = createPlayerProgressItem(uname, wordsSolved, totalWords, isMe);
            matchPlayersProgress.appendChild(item);
        });
    }

    function createPlayerProgressItem(uname, wordsSolved, totalWords, isMe) {
        const wrap = document.createElement("div");
        wrap.className = `player-progress-item ${isMe ? "is-me" : ""}`;
        wrap.id = `progress-item-${uname.toLowerCase()}`;

        const percent = totalWords > 0 ? Math.min(100, Math.round((wordsSolved / totalWords) * 100)) : 0;

        wrap.innerHTML = `
            <div class="player-progress-name" title="${uname}">
                <span>${isMe ? "⭐" : "👤"}</span>
                <span>${isMe ? "Anda" : uname}</span>
            </div>
            <div class="player-progress-bar-wrap">
                <div class="player-progress-bar-fill" id="fill-${uname.toLowerCase()}" style="width: ${percent}%;"></div>
            </div>
            <span class="player-progress-score" id="score-text-${uname.toLowerCase()}">${wordsSolved}/${totalWords}</span>
        `;
        return wrap;
    }

    function updateOpponentProgress(uname, wordsSolved, totalWords) {
        const unameLower = uname.toLowerCase();
        const fillEl = document.getElementById(`fill-${unameLower}`);
        const scoreTextEl = document.getElementById(`score-text-${unameLower}`);

        const percent = totalWords > 0 ? Math.min(100, Math.round((wordsSolved / totalWords) * 100)) : 0;

        if (fillEl) {
            fillEl.style.width = `${percent}%`;
        }
        if (scoreTextEl) {
            scoreTextEl.textContent = `${wordsSolved}/${totalWords}`;
        }

        // Jika bar pemain belum terdaftar di DOM, re-render seluruh bar
        if (!fillEl && activeMatchRoom) {
            if (!activeMatchRoom.players) activeMatchRoom.players = {};
            activeMatchRoom.players[uname] = { username: uname, words_solved: wordsSolved, total_words: totalWords };
            renderMatchProgress(activeMatchRoom);
        }
    }

    // 2. Tampilkan Hasil Pertandingan (Kemenangan Juara)
    function showMatchOver(winner, message) {
        const myUsername = (getUser() ? getUser().username : "").toLowerCase();
        const isMeWinner = winner && winner.toLowerCase() === myUsername;

        if (matchOverTitle) {
            matchOverTitle.textContent = isMeWinner ? "🎉 KAMU JUARA PERTAMA!" : "⚔️ Pertandingan Selesai!";
            matchOverTitle.style.color = isMeWinner ? "#10b981" : "#f59e0b";
        }

        if (matchOverDesc) {
            matchOverDesc.innerHTML = isMeWinner
                ? `Selamat! Anda berhasil memecahkan seluruh kata di papan ini lebih cepat dari lawan!`
                : `Pemain <strong>${winner}</strong> berhasil menyelesaikan semua kata terlebih dahulu.`;
        }

        if (matchOverScoreboard && activeMatchRoom) {
            let playersHtml = `
                <table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Pemain</th>
                            <th>Status Akhir</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            const players = activeMatchRoom.players ? Object.keys(activeMatchRoom.players) : [winner];
            players.forEach((pName) => {
                const isWin = pName.toLowerCase() === (winner ? winner.toLowerCase() : "");
                playersHtml += `
                    <tr style="${isWin ? 'background: rgba(16, 185, 129, 0.15); font-weight: 700;' : ''}">
                        <td>${isWin ? '👑 ' : '👤 '}${pName}</td>
                        <td>${isWin ? '<strong style="color: #10b981;">Juara 1 🏆</strong>' : 'Selesai'}</td>
                    </tr>
                `;
            });

            playersHtml += `</tbody></table>`;
            matchOverScoreboard.innerHTML = playersHtml;
        }

        if (matchOverModal) {
            matchOverModal.classList.add("show");
        }

        if (isMeWinner) {
            launchCelebration();
        } else {
            playWrongSound();
        }
    }

    // 3. Render Daftar Pemain Online di Tab Duel
    function renderLobbyPlayers() {
        if (!lobbyPlayersList) return;
        lobbyPlayersList.innerHTML = "";

        const me = getUser();
        const myName = me ? me.username.toLowerCase() : "";
        const otherPlayers = onlinePlayers.filter((p) => p.toLowerCase() !== myName);

        if (otherPlayers.length === 0) {
            lobbyPlayersList.innerHTML = `
                <div class="no-targets-notice">
                    <p style="font-weight: 700; margin-bottom: 6px;">Belum ada pemain lain yang online</p>
                    <p style="font-size: 0.85rem;">Buka browser baru di mode Incognito atau ajak teman login untuk bertanding di papan yang sama!</p>
                </div>
            `;
            return;
        }

        otherPlayers.forEach((playerName) => {
            const row = document.createElement("div");
            row.className = "target-player-row";
            row.innerHTML = `
                <div class="target-player-name">
                    <span style="font-size: 1.3rem;">👤</span>
                    <span>${playerName}</span>
                    <span style="font-size: 0.72rem; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 2px 8px; border-radius: 9999px; font-weight: 700;">ONLINE</span>
                </div>
                <button class="btn-action btn-duel" style="font-size: 0.82rem; padding: 6px 14px;">
                    ⚔️ Tantang Duel
                </button>
            `;

            const challengeBtn = row.querySelector(".btn-duel");
            challengeBtn.addEventListener("click", () => {
                sendChallenge(playerName);
            });

            lobbyPlayersList.appendChild(row);
        });
    }

    function sendChallenge(targetUsername) {
        if (!tournamentWS || tournamentWS.readyState !== WebSocket.OPEN) {
            alert("Koneksi turnamen WebSocket terputus. Silakan muat ulang halaman.");
            return;
        }

        const currentBoardId = currentBoard ? currentBoard.id : "";
        tournamentWS.send(JSON.stringify({
            action: "challenge_player",
            target_user: targetUsername,
            board_id: currentBoardId
        }));

        showAttackToast("⏳", "Tantangan Dikirim", `Tantangan duel dikirim ke ${targetUsername}. Menunggu respon...`, 4);
        if (lobbyModal) {
            lobbyModal.classList.remove("show");
        }
    }

    // 4. Render Kamar Turnamen Mabar di Tab Kamar
    function renderLobbyRooms() {
        if (!lobbyRoomsList) return;
        lobbyRoomsList.innerHTML = "";

        if (!availableRooms || availableRooms.length === 0) {
            lobbyRoomsList.innerHTML = `
                <div class="no-targets-notice">
                    <p style="font-weight: 700; margin-bottom: 6px;">Belum ada kamar turnamen aktif</p>
                    <p style="font-size: 0.85rem;">Klik tombol "➕ Buat Kamar Mabar" di atas untuk membuat kamar mabar hingga 5 pemain di papan yang sama!</p>
                </div>
            `;
            return;
        }

        const myName = (getUser() ? getUser().username : "").toLowerCase();

        availableRooms.forEach((room) => {
            const row = document.createElement("div");
            row.className = "room-card-item";

            const playerCount = room.players ? Object.keys(room.players).length : 1;
            const isHost = room.host.toLowerCase() === myName;
            const isMember = room.players && room.players[getUser() ? getUser().username : ""];
            const isPlaying = room.status === "playing";

            let actionBtnHtml = "";
            if (isHost && !isPlaying) {
                actionBtnHtml = `<button class="btn-start-room">🔥 Mulai Tanding</button>`;
            } else if (isMember) {
                actionBtnHtml = `<span style="font-weight: 700; color: #10b981; font-size: 0.85rem;">Sudah Masuk ✅</span>`;
            } else if (!isPlaying && playerCount < room.max_players) {
                actionBtnHtml = `<button class="btn-join-room">Gabung (${playerCount}/${room.max_players})</button>`;
            } else {
                actionBtnHtml = `<span style="color: var(--text-muted); font-size: 0.85rem;">Penuh / Tanding</span>`;
            }

            row.innerHTML = `
                <div class="room-card-info">
                    <div class="room-card-name">${room.name}</div>
                    <div class="room-card-meta">
                        <span>👑 Host: <strong>${room.host}</strong></span>
                        <span>🧩 Papan: <strong>${room.board_id}</strong></span>
                        <span>👥 ${playerCount} / ${room.max_players} Pemain</span>
                        <span class="room-card-badge ${isPlaying ? 'room-status-playing' : 'room-status-waiting'}">
                            ${isPlaying ? 'Sedang Bertanding' : 'Menunggu...'}
                        </span>
                    </div>
                </div>
                <div>
                    ${actionBtnHtml}
                </div>
            `;

            const startBtn = row.querySelector(".btn-start-room");
            if (startBtn) {
                startBtn.addEventListener("click", () => {
                    if (tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                        tournamentWS.send(JSON.stringify({
                            action: "start_room_match",
                            room_id: room.id
                        }));
                    }
                });
            }

            const joinBtn = row.querySelector(".btn-join-room");
            if (joinBtn) {
                joinBtn.addEventListener("click", () => {
                    if (tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                        tournamentWS.send(JSON.stringify({
                            action: "join_room",
                            room_id: room.id
                        }));
                    }
                });
            }

            lobbyRoomsList.appendChild(row);
        });
    }

    // 5. Event Listeners untuk Lobby, Duel & Rooms
    if (openLobbyBtn) {
        openLobbyBtn.addEventListener("click", () => {
            fetchTournamentStatus();
            renderLobbyPlayers();
            renderLobbyRooms();
            if (lobbyModal) lobbyModal.classList.add("show");
        });
    }

    if (openPlayersBtn) {
        openPlayersBtn.addEventListener("click", () => {
            fetchTournamentStatus();
            renderLobbyPlayers();
            renderLobbyRooms();
            if (lobbyModal) lobbyModal.classList.add("show");
        });
    }

    if (closeLobbyBtn) {
        closeLobbyBtn.addEventListener("click", () => {
            if (lobbyModal) lobbyModal.classList.remove("show");
        });
    }

    if (lobbyModal) {
        lobbyModal.addEventListener("click", (e) => {
            if (e.target === lobbyModal) lobbyModal.classList.remove("show");
        });
    }

    if (refreshOnlineBtn) {
        refreshOnlineBtn.addEventListener("click", () => {
            fetchTournamentStatus();
        });
    }

    if (tabDuelBtn && tabRoomsBtn) {
        tabDuelBtn.addEventListener("click", () => {
            tabDuelBtn.classList.add("active");
            tabRoomsBtn.classList.remove("active");
            if (lobbyDuelPanel) lobbyDuelPanel.classList.remove("hidden");
            if (lobbyRoomsPanel) lobbyRoomsPanel.classList.add("hidden");
        });

        tabRoomsBtn.addEventListener("click", () => {
            tabRoomsBtn.classList.add("active");
            tabDuelBtn.classList.remove("active");
            if (lobbyRoomsPanel) lobbyRoomsPanel.classList.remove("hidden");
            if (lobbyDuelPanel) lobbyDuelPanel.classList.add("hidden");
            renderLobbyRooms();
        });
    }

    if (acceptChallengeBtn) {
        acceptChallengeBtn.addEventListener("click", () => {
            if (incomingChallenge && tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                tournamentWS.send(JSON.stringify({
                    action: "accept_challenge",
                    from_user: incomingChallenge.from_user,
                    board_id: incomingChallenge.board_id
                }));
            }
            if (challengeModal) challengeModal.classList.remove("show");
        });
    }

    if (rejectChallengeBtn) {
        rejectChallengeBtn.addEventListener("click", () => {
            if (incomingChallenge && tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                tournamentWS.send(JSON.stringify({
                    action: "reject_challenge",
                    from_user: incomingChallenge.from_user
                }));
            }
            if (challengeModal) challengeModal.classList.remove("show");
        });
    }

    if (challengeModal) {
        challengeModal.addEventListener("click", (e) => {
            if (e.target === challengeModal) challengeModal.classList.remove("show");
        });
    }

    if (openCreateRoomBtn) {
        openCreateRoomBtn.addEventListener("click", () => {
            if (createRoomModal) createRoomModal.classList.add("show");
        });
    }

    if (closeCreateRoomBtn) {
        closeCreateRoomBtn.addEventListener("click", () => {
            if (createRoomModal) createRoomModal.classList.remove("show");
        });
    }

    if (createRoomModal) {
        createRoomModal.addEventListener("click", (e) => {
            if (e.target === createRoomModal) createRoomModal.classList.remove("show");
        });
    }

    if (createRoomForm) {
        createRoomForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const name = roomNameInput ? roomNameInput.value.trim() : "";
            const cap = roomMaxPlayers ? parseInt(roomMaxPlayers.value, 10) : 5;
            const currentBoardId = currentBoard ? currentBoard.id : "";

            if (tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                tournamentWS.send(JSON.stringify({
                    action: "create_room",
                    room_name: name,
                    max_players: cap,
                    board_id: currentBoardId
                }));
            }

            if (createRoomModal) createRoomModal.classList.remove("show");
        });
    }

    if (leaveMatchBtn) {
        leaveMatchBtn.addEventListener("click", () => {
            if (confirm("Apakah Anda yakin ingin keluar dari pertandingan bersama ini?")) {
                if (tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                    tournamentWS.send(JSON.stringify({
                        action: "leave_room"
                    }));
                }
                activeMatchRoom = null;
                if (matchStatusBar) matchStatusBar.classList.add("hidden");
                loadNextBoard();
            }
        });
    }

    if (closeMatchOverBtn) {
        closeMatchOverBtn.addEventListener("click", () => {
            if (matchOverModal) matchOverModal.classList.remove("show");
            activeMatchRoom = null;
            if (matchStatusBar) matchStatusBar.classList.add("hidden");
        });
    }

    /* ==========================================================================
       Modal Profil & Statistik Pemain
       ========================================================================== */
    if (profileBtn) {
        profileBtn.addEventListener("click", async () => {
            await loadUserProfile();
            if (profileModal) {
                profileModal.classList.add("show");
            }
        });
    }

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener("click", () => {
            if (profileModal) profileModal.classList.remove("show");
        });
    }

    if (profileModal) {
        profileModal.addEventListener("click", (e) => {
            if (e.target === profileModal) profileModal.classList.remove("show");
        });
    }

    async function loadUserProfile() {
        try {
            const data = await apiFetch("/api/user/profile");
            const p = data.profile;
            if (!p) return;

            if (profileModalUsername) profileModalUsername.textContent = p.username;
            if (profileModalRole) {
                profileModalRole.textContent = p.is_admin ? "Administrator" : "Pemain";
                profileModalRole.style.color = p.is_admin ? "#fbbf24" : "var(--primary)";
            }
            if (profileStatScore) profileStatScore.textContent = p.score;
            if (profileStatRank) profileStatRank.textContent = `#${p.global_rank} dari ${p.total_players} Pemain`;
            if (profileStatBoards) profileStatBoards.textContent = `${p.boards_completed} Papan`;
            if (profileStatWords) profileStatWords.textContent = `${p.words_solved} Kata`;
            if (profileStatHints) profileStatHints.textContent = `${p.hints_used} Kali`;
            if (profileStatDate) profileStatDate.textContent = p.created_at || "-";
        } catch (err) {
            alert(`Gagal memuat profil: ${err.message}`);
        }
    }

    /* ==========================================================================
       Modal Papan Peringkat (Leaderboard Cepat)
       ========================================================================== */
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener("click", async () => {
            await loadLeaderboard();
            if (leaderboardModal) {
                leaderboardModal.classList.add("show");
            }
        });
    }

    if (closeLeaderboardBtn) {
        closeLeaderboardBtn.addEventListener("click", () => {
            if (leaderboardModal) {
                leaderboardModal.classList.remove("show");
            }
        });
    }

    if (leaderboardModal) {
        leaderboardModal.addEventListener("click", (e) => {
            if (e.target === leaderboardModal) {
                leaderboardModal.classList.remove("show");
            }
        });
    }

    async function loadLeaderboard() {
        if (!leaderboardBody) return;
        leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">Memuat peringkat turnamen...</td></tr>';

        try {
            const data = await apiFetch("/api/leaderboard");
            const list = data.leaderboard || [];

            if (list.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">Belum ada data pemain.</td></tr>';
                return;
            }

            const currentUser = getUser();
            leaderboardBody.innerHTML = "";

            list.forEach((entry, idx) => {
                const tr = document.createElement("tr");
                const isCurrent = currentUser && currentUser.username.toLowerCase() === entry.username.toLowerCase();

                let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
                if (idx === 0) rankBadge = `<span class="rank-badge rank-top">🥇</span>`;
                else if (idx === 1) rankBadge = `<span class="rank-badge rank-top">🥈</span>`;
                else if (idx === 2) rankBadge = `<span class="rank-badge rank-top">🥉</span>`;

                tr.innerHTML = `
                    <td>${rankBadge}</td>
                    <td class="${isCurrent ? "user-highlight" : ""}">${entry.username} ${isCurrent ? "(Anda)" : ""}</td>
                    <td style="text-align: center;">${entry.words_solved || 0}</td>
                    <td style="text-align: center;">${entry.boards_completed || 0}</td>
                    <td style="text-align: right;" class="score-col">${entry.score || 0}</td>
                `;
                leaderboardBody.appendChild(tr);
            });
        } catch (err) {
            leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#f87171; padding: 20px;">Gagal memuat: ${err.message}</td></tr>`;
        }
    }

    /* ==========================================================================
       Animasi Perayaan (Canvas Confetti Fireworks)
       ========================================================================== */
    function launchCelebration() {
        playVictoryFanfare();

        if (typeof confetti === "function") {
            confetti({
                particleCount: 130,
                spread: 85,
                origin: { y: 0.6 }
            });

            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    angle: 60,
                    spread: 65,
                    origin: { x: 0, y: 0.7 }
                });
                confetti({
                    particleCount: 80,
                    angle: 120,
                    spread: 65,
                    origin: { x: 1, y: 0.7 }
                });
            }, 280);

            setTimeout(() => {
                confetti({
                    particleCount: 110,
                    spread: 100,
                    origin: { y: 0.45 }
                });
            }, 650);
        }
    }

    /* ==========================================================================
       Logika Papan & Permainan
       ========================================================================== */
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            if (confirm("Apakah Anda yakin ingin keluar?")) {
                logout();
            }
        });
    }

    const savedMode = localStorage.getItem("tts_play_mode");
    if (savedMode && modeSelect) {
        modeSelect.value = savedMode;
    }

    if (modeSelect) {
        modeSelect.addEventListener("change", () => {
            localStorage.setItem("tts_play_mode", modeSelect.value);
        });
    }

    if (nextBoardBtn) {
        nextBoardBtn.addEventListener("click", () => {
            if (activeMatchRoom) {
                alert("Anda sedang berada dalam pertandingan bersama! Selesaikan papan ini bersama lawan atau klik tombol 'Keluar Match' di bilah atas.");
                return;
            }
            loadNextBoard();
        });
    }

    if (hintBtn) {
        hintBtn.addEventListener("click", () => {
            useHint();
        });
    }

    if (modalNextBtn) {
        modalNextBtn.addEventListener("click", () => {
            victoryModal.classList.remove("show");
            loadNextBoard();
        });
    }

    function isHorizontal(dir) {
        if (!dir) return true;
        const d = dir.toString().trim().toUpperCase();
        return d.includes("MENDATAR") || d.startsWith("H") || d.startsWith("A");
    }

    async function loadBoard(boardId = null) {
        try {
            boardEl.innerHTML = '<div class="spinner"></div>';
            acrossCluesList.innerHTML = "";
            downCluesList.innerHTML = "";
            boardPill.textContent = "Memuat...";

            let url = "/api/boards/random";
            if (boardId) {
                url = `/api/boards/${boardId}`;
            } else if (modeSelect && modeSelect.value === "urut") {
                url = "/api/boards/P01";
            }

            const data = await apiFetch(url);
            setupBoard(data);
        } catch (err) {
            boardEl.innerHTML = `
                <div style="text-align: center; color: #f87171; padding: 30px;">
                    <p style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">Gagal memuat papan</p>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">${err.message}</p>
                    <button class="btn-action btn-next" onclick="location.reload()" style="margin-top: 16px;">Coba Lagi</button>
                </div>
            `;
        }
    }

    function loadNextBoard() {
        const mode = modeSelect ? modeSelect.value : "urut";
        if (mode === "urut" && currentBoard && currentBoard.id) {
            const match = currentBoard.id.match(/\d+/);
            if (match) {
                const nextNum = parseInt(match[0], 10) + 1;
                const nextId = `P${nextNum.toString().padStart(2, "0")}`;
                loadBoard(nextId);
                return;
            }
        }
        loadBoard(null);
    }

    function setupBoard(boardData) {
        currentBoard = boardData;
        boardWords = (boardData.words || []).map((w, idx) => {
            const isH = isHorizontal(w.direction);
            const ans = (w.question && w.question.answer ? w.question.answer : "").toUpperCase().trim();
            return {
                ...w,
                index: idx,
                isAcross: isH,
                directionType: isH ? "HORIZONTAL" : "VERTICAL",
                answer: ans,
                length: w.length || ans.length,
                item: w.item || null, // Item turnamen ("bomb" atau "freeze")
                itemClaimed: false,
                isCompleted: false
            };
        });

        // Urutkan nomor soal
        boardWords.sort((a, b) => a.clue_no - b.clue_no);
        boardWords.forEach((w, idx) => {
            w.index = idx;
        });

        completedWordsCount = 0;
        updateProgress();

        if (boardPill) {
            boardPill.textContent = `Papan: ${boardData.id} • ${boardData.grid_width}x${boardData.grid_height}`;
        }
        if (clueCountBadge) {
            clueCountBadge.textContent = `${boardWords.length} Soal`;
        }

        let minRow = 999;
        let minCol = 999;
        boardWords.forEach((w) => {
            if (w.start_row < minRow) minRow = w.start_row;
            if (w.start_col < minCol) minCol = w.start_col;
        });

        const offsetRow = minRow > 0 ? minRow - 1 : 0;
        const offsetCol = minCol > 0 ? minCol - 1 : 0;

        const H = boardData.grid_height;
        const W = boardData.grid_width;

        gridMatrix = Array.from({ length: H }, () =>
            Array.from({ length: W }, () => ({
                isBlocked: true,
                cellNumber: null,
                correctLetter: "",
                currentLetter: "",
                isLocked: false,
                words: []
            }))
        );

        boardWords.forEach((w) => {
            const startR = w.start_row - offsetRow;
            const startC = w.start_col - offsetCol;
            const wordLen = w.length;

            if (startR >= 0 && startR < H && startC >= 0 && startC < W) {
                if (!gridMatrix[startR][startC].cellNumber) {
                    gridMatrix[startR][startC].cellNumber = w.clue_no;
                }
            }

            for (let i = 0; i < wordLen; i++) {
                const r = w.isAcross ? startR : startR + i;
                const c = w.isAcross ? startC + i : startC;

                if (r >= 0 && r < H && c >= 0 && c < W) {
                    const cell = gridMatrix[r][c];
                    cell.isBlocked = false;
                    if (!cell.words.includes(w.index)) {
                        cell.words.push(w.index);
                    }

                    if (i < w.answer.length) {
                        cell.correctLetter = w.answer[i];
                    }

                    if (w.reveal_letter && (w.reveal_row - offsetRow === r) && (w.reveal_col - offsetCol === c)) {
                        cell.currentLetter = w.reveal_letter.toUpperCase();
                    }
                }
            }
        });

        renderGrid(H, W);
        renderClues();

        if (boardWords.length > 0) {
            focusWord(0);
        }
    }

    function renderGrid(height, width) {
        boardEl.innerHTML = "";
        boardEl.style.gridTemplateColumns = `repeat(${width}, var(--cell-size))`;
        boardEl.style.gridTemplateRows = `repeat(${height}, var(--cell-size))`;

        for (let r = 0; r < height; r++) {
            for (let c = 0; c < width; c++) {
                const cellData = gridMatrix[r][c];
                const cellDiv = document.createElement("div");
                cellDiv.className = `board-cell ${cellData.isBlocked ? "cell-blocked" : "cell-active"}`;
                cellDiv.dataset.row = r;
                cellDiv.dataset.col = c;

                if (!cellData.isBlocked) {
                    if (cellData.cellNumber) {
                        const numSpan = document.createElement("span");
                        numSpan.className = "cell-num";
                        numSpan.textContent = cellData.cellNumber;
                        cellDiv.appendChild(numSpan);
                    }

                    const input = document.createElement("input");
                    input.type = "text";
                    input.maxLength = 1;
                    input.value = cellData.currentLetter;
                    input.dataset.row = r;
                    input.dataset.col = c;
                    input.autocomplete = "off";
                    input.spellcheck = false;

                    input.addEventListener("click", () => {
                        handleCellClick(r, c);
                    });

                    input.addEventListener("keydown", (e) => {
                        handleKeyDown(e, r, c);
                    });

                    input.addEventListener("input", (e) => {
                        handleInput(e, r, c);
                    });

                    cellDiv.appendChild(input);
                }

                boardEl.appendChild(cellDiv);
            }
        }
    }

    function renderClues() {
        acrossCluesList.innerHTML = "";
        downCluesList.innerHTML = "";

        const acrossWords = boardWords.filter((w) => w.isAcross);
        const downWords = boardWords.filter((w) => !w.isAcross);

        function createClueItem(w) {
            const li = document.createElement("li");
            li.className = "clue-item";
            li.id = `clue-${w.index}`;
            li.dataset.wordIndex = w.index;

            const clueNo = document.createElement("span");
            clueNo.className = "clue-no";
            clueNo.textContent = w.clue_no;

            const contentDiv = document.createElement("div");
            contentDiv.className = "clue-content";

            // Baris teks clue + ikon item amunisi (jika ada)
            const textLine = document.createElement("div");
            textLine.style.display = "flex";
            textLine.style.alignItems = "center";
            textLine.style.justifyContent = "space-between";
            textLine.style.gap = "8px";

            const clueText = document.createElement("span");
            clueText.className = "clue-text";
            clueText.textContent = w.question ? w.question.clue : "Soal tidak tersedia";
            textLine.appendChild(clueText);

            // Sisipkan ikon item amunisi (Bom 💣 atau Freeze ❄️) di sebelah soal
            if (w.item) {
                const itemIcon = document.createElement("span");
                itemIcon.className = "clue-item-icon";
                if (w.item === "bomb") {
                    itemIcon.textContent = "💣";
                    itemIcon.title = "Soal ini berhadiah Bom 💣!";
                } else if (w.item === "freeze") {
                    itemIcon.textContent = "❄️";
                    itemIcon.title = "Soal ini berhadiah Freeze ❄️!";
                }
                textLine.appendChild(itemIcon);
            }

            const clueMeta = document.createElement("span");
            clueMeta.className = "clue-meta";
            clueMeta.textContent = `(${w.length} Huruf${w.question && w.question.category ? ` • ${w.question.category}` : ""})`;

            contentDiv.appendChild(textLine);
            contentDiv.appendChild(clueMeta);

            li.appendChild(clueNo);
            li.appendChild(contentDiv);

            li.addEventListener("click", () => {
                focusWord(w.index);
            });

            return li;
        }

        acrossWords.forEach((w) => acrossCluesList.appendChild(createClueItem(w)));
        downWords.forEach((w) => downCluesList.appendChild(createClueItem(w)));
    }

    function handleCellClick(r, c) {
        if (isAttackedFrozen) return;

        const cell = gridMatrix[r][c];
        if (!cell || cell.isBlocked) return;

        if (activeCell.row === r && activeCell.col === c) {
            if (cell.words.length > 1) {
                activeDirection = activeDirection === "HORIZONTAL" ? "VERTICAL" : "HORIZONTAL";
            }
        } else {
            activeCell.row = r;
            activeCell.col = c;

            if (cell.words.length > 0) {
                const hasCurrentDirection = cell.words.some((wIdx) => boardWords[wIdx].directionType === activeDirection);
                if (!hasCurrentDirection) {
                    activeDirection = boardWords[cell.words[0]].directionType;
                }
            }
        }

        updateHighlights();
    }

    function focusWord(wordIndex) {
        const w = boardWords[wordIndex];
        if (!w) return;

        activeDirection = w.directionType;

        let targetR = -1;
        let targetC = -1;

        for (let r = 0; r < gridMatrix.length; r++) {
            for (let c = 0; c < gridMatrix[r].length; c++) {
                if (gridMatrix[r][c].words.includes(wordIndex)) {
                    targetR = r;
                    targetC = c;
                    break;
                }
            }
            if (targetR !== -1) break;
        }

        if (targetR !== -1 && targetC !== -1) {
            activeCell.row = targetR;
            activeCell.col = targetC;

            const input = getCellInput(targetR, targetC);
            if (input && !isAttackedFrozen) {
                input.focus();
                input.select();
            }

            updateHighlights();
        }
    }

    function updateHighlights() {
        document.querySelectorAll(".board-cell").forEach((el) => {
            el.classList.remove("cell-focused", "cell-word-highlight");
        });
        document.querySelectorAll(".clue-item").forEach((el) => {
            el.classList.remove("active-clue");
        });

        if (activeCell.row === -1 || activeCell.col === -1) return;

        const cell = gridMatrix[activeCell.row][activeCell.col];
        if (!cell || cell.isBlocked) return;

        const activeCellEl = getCellElement(activeCell.row, activeCell.col);
        if (activeCellEl) {
            activeCellEl.classList.add("cell-focused");
        }

        let activeWord = null;
        for (const wIdx of cell.words) {
            const w = boardWords[wIdx];
            if (w.directionType === activeDirection) {
                activeWord = w;
                break;
            }
        }
        if (!activeWord && cell.words.length > 0) {
            activeWord = boardWords[cell.words[0]];
            activeDirection = activeWord.directionType;
        }

        if (activeWord) {
            for (let r = 0; r < gridMatrix.length; r++) {
                for (let c = 0; c < gridMatrix[r].length; c++) {
                    if (gridMatrix[r][c].words.includes(activeWord.index)) {
                        const el = getCellElement(r, c);
                        if (el && !el.classList.contains("cell-focused")) {
                            el.classList.add("cell-word-highlight");
                        }
                    }
                }
            }

            const clueEl = document.getElementById(`clue-${activeWord.index}`);
            if (clueEl) {
                clueEl.classList.add("active-clue");
                clueEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        }
    }

    function handleKeyDown(e, r, c) {
        // Blokir input jika sedang dalam efek serangan Freeze
        if (isAttackedFrozen) {
            e.preventDefault();
            return;
        }

        if (e.key === "Backspace") {
            e.preventDefault();
            const cell = gridMatrix[r][c];
            const input = getCellInput(r, c);

            if (!cell.isLocked) {
                if (input && input.value !== "") {
                    input.value = "";
                    cell.currentLetter = "";
                } else {
                    moveToPrevCell(r, c);
                }
            } else {
                moveToPrevCell(r, c);
            }
            return;
        }

        if (e.key === "ArrowRight") {
            e.preventDefault();
            moveCursor(r, c + 1);
            return;
        }
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            moveCursor(r, c - 1);
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            moveCursor(r + 1, c);
            return;
        }
        if (e.key === "ArrowUp") {
            e.preventDefault();
            moveCursor(r - 1, c);
            return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
            e.preventDefault();
            cycleToNextWord();
            return;
        }
    }

    function handleInput(e, r, c) {
        // Blokir input jika sedang dalam efek serangan Freeze
        if (isAttackedFrozen) {
            e.preventDefault();
            return;
        }

        const input = e.target;
        const val = input.value.trim().toUpperCase();

        if (val.length > 0) {
            const letter = val.slice(-1);
            input.value = letter;
            gridMatrix[r][c].currentLetter = letter;

            const cell = gridMatrix[r][c];
            const cellEl = getCellElement(r, c);

            // Validasi huruf dengan kunci jawaban
            if (cell.correctLetter && letter !== cell.correctLetter) {
                playWrongSound();
                if (cellEl) {
                    cellEl.classList.remove("cell-wrong");
                    void cellEl.offsetWidth;
                    cellEl.classList.add("cell-wrong");
                    setTimeout(() => {
                        cellEl.classList.remove("cell-wrong");
                    }, 400);
                }
            } else {
                playTypeSound();
                if (cellEl) {
                    cellEl.classList.remove("pop-animation");
                    void cellEl.offsetWidth;
                    cellEl.classList.add("pop-animation");
                }
            }

            checkWordsAtCell(r, c);
            moveToNextCell(r, c);
        } else {
            gridMatrix[r][c].currentLetter = "";
        }
    }

    function moveCursor(targetR, targetC) {
        if (targetR >= 0 && targetR < gridMatrix.length && targetC >= 0 && targetC < gridMatrix[0].length) {
            if (!gridMatrix[targetR][targetC].isBlocked) {
                activeCell.row = targetR;
                activeCell.col = targetC;
                const input = getCellInput(targetR, targetC);
                if (input && !isAttackedFrozen) {
                    input.focus();
                    input.select();
                }
                updateHighlights();
            }
        }
    }

    function moveToNextCell(r, c) {
        const nextR = activeDirection === "VERTICAL" ? r + 1 : r;
        const nextC = activeDirection === "HORIZONTAL" ? c + 1 : c;

        if (nextR < gridMatrix.length && nextC < gridMatrix[0].length && !gridMatrix[nextR][nextC].isBlocked) {
            moveCursor(nextR, nextC);
        }
    }

    function moveToPrevCell(r, c) {
        const prevR = activeDirection === "VERTICAL" ? r - 1 : r;
        const prevC = activeDirection === "HORIZONTAL" ? c - 1 : c;

        if (prevR >= 0 && prevC >= 0 && !gridMatrix[prevR][prevC].isBlocked) {
            const input = getCellInput(prevR, prevC);
            if (input && !gridMatrix[prevR][prevC].isLocked) {
                input.value = "";
                gridMatrix[prevR][prevC].currentLetter = "";
            }
            moveCursor(prevR, prevC);
        }
    }

    function cycleToNextWord() {
        const cell = gridMatrix[activeCell.row][activeCell.col];
        if (!cell || cell.words.length === 0) return;

        let curWIdx = cell.words[0];
        const nextIdx = (curWIdx + 1) % boardWords.length;
        focusWord(nextIdx);
    }

    function checkWordsAtCell(r, c) {
        const cell = gridMatrix[r][c];
        if (!cell) return;

        cell.words.forEach((wIdx) => {
            const w = boardWords[wIdx];
            if (!w || w.isCompleted) return;

            const wordCells = [];
            for (let rIdx = 0; rIdx < gridMatrix.length; rIdx++) {
                for (let cIdx = 0; cIdx < gridMatrix[rIdx].length; cIdx++) {
                    if (gridMatrix[rIdx][cIdx].words.includes(wIdx)) {
                        wordCells.push({ r: rIdx, c: cIdx, data: gridMatrix[rIdx][cIdx] });
                    }
                }
            }

            if (w.isAcross) {
                wordCells.sort((a, b) => a.c - b.c);
            } else {
                wordCells.sort((a, b) => a.r - b.r);
            }

            const currentAnswer = wordCells.map((item) => item.data.currentLetter).join("");

            if (currentAnswer.toUpperCase() === w.answer.toUpperCase()) {
                w.isCompleted = true;
                completedWordsCount++;
                updateProgress();

                // Efek Suara Kata Berhasil
                playWordSuccessSound();

                // Cek Hadiah Item Turnamen (Bom 💣 atau Freeze ❄️)
                if (w.item && !w.itemClaimed) {
                    w.itemClaimed = true;
                    claimTournamentItem(w.item);
                }

                wordCells.forEach((item) => {
                    item.data.isLocked = true;
                    const el = getCellElement(item.r, item.c);
                    if (el) {
                        el.classList.add("cell-correct");
                    }
                });

                const clueEl = document.getElementById(`clue-${w.index}`);
                if (clueEl) {
                    clueEl.classList.add("completed-clue");
                }

                // Kirim aksi kata benar ke backend (Otomatis +10 poin divalidasi server)
                const firstCellEl = getCellElement(wordCells[0].r, wordCells[0].c);
                sendScoreAction("word_correct", firstCellEl);

                // Kirim update progres ke anggota match turnamen
                if (activeMatchRoom && tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                    tournamentWS.send(JSON.stringify({
                        action: "progress_update",
                        words_solved: completedWordsCount,
                        total_words: boardWords.length
                    }));
                    const myUname = getUser() ? getUser().username : "Anda";
                    updateOpponentProgress(myUname, completedWordsCount, boardWords.length);
                }

                // Jika seluruh kata pada papan berhasil diselesaikan
                if (completedWordsCount === boardWords.length) {
                    completedBoardsCount++;
                    sendScoreAction("board_completed", null);

                    // Beritahu server bahwa kita menyelesaikan papan lebih dulu
                    if (activeMatchRoom && tournamentWS && tournamentWS.readyState === WebSocket.OPEN) {
                        tournamentWS.send(JSON.stringify({
                            action: "match_finished"
                        }));
                    }

                    setTimeout(() => {
                        showVictory();
                    }, 500);
                }
            }
        });
    }

    function updateProgress() {
        if (progressText) {
            progressText.textContent = `${completedWordsCount} / ${boardWords.length} Kata Selesai`;
        }
    }

    function useHint() {
        if (boardWords.length === 0 || isAttackedFrozen) return;

        let targetCell = null;
        const cell = gridMatrix[activeCell.row] && gridMatrix[activeCell.row][activeCell.col];

        if (cell && cell.words.length > 0) {
            const w = boardWords[cell.words[0]];
            if (w && !w.isCompleted) {
                for (let r = 0; r < gridMatrix.length; r++) {
                    for (let c = 0; c < gridMatrix[r].length; c++) {
                        const cd = gridMatrix[r][c];
                        if (cd.words.includes(w.index) && cd.currentLetter !== cd.correctLetter) {
                            targetCell = { r, c, cd };
                            break;
                        }
                    }
                    if (targetCell) break;
                }
            }
        }

        if (!targetCell) {
            for (let r = 0; r < gridMatrix.length; r++) {
                for (let c = 0; c < gridMatrix[r].length; c++) {
                    const cd = gridMatrix[r][c];
                    if (!cd.isBlocked && cd.currentLetter !== cd.correctLetter) {
                        targetCell = { r, c, cd };
                        break;
                    }
                }
                if (targetCell) break;
            }
        }

        if (targetCell) {
            const { r, c, cd } = targetCell;
            cd.currentLetter = cd.correctLetter;

            const input = getCellInput(r, c);
            if (input) {
                input.value = cd.correctLetter;
            }

            playHintSound();

            const el = getCellElement(r, c);
            if (el) {
                el.classList.remove("pop-animation");
                void el.offsetWidth;
                el.classList.add("pop-animation");
            }

            // Kirim aksi hint ke backend (Otomatis -10 poin divalidasi server)
            sendScoreAction("hint_used", hintBtn);
            checkWordsAtCell(r, c);
        } else {
            alert("Semua huruf sudah terisi dengan benar!");
        }
    }

    function showVictory() {
        if (modalBoardId) {
            modalBoardId.textContent = currentBoard ? currentBoard.id : "-";
        }
        if (modalTotalScore) {
            modalTotalScore.textContent = currentScore;
        }
        if (victoryModal) {
            victoryModal.classList.add("show");
        }

        launchCelebration();
    }

    function getCellElement(r, c) {
        return boardEl.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`);
    }

    function getCellInput(r, c) {
        return boardEl.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
    }

    // Inisialisasi Sinkronisasi, Papan Awal & WebSocket Turnamen
    syncUserData();
    loadBoard();
    initTournamentWebSocket();

    if (localStorage.getItem("tts_bgm_state") === "on") {
        document.addEventListener("click", function initAudioOnGesture() {
            startAmbientBgm();
            document.removeEventListener("click", initAudioOnGesture);
        }, { once: true });
    }
});
