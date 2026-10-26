/**
 * auth.js - Penanganan formulir Login & Register
 */

document.addEventListener("DOMContentLoaded", () => {
    // Jika sudah punya token, langsung arahkan ke game
    if (getToken() && (window.location.pathname.includes("login") || window.location.pathname.includes("register"))) {
        window.location.href = "/";
        return;
    }

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const errorAlert = document.getElementById("auth-error");
    const successAlert = document.getElementById("auth-success");

    function showError(msg) {
        if (errorAlert) {
            errorAlert.textContent = msg;
            errorAlert.classList.remove("hidden");
        }
        if (successAlert) {
            successAlert.classList.add("hidden");
        }
    }

    function showSuccess(msg) {
        if (successAlert) {
            successAlert.textContent = msg;
            successAlert.classList.remove("hidden");
        }
        if (errorAlert) {
            errorAlert.classList.add("hidden");
        }
    }

    // Penanganan Login
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector("button[type='submit']");
            const username = loginForm.username.value.trim();
            const password = loginForm.password.value;

            if (!username || !password) {
                showError("Username dan kata sandi wajib diisi");
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Memverifikasi...";

                const data = await apiFetch("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                });

                setToken(data.token);
                setUser(data.user);
                showSuccess("Berhasil masuk! Mengarahkan ke arena bermain...");

                setTimeout(() => {
                    window.location.href = "/";
                }, 800);
            } catch (err) {
                showError(err.message || "Gagal masuk");
                submitBtn.disabled = false;
                submitBtn.textContent = "Masuk";
            }
        });
    }

    // Penanganan Registrasi
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = registerForm.querySelector("button[type='submit']");
            const username = registerForm.username.value.trim();
            const password = registerForm.password.value;
            const confirmPassword = registerForm.confirm_password.value;

            if (password !== confirmPassword) {
                showError("Konfirmasi kata sandi tidak cocok!");
                return;
            }

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = "Mendaftarkan...";

                const data = await apiFetch("/api/auth/register", {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                });

                showSuccess("Akun berhasil dibuat! Silakan masuk...");
                setTimeout(() => {
                    window.location.href = "/login";
                }, 1200);
            } catch (err) {
                showError(err.message || "Gagal mendaftar");
                submitBtn.disabled = false;
                submitBtn.textContent = "Daftar Sekarang";
            }
        });
    }
});
