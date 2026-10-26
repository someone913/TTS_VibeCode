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

// RequireAuth memverifikasi keberadaan dan validitas token JWT di header Authorization
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Akses ditolak: silakan login terlebih dahulu",
			})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
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
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.",
			})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Format token tidak valid",
			})
			return
		}

		// Simpan user_id dan username ke konteks request Gin
		c.Set("user_id", claims["user_id"])
		c.Set("username", claims["username"])
		if isAdmin, ok := claims["is_admin"].(bool); ok {
			c.Set("is_admin", isAdmin)
		}

		c.Next()
	}
}

// RequireAdmin memvalidasi bahwa pengguna memiliki hak akses Administrator (is_admin = true)
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
				"error": "Akses ditolak: Hanya untuk Administrator",
			})
			return
		}

		c.Next()
	}
}
