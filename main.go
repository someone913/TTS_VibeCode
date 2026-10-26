package main

import (
	"log"
	"os"

	"go_vibe/config"
	"go_vibe/controllers"
	"go_vibe/middleware"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// 1. Load file .env jika ada
	if err := godotenv.Load(); err != nil {
		log.Println("Peringatan: File .env tidak ditemukan, menggunakan environment variables sistem")
	}

	// 2. Hubungkan ke database PostgreSQL (Supabase)
	config.ConnectDatabase()

	// 3. AutoMigrate untuk web_users (menambahkan kolom statistik & hak akses jika belum ada)
	if err := config.DB.AutoMigrate(&models.User{}); err != nil {
		log.Fatalf("Gagal melakukan AutoMigrate User: %v", err)
	}
	log.Println("AutoMigrate model User berhasil")

	// 4. Inisialisasi router Gin
	r := gin.Default()

	// 5. Sajikan file statis frontend (public)
	r.Static("/public", "./public")
	r.Static("/css", "./public/css")
	r.Static("/js", "./public/js")

	// Rute halaman HTML
	r.GET("/", func(c *gin.Context) {
		c.File("./public/index.html")
	})
	r.GET("/login", func(c *gin.Context) {
		c.File("./public/login.html")
	})
	r.GET("/register", func(c *gin.Context) {
		c.File("./public/register.html")
	})
	r.GET("/admin", func(c *gin.Context) {
		c.File("./public/admin.html")
	})

	// 6. Rute API Publik (Autentikasi & Leaderboard)
	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", controllers.Register)
		authGroup.POST("/login", controllers.Login)
	}
	r.GET("/api/leaderboard", controllers.GetLeaderboard)

	// 7. Rute API Terproteksi (Wajib Token JWT Pemain)
	protectedApi := r.Group("/api", middleware.RequireAuth())
	{
		protectedApi.GET("/auth/me", controllers.GetCurrentUser)
		protectedApi.GET("/user/profile", controllers.GetUserProfile)
		protectedApi.POST("/score", controllers.HandleScoreUpdate)
		protectedApi.POST("/user/make-admin", controllers.MakeSelfAdmin)
		protectedApi.GET("/boards/random", controllers.GetRandomBoard)
		protectedApi.GET("/boards/:id", controllers.GetBoardByID)
	}

	// 8. Rute API Administrator (Wajib Token JWT & is_admin = true)
	adminApi := r.Group("/api/admin", middleware.RequireAuth(), middleware.RequireAdmin())
	{
		adminApi.GET("/boards", controllers.GetAdminBoards)
		adminApi.GET("/boards/:id", controllers.GetAdminBoardDetail)
		adminApi.POST("/boards", controllers.CreateAdminBoard)
		adminApi.PUT("/boards/:id", controllers.UpdateAdminBoard)
		adminApi.DELETE("/boards/:id", controllers.DeleteAdminBoard)
	}

	// 9. Tentukan port & jalankan server (hostless-ready)
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("APP_PORT")
	}
	if port == "" {
		port = "8080"
	}

	log.Printf("Server TTS ID berjalan di http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
