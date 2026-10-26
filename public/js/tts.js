/**
 * tts.js - Logika Interaktif Papan TTS ID
 * Fitur:
 * - Keamanan Skor Backend: Aksi 'word_correct', 'hint_used', 'board_completed' divalidasi langsung di database Supabase
 * - Profil & Statistik Pemain (Peringkat Global, Kata Terpecahkan, Papan Selesai)
 * - Leaderboard Real-Time dengan Top Medali 🥇 🥈 🥉
 * - Audio Engine (Ketik, Chime Benar, Buzzer Salah & Shake Merah, Fanfare, BGM)
 * - Kembang Api Konfeti Kemenangan (canvas-confetti)
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

    // Elemen DOM Utama
    const boardEl = document.getElementById("tts-board");
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

    // Tombol Musik Latar
    const bgmToggleBtn = document.getElementById("bgm-toggle-btn");

    // Tombol & State Mode Tema (Gelap / Terang)
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
        if (themeIcon) {
            themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
        }
        if (themeText) {
            themeText.textContent = theme === "dark" ? "Gelap" : "Terang";
        }
        if (themeToggleBtn) {
            themeToggleBtn.title = theme === "dark" ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)";
        }
    }

    initTheme();

    /* ==========================================================================
       Web Audio API Sound Engine (Bebas Ketergantungan File Eksternal)
       ========================================================================== */
    let audioCtx = null;
    let bgmOscillators = [];
    let bgmGainNode = null;
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

    // Suara Kesalahan / Huruf Salah (Soft Buzzer / Error Thud)
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

    // Suara Penggunaan Bantuan / Hint
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

    // Suara Fanfare Kemenangan
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

                osc.type = "sine";
                osc.frequency.setValueAtTime(note.f, ctx.currentTime + timeOffset);

                gain.gain.setValueAtTime(0.2, ctx.currentTime + timeOffset);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + note.d);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(ctx.currentTime + timeOffset);
                osc.stop(ctx.currentTime + timeOffset + note.d + 0.05);

                timeOffset += note.d + 0.03;
            });
        } catch {}
    }

    // Generator Musik Latar Santai (Ambient Chill Synthesizer)
    function startAmbientBgm() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            stopAmbientBgm();

            bgmGainNode = ctx.createGain();
            bgmGainNode.gain.setValueAtTime(0.035, ctx.currentTime);

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(380, ctx.currentTime);

            bgmGainNode.connect(filter);
            filter.connect(ctx.destination);

            const freqs = [130.81, 196.00, 261.63, 329.63];
            freqs.forEach((freq) => {
                const osc = ctx.createOscillator();
                osc.type = "triangle";
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                osc.connect(bgmGainNode);
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
       Keamanan Skor Backend & Sinkronisasi Database
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

                if (res.user.is_admin && adminNavBtn) {
                    adminNavBtn.classList.remove("hidden");
                }
            }
        } catch {}
    }

    /**
     * sendScoreAction: Mengirim aksi skor ke backend untuk divalidasi dan disimpan langsung di Supabase
     */
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
       Modal Papan Peringkat (Leaderboard)
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
        leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-dim);">Memuat peringkat...</td></tr>';

        try {
            const data = await apiFetch("/api/leaderboard");
            const list = data.leaderboard || [];

            if (list.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-dim);">Belum ada data pemain.</td></tr>';
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
                    <p style="font-size: 0.9rem; color: var(--text-dim);">${err.message}</p>
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

        const offsetRow = minRow >= 1 ? 1 : 0;
        const offsetCol = minCol >= 1 ? 1 : 0;

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

            const clueText = document.createElement("span");
            clueText.className = "clue-text";
            clueText.textContent = w.question ? w.question.clue : "Soal tidak tersedia";

            const clueMeta = document.createElement("span");
            clueMeta.className = "clue-meta";
            clueMeta.textContent = `(${w.length} Huruf${w.question && w.question.category ? ` • ${w.question.category}` : ""})`;

            contentDiv.appendChild(clueText);
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
            if (input) {
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
                if (input) {
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

                // Jika seluruh kata pada papan berhasil diselesaikan
                if (completedWordsCount === boardWords.length) {
                    completedBoardsCount++;
                    sendScoreAction("board_completed", null);
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
        if (boardWords.length === 0) return;

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

    // Inisialisasi Sinkronisasi & Papan Awal
    syncUserData();
    loadBoard();

    if (localStorage.getItem("tts_bgm_state") === "on") {
        document.addEventListener("click", function initAudioOnGesture() {
            startAmbientBgm();
            document.removeEventListener("click", initAudioOnGesture);
        }, { once: true });
    }
});
