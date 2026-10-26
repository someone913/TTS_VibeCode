package controllers

import (
	"net/http"
	"os"
	"strings"
	"time"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthInput struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type ScoreActionInput struct {
	Action string `json:"action" binding:"required"` // "word_correct", "hint_used", "board_completed"
}

type LeaderboardEntry struct {
	ID              uint   `json:"id"`
	Username        string `json:"username"`
	Score           int    `json:"score"`
	BoardsCompleted int    `json:"boards_completed"`
	WordsSolved     int    `json:"words_solved"`
}

// Register mendaftarkan akun baru
func Register(c *gin.Context) {
	var input AuthInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format input tidak valid"})
		return
	}

	username := strings.TrimSpace(input.Username)
	if len(username) < 3 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username minimal 3 karakter"})
		return
	}
	if len(input.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Password minimal 6 karakter"})
		return
	}

	var existing models.User
	if err := config.DB.Where("LOWER(username) = LOWER(?)", username).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username sudah digunakan, silakan pilih yang lain"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengenkripsi kata sandi"})
		return
	}

	var userCount int64
	config.DB.Model(&models.User{}).Count(&userCount)
	isAdmin := userCount == 0 || strings.EqualFold(username, "admin")

	user := models.User{
		Username:        username,
		Password:        string(hashedPassword),
		Score:           0,
		BoardsCompleted: 0,
		WordsSolved:     0,
		HintsUsed:       0,
		IsAdmin:         isAdmin,
		CreatedAt:       time.Now(),
	}

	if err := config.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan akun"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registrasi berhasil! Silakan masuk.",
		"user": gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"score":            user.Score,
			"boards_completed": user.BoardsCompleted,
			"is_admin":         user.IsAdmin,
		},
	})
}

// Login mengautentikasi pengguna dan mengembalikan token JWT 24 jam
func Login(c *gin.Context) {
	var input AuthInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format input tidak valid"})
		return
	}

	username := strings.TrimSpace(input.Username)
	var user models.User
	if err := config.DB.Where("LOWER(username) = LOWER(?)", username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau kata sandi salah"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username atau kata sandi salah"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "tts-default-secret-key-super-secure"
	}

	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Username,
		"is_admin": user.IsAdmin,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat sesi login"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login berhasil",
		"token":   tokenString,
		"user": gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"score":            user.Score,
			"boards_completed": user.BoardsCompleted,
			"words_solved":     user.WordsSolved,
			"hints_used":       user.HintsUsed,
			"is_admin":         user.IsAdmin,
		},
	})
}

// GetCurrentUser mengembalikan info dasar user saat ini
func GetCurrentUser(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terotentikasi"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Data user tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"score":            user.Score,
			"boards_completed": user.BoardsCompleted,
			"words_solved":     user.WordsSolved,
			"hints_used":       user.HintsUsed,
			"is_admin":         user.IsAdmin,
		},
	})
}

// GetUserProfile mengembalikan data profil lengkap, statistik, dan rank global
func GetUserProfile(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terotentikasi"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Hitung peringkat global berdasarkan skor
	var higherScoreCount int64
	config.DB.Model(&models.User{}).Where("score > ?", user.Score).Count(&higherScoreCount)
	globalRank := higherScoreCount + 1

	// Hitung total pemain
	var totalPlayers int64
	config.DB.Model(&models.User{}).Count(&totalPlayers)

	c.JSON(http.StatusOK, gin.H{
		"profile": gin.H{
			"id":               user.ID,
			"username":         user.Username,
			"score":            user.Score,
			"boards_completed": user.BoardsCompleted,
			"words_solved":     user.WordsSolved,
			"hints_used":       user.HintsUsed,
			"is_admin":         user.IsAdmin,
			"global_rank":      globalRank,
			"total_players":    totalPlayers,
			"created_at":       user.CreatedAt.Format("02 Jan 2006"),
		},
	})
}

// HandleScoreUpdate memvalidasi dan mencatat penambahan/pengurangan skor secara aman di backend
func HandleScoreUpdate(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terotentikasi"})
		return
	}

	var input ScoreActionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format aksi skor tidak valid"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	// Validasi aturan bisnis di backend agar tidak bisa dimanipulasi client
	switch input.Action {
	case "word_correct":
		// Aturan spesifikasi: Benar +10 poin
		user.Score += 10
		user.WordsSolved += 1
	case "hint_used":
		// Aturan spesifikasi: Hint -10 poin
		user.Score -= 10
		if user.Score < 0 {
			user.Score = 0
		}
		user.HintsUsed += 1
	case "board_completed":
		// Menyelesaikan 1 papan TTS
		user.BoardsCompleted += 1
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Aksi skor tidak dikenali"})
		return
	}

	config.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"message":          "Skor berhasil divalidasi dan diperbarui di database",
		"score":            user.Score,
		"words_solved":     user.WordsSolved,
		"hints_used":       user.HintsUsed,
		"boards_completed": user.BoardsCompleted,
	})
}

// GetLeaderboard mengembalikan daftar 10 user dengan skor tertinggi
func GetLeaderboard(c *gin.Context) {
	var leaders []LeaderboardEntry

	err := config.DB.Model(&models.User{}).
		Select("id, username, score, boards_completed, words_solved").
		Order("score DESC, boards_completed DESC, words_solved DESC, id ASC").
		Limit(10).
		Scan(&leaders).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat papan peringkat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"leaderboard": leaders,
	})
}

// MakeSelfAdmin memberikan hak akses admin ke akun pengguna yang sedang login
func MakeSelfAdmin(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User tidak terotentikasi"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User tidak ditemukan"})
		return
	}

	user.IsAdmin = true
	config.DB.Save(&user)

	c.JSON(http.StatusOK, gin.H{
		"message":  "Akun Anda kini telah diberikan status Administrator",
		"is_admin": true,
	})
}
