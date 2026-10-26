/**
 * auth.js - Penanganan formulir Login & Register
 */

document.addEventListener("DOMContentLoaded", () => {
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
            const username = loginForm.username ? loginForm.username.value.trim() : "";
            const password = loginForm.password ? loginForm.password.value : "";

            if (!username || !password) {
                showError("Nama pengguna dan kata sandi wajib diisi");
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Memverifikasi...";
                }

                const data = await apiFetch("/api/auth/login", {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                });

                setToken(data.token);
                setUser(data.user);
                showSuccess("Berhasil masuk! Mengarahkan ke arena bermain...");

                setTimeout(() => {
                    window.location.href = "/";
                }, 700);
            } catch (err) {
                showError(err.message || "Gagal masuk");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Masuk ke Permainan";
                }
            }
        });
    }

    // Penanganan Registrasi
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = registerForm.querySelector("button[type='submit']");
            const username = registerForm.username ? registerForm.username.value.trim() : "";
            const password = registerForm.password ? registerForm.password.value : "";
            const confirmPassword = registerForm.confirm_password ? registerForm.confirm_password.value : password;

            if (!username || !password) {
                showError("Nama pengguna dan kata sandi wajib diisi!");
                return;
            }

            if (username.length < 3) {
                showError("Nama pengguna minimal 3 karakter!");
                return;
            }

            if (password.length < 6) {
                showError("Kata sandi minimal 6 karakter!");
                return;
            }

            if (password !== confirmPassword) {
                showError("Konfirmasi kata sandi tidak cocok!");
                return;
            }

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = "Mendaftarkan...";
                }

                const data = await apiFetch("/api/auth/register", {
                    method: "POST",
                    body: JSON.stringify({ username, password })
                });

                showSuccess("Akun berhasil dibuat! Mengarahkan ke halaman masuk...");
                setTimeout(() => {
                    window.location.href = "/login";
                }, 1000);
            } catch (err) {
                showError(err.message || "Gagal mendaftar");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Daftar Akun Baru";
                }
            }
        });
    }
});
