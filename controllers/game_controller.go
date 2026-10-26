package controllers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// validateBoardDimensions memastikan grid_height dan grid_width selalu mencakup seluruh koordinat soal
func validateBoardDimensions(board *models.Board) {
	maxR := 0
	maxC := 0
	for _, w := range board.Words {
		wordLen := w.Length
		if wordLen == 0 && w.Question.Answer != "" {
			wordLen = len(w.Question.Answer)
		}
		endR := w.StartRow
		endC := w.StartCol
		if strings.EqualFold(w.Direction, "mendatar") || strings.EqualFold(w.Direction, "horizontal") {
			endC = w.StartCol + wordLen - 1
		} else {
			endR = w.StartRow + wordLen - 1
		}
		if endR > maxR {
			maxR = endR
		}
		if endC > maxC {
			maxC = endC
		}
	}
	if maxR > board.GridHeight {
		board.GridHeight = maxR
	}
	if maxC > board.GridWidth {
		board.GridWidth = maxC
	}
}

// assignRandomItems menyisipkan item ("bomb" atau "freeze") secara acak pada beberapa soal
func assignRandomItems(words []models.BoardWord) []models.BoardWord {
	if len(words) == 0 {
		return words
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	indices := r.Perm(len(words))

	// Tentukan jumlah soal ber-item (2 - 4 soal per papan)
	itemCount := 2
	if len(words) >= 6 {
		itemCount = 3
	}
	if len(words) >= 10 {
		itemCount = 4
	}

	types := []string{"bomb", "freeze", "bomb", "freeze"}
	for i := 0; i < itemCount && i < len(words); i++ {
		idx := indices[i]
		words[idx].Item = types[i%len(types)]
	}

	return words
}

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

	// Validasi dan sesuaikan dimensi papan berdasarkan seluruh koordinat kata
	validateBoardDimensions(&board)

	// Sisipkan amunisi item turnamen secara acak pada beberapa kata
	board.Words = assignRandomItems(board.Words)

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

	// Validasi dan sesuaikan dimensi papan berdasarkan seluruh koordinat kata
	validateBoardDimensions(&board)

	// Sisipkan amunisi item turnamen secara acak pada beberapa kata
	board.Words = assignRandomItems(board.Words)

	c.JSON(http.StatusOK, board)
}
