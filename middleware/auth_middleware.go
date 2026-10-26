package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ExtractToken mengambil token JWT dari Authorization Header, Cookie, atau Query param
func ExtractToken(c *gin.Context) string {
	// 1. Cek Header Authorization: Bearer <token>
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}

	// 2. Cek Cookie 'token'
	if cookie, err := c.Cookie("token"); err == nil && cookie != "" {
		return cookie
	}

	// 3. Cek Query Param '?token='
	if queryToken := c.Query("token"); queryToken != "" {
		return queryToken
	}

	return ""
}

// ValidateJWT memvalidasi string token dan mengembalikan claims
func ValidateJWT(tokenString string) (jwt.MapClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "tts-default-secret-key-super-secure"
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode signing tidak terduga: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("token tidak valid atau telah kedaluwarsa")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("claims token tidak valid")
	}

	return claims, nil
}

// RequireAuth memverifikasi keberadaan dan validitas token JWT
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := ExtractToken(c)
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Akses ditolak: silakan login terlebih dahulu",
			})
			return
		}

		claims, err := ValidateJWT(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.",
			})
			return
		}

		c.Set("user_id", claims["user_id"])
		c.Set("username", claims["username"])
		if isAdmin, ok := claims["is_admin"].(bool); ok {
			c.Set("is_admin", isAdmin)
		}

		c.Next()
	}
}

// RequireAdmin memvalidasi bahwa pengguna memiliki kolom is_admin == true langsung dari database Supabase
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Silakan login terlebih dahulu",
			})
			return
		}

		var user models.User
		if err := config.DB.First(&user, userID).Error; err != nil || !user.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "Akses ditolak (403): Hanya untuk Administrator",
			})
			return
		}

		c.Next()
	}
}

// RequireAdminPage memproteksi rute halaman HTML '/admin' di sisi server Golang
// Menolak akses (403) jika user belum login atau bukan admin di database Supabase
func RequireAdminPage() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := ExtractToken(c)
		if tokenString == "" {
			render403Forbidden(c, "Anda harus masuk dengan akun Administrator untuk membuka halaman ini.")
			c.Abort()
			return
		}

		claims, err := ValidateJWT(tokenString)
		if err != nil {
			render403Forbidden(c, "Sesi Anda tidak valid atau telah kedaluwarsa. Silakan login kembali.")
			c.Abort()
			return
		}

		userIDVal := claims["user_id"]
		var user models.User
		if err := config.DB.First(&user, userIDVal).Error; err != nil || !user.IsAdmin {
			render403Forbidden(c, "Akses ditolak (403): Akun Anda tidak memiliki hak akses Administrator.")
			c.Abort()
			return
		}

		// Terverifikasi sebagai admin di database
		c.Set("user_id", user.ID)
		c.Set("username", user.Username)
		c.Set("is_admin", user.IsAdmin)
		c.Next()
	}
}

func render403Forbidden(c *gin.Context, reason string) {
	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden - Akses Ditolak</title>
    <link rel="stylesheet" href="/css/style.css">
    <style>
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
        .error-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 24px; padding: 40px; max-width: 480px; box-shadow: var(--card-shadow); }
        .error-code { font-size: 3.5rem; font-weight: 800; color: #ef4444; margin-bottom: 8px; }
        .error-msg { font-size: 1.05rem; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="error-card">
        <div class="error-code">403</div>
        <h2 style="margin-bottom: 12px; color: var(--text-main);">Akses Administrator Ditolak</h2>
        <p class="error-msg">%s</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
            <a href="/" class="btn-action btn-next" style="text-decoration: none; padding: 10px 20px;">🎮 Kembali ke Game</a>
            <a href="/login" class="btn-action btn-primary" style="text-decoration: none; padding: 10px 20px; width: auto; margin-top: 0;">Masuk Akun Admin</a>
        </div>
    </div>
</body>
</html>`, reason)

	c.Data(http.StatusForbidden, "text/html; charset=utf-8", []byte(html))
}
