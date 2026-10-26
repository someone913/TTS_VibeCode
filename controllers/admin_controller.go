package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
)

type AdminBoardInput struct {
	ID         string `json:"id" binding:"required"`
	GridHeight int    `json:"grid_height" binding:"required"`
	GridWidth  int    `json:"grid_width" binding:"required"`
	TotalWords int    `json:"total_words"`
	Active     bool   `json:"active"`
}

type AdminBoardUpdateInput struct {
	GridHeight int  `json:"grid_height"`
	GridWidth  int  `json:"grid_width"`
	TotalWords int  `json:"total_words"`
	Active     bool `json:"active"`
}

// GetAdminBoards mengambil seluruh daftar papan untuk dashboard admin
func GetAdminBoards(c *gin.Context) {
	var boards []models.Board

	// Ambil seluruh board diurutkan berdasarkan id
	err := config.DB.Preload("Words").Order("id ASC").Find(&boards).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat daftar papan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"boards": boards,
	})
}

// GetAdminBoardDetail mengambil detail lengkap papan beserta soal-soalnya
func GetAdminBoardDetail(c *gin.Context) {
	id := c.Param("id")
	var board models.Board

	err := config.DB.Preload("Words.Question").Where("id = ?", id).First(&board).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Papan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, board)
}

// CreateAdminBoard membuat papan TTS baru
func CreateAdminBoard(c *gin.Context) {
	var input AdminBoardInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data papan tidak lengkap atau tidak valid"})
		return
	}

	input.ID = strings.TrimSpace(strings.ToUpper(input.ID))

	// Cek apakah ID papan sudah ada
	var existing models.Board
	if err := config.DB.Where("id = ?", input.ID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Papan dengan ID '%s' sudah ada", input.ID)})
		return
	}

	board := models.Board{
		ID:         input.ID,
		GridHeight: input.GridHeight,
		GridWidth:  input.GridWidth,
		TotalWords: input.TotalWords,
		Active:     input.Active,
	}

	if err := config.DB.Create(&board).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat papan baru"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Papan baru berhasil ditambahkan",
		"board":   board,
	})
}

// UpdateAdminBoard memperbarui properti papan TTS
func UpdateAdminBoard(c *gin.Context) {
	id := c.Param("id")
	var board models.Board

	if err := config.DB.Where("id = ?", id).First(&board).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Papan tidak ditemukan"})
		return
	}

	var input AdminBoardUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format update tidak valid"})
		return
	}

	if input.GridHeight > 0 {
		board.GridHeight = input.GridHeight
	}
	if input.GridWidth > 0 {
		board.GridWidth = input.GridWidth
	}
	if input.TotalWords > 0 {
		board.TotalWords = input.TotalWords
	}
	board.Active = input.Active

	if err := config.DB.Save(&board).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui data papan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Papan berhasil diperbarui",
		"board":   board,
	})
}

// DeleteAdminBoard menghapus papan TTS dan relasi kata-katanya
func DeleteAdminBoard(c *gin.Context) {
	id := c.Param("id")

	// Hapus relasi board_words terlebih dahulu
	config.DB.Where("board_id = ?", id).Delete(&models.BoardWord{})

	// Hapus papan
	res := config.DB.Where("id = ?", id).Delete(&models.Board{})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus papan"})
		return
	}

	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Papan tidak ditemukan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Papan '%s' beserta seluruh relasi soalnya berhasil dihapus", id),
	})
}

