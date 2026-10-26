/**
 * api.js - Helper komunikasi REST API dan manajemen token JWT
 */

const TOKEN_KEY = "tts_auth_token";
const USER_KEY = "tts_auth_user";

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    try {
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function logout() {
    removeToken();
    window.location.href = "/login";
}

/**
 * apiFetch: Pembungkus fungsi fetch bawaan dengan otomatis menyisipkan Authorization header
 */
async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Jika respons 401 (Unauthorized), sesi telah berakhir
        if (response.status === 401) {
            removeToken();
            if (!window.location.pathname.includes("login") && !window.location.pathname.includes("register")) {
                window.location.href = "/login";
            }
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Sesi berakhir. Silakan login kembali.");
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Terjadi kesalahan pada server");
        }

        return data;
    } catch (err) {
        throw err;
    }
}
