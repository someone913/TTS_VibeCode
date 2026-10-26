/**
 * admin.js - Logika Dashboard Administrator TTS ID
 */

document.addEventListener("DOMContentLoaded", async () => {
    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const adminUsername = document.getElementById("admin-username");
    const adminLogoutBtn = document.getElementById("admin-logout-btn");
    const statTotalBoards = document.getElementById("stat-total-boards");
    const statActiveBoards = document.getElementById("stat-active-boards");
    const boardsBody = document.getElementById("admin-boards-body");
    const boardSearch = document.getElementById("board-search");
    const addBoardBtn = document.getElementById("add-board-btn");
    const refreshBoardsBtn = document.getElementById("refresh-boards-btn");
    const adminAlert = document.getElementById("admin-alert");

    // Modal Form
    const boardFormModal = document.getElementById("board-form-modal");
    const closeFormBtn = document.getElementById("close-form-btn");
    const formCancelBtn = document.getElementById("form-cancel-btn");
    const boardCrudForm = document.getElementById("board-crud-form");
    const modalFormTitle = document.getElementById("modal-form-title");
    const formBoardId = document.getElementById("form-board-id");
    const formGridHeight = document.getElementById("form-grid-height");
    const formGridWidth = document.getElementById("form-grid-width");
    const formTotalWords = document.getElementById("form-total-words");
    const formActive = document.getElementById("form-active");
    const formIsEdit = document.getElementById("form-is-edit");

    let allBoards = [];

    // 1. Verifikasi Status Administrator
    try {
        const meRes = await apiFetch("/api/auth/me");
        if (meRes && meRes.user) {
            if (adminUsername) adminUsername.textContent = meRes.user.username;

            if (!meRes.user.is_admin) {
                // Beri opsi aktivasi hak admin langsung untuk pengujian
                const confirmAdmin = confirm("Akun Anda belum memiliki akses Administrator. Apakah Anda ingin mengaktifkan mode Administrator untuk akun ini sekarang?");
                if (confirmAdmin) {
                    await apiFetch("/api/user/make-admin", { method: "POST" });
                    alert("Status Administrator berhasil diaktifkan!");
                } else {
                    alert("Akses ditolak: Anda bukan Administrator.");
                    window.location.href = "/";
                    return;
                }
            }
        }
    } catch (err) {
        window.location.href = "/login";
        return;
    }

    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener("click", () => {
            if (confirm("Keluar dari panel admin?")) logout();
        });
    }

    // Pengaturan Tema di Admin
    const adminThemeBtn = document.getElementById("admin-theme-btn");
    const adminThemeIcon = document.getElementById("admin-theme-icon");
    const adminThemeText = document.getElementById("admin-theme-text");

    function applyAdminTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("tts_theme", theme);
        if (adminThemeIcon) adminThemeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
        if (adminThemeText) adminThemeText.textContent = theme === "dark" ? "Gelap" : "Terang";
    }

    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    applyAdminTheme(currentTheme);

    if (adminThemeBtn) {
        adminThemeBtn.addEventListener("click", () => {
            const cur = document.documentElement.getAttribute("data-theme") || "dark";
            const next = cur === "dark" ? "light" : "dark";
            applyAdminTheme(next);
        });
    }

    function showAlert(msg, isError = false) {
        if (!adminAlert) return;
        adminAlert.textContent = msg;
        adminAlert.className = `alert ${isError ? "alert-error" : "alert-success"}`;
        adminAlert.classList.remove("hidden");
        setTimeout(() => {
            adminAlert.classList.add("hidden");
        }, 3500);
    }

    // 2. Muat Seluruh Papan
    async function loadBoards() {
        boardsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;"><div class="spinner"></div></td></tr>';

        try {
            const data = await apiFetch("/api/admin/boards");
            allBoards = data.boards || [];
            updateStats();
            renderTable(allBoards);
        } catch (err) {
            boardsBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 24px;">Gagal memuat papan: ${err.message}</td></tr>`;
        }
    }

    function updateStats() {
        if (statTotalBoards) statTotalBoards.textContent = allBoards.length;
        if (statActiveBoards) {
            const activeCount = allBoards.filter((b) => b.active).length;
            statActiveBoards.textContent = activeCount;
        }
    }

    function renderTable(boards) {
        if (boards.length === 0) {
            boardsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 24px;">Tidak ada papan ditemukan.</td></tr>';
            return;
        }

        boardsBody.innerHTML = "";
        boards.forEach((b) => {
            const tr = document.createElement("tr");

            const activePill = b.active
                ? '<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">Aktif</span>'
                : '<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; padding: 3px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">Nonaktif</span>';

            const wordCount = b.words ? b.words.length : (b.total_words || 0);

            tr.innerHTML = `
                <td style="font-weight: 800; color: var(--primary); font-family: 'JetBrains Mono', monospace;">${b.id}</td>
                <td>${b.grid_height} Baris</td>
                <td>${b.grid_width} Kolom</td>
                <td>${wordCount} Soal</td>
                <td style="text-align: center;">${activePill}</td>
                <td style="text-align: right;">
                    <button class="btn-action btn-next edit-btn" data-id="${b.id}" style="padding: 5px 12px; font-size: 0.8rem; margin-right: 6px;">✏️ Edit</button>
                    <button class="btn-action delete-btn" data-id="${b.id}" style="padding: 5px 12px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.3);">🗑️ Hapus</button>
                </td>
            `;

            // Event Edit
            tr.querySelector(".edit-btn").addEventListener("click", () => {
                openEditModal(b);
            });

            // Event Hapus
            tr.querySelector(".delete-btn").addEventListener("click", async () => {
                if (confirm(`Apakah Anda yakin ingin menghapus papan "${b.id}" beserta seluruh relasi soalnya?`)) {
                    try {
                        await apiFetch(`/api/admin/boards/${b.id}`, { method: "DELETE" });
                        showAlert(`Papan ${b.id} berhasil dihapus.`);
                        loadBoards();
                    } catch (err) {
                        showAlert(err.message, true);
                    }
                }
            });

            boardsBody.appendChild(tr);
        });
    }

    // 3. Filter Pencarian Papan
    if (boardSearch) {
        boardSearch.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            const filtered = allBoards.filter((b) => b.id.toLowerCase().includes(query));
            renderTable(filtered);
        });
    }

    if (refreshBoardsBtn) {
        refreshBoardsBtn.addEventListener("click", () => {
            loadBoards();
        });
    }

    // 4. Modal Tambah & Edit
    function openAddModal() {
        modalFormTitle.textContent = "Tambah Papan Baru";
        formIsEdit.value = "false";
        formBoardId.value = "";
        formBoardId.disabled = false;
        formGridHeight.value = "12";
        formGridWidth.value = "9";
        formTotalWords.value = "10";
        formActive.checked = true;
        boardFormModal.classList.add("show");
    }

    function openEditModal(board) {
        modalFormTitle.textContent = `Edit Papan: ${board.id}`;
        formIsEdit.value = "true";
        formBoardId.value = board.id;
        formBoardId.disabled = true; // Primary key tidak diubah saat edit
        formGridHeight.value = board.grid_height;
        formGridWidth.value = board.grid_width;
        formTotalWords.value = board.total_words || (board.words ? board.words.length : 10);
        formActive.checked = board.active;
        boardFormModal.classList.add("show");
    }

    function closeModal() {
        boardFormModal.classList.remove("show");
    }

    if (addBoardBtn) addBoardBtn.addEventListener("click", openAddModal);
    if (closeFormBtn) closeFormBtn.addEventListener("click", closeModal);
    if (formCancelBtn) formCancelBtn.addEventListener("click", closeModal);

    if (boardFormModal) {
        boardFormModal.addEventListener("click", (e) => {
            if (e.target === boardFormModal) closeModal();
        });
    }

    // 5. Submit Form Tambah / Edit
    if (boardCrudForm) {
        boardCrudForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const isEdit = formIsEdit.value === "true";
            const id = formBoardId.value.trim().toUpperCase();
            const grid_height = parseInt(formGridHeight.value, 10);
            const grid_width = parseInt(formGridWidth.value, 10);
            const total_words = parseInt(formTotalWords.value, 10);
            const active = formActive.checked;

            try {
                if (isEdit) {
                    await apiFetch(`/api/admin/boards/${id}`, {
                        method: "PUT",
                        body: JSON.stringify({ grid_height, grid_width, total_words, active })
                    });
                    showAlert(`Papan ${id} berhasil diperbarui.`);
                } else {
                    await apiFetch("/api/admin/boards", {
                        method: "POST",
                        body: JSON.stringify({ id, grid_height, grid_width, total_words, active })
                    });
                    showAlert(`Papan ${id} berhasil dibuat.`);
                }

                closeModal();
                loadBoards();
            } catch (err) {
                alert(`Gagal: ${err.message}`);
            }
        });
    }

    // Muat data awal
    loadBoards();
});

