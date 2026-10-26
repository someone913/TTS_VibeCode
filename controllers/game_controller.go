package controllers

import (
	"fmt"
	"net/http"
	"strconv"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetBoardByID mengambil satu papan TTS berdasarkan ID (contoh: "P01" atau "1")
func GetBoardByID(c *gin.Context) {
	id := c.Param("id")
	var board models.Board

	// Preload Words beserta relasi Question-nya
	preloadFunc := func(db *gorm.DB) *gorm.DB {
		return db.Preload("Words", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("clue_no ASC")
		}).Preload("Words.Question")
	}

	err := preloadFunc(config.DB).Where("id = ?", id).First(&board).Error

	// Jika input berupa angka biasa (misal: "1" atau "5"), ubah menjadi format "P01", "P05"
	if err != nil {
		if num, numErr := strconv.Atoi(id); numErr == nil {
			formattedID := fmt.Sprintf("P%02d", num)
			err = preloadFunc(config.DB).Where("id = ?", formattedID).First(&board).Error
		}
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Papan TTS dengan ID '%s' tidak ditemukan", id),
		})
		return
	}

	c.JSON(http.StatusOK, board)
}

// GetRandomBoard mengambil 1 papan TTS acak dari database
func GetRandomBoard(c *gin.Context) {
	var board models.Board

	err := config.DB.Preload("Words", func(tx *gorm.DB) *gorm.DB {
		return tx.Order("clue_no ASC")
	}).Preload("Words.Question").
		Where("active = ?", true).
		Order("RANDOM()").
		First(&board).Error

	// Jika tidak ada papan dengan status active=true, cari sembarang papan secara acak
	if err != nil {
		err = config.DB.Preload("Words", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("clue_no ASC")
		}).Preload("Words.Question").
			Order("RANDOM()").
			First(&board).Error
	}

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Belum ada papan TTS yang tersedia di database",
		})
		return
	}

	c.JSON(http.StatusOK, board)
}
