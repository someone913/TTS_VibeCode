package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// TournamentClient merepresentasikan satu koneksi WebSocket pemain
type TournamentClient struct {
	Username string
	UserID   uint
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *TournamentHub
}

// WSMessage format pertukaran pesan WebSocket
type WSMessage struct {
	Type       string   `json:"type,omitempty"`
	Action     string   `json:"action,omitempty"`
	ItemType   string   `json:"item_type,omitempty"`
	TargetUser string   `json:"target_user,omitempty"`
	FromUser   string   `json:"from_user,omitempty"`
	Duration   int      `json:"duration,omitempty"`
	Message    string   `json:"message,omitempty"`
	Players    []string `json:"players,omitempty"`
	Count      int      `json:"count,omitempty"`
	Status     string   `json:"status,omitempty"`
	Timestamp  int64    `json:"timestamp,omitempty"`
}

// TournamentHub mengelola seluruh koneksi pemain turnamen secara real-time
type TournamentHub struct {
	clients    map[string]*TournamentClient // key: username
	register   chan *TournamentClient
	unregister chan *TournamentClient
	mutex      sync.RWMutex
}

var Hub = &TournamentHub{
	clients:    make(map[string]*TournamentClient),
	register:   make(chan *TournamentClient),
	unregister: make(chan *TournamentClient),
}

func init() {
	go Hub.Run()
}

// Run menjalankan event loop pengelola client turnamen
func (h *TournamentHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			// Jika user sudah terkoneksi sebelumnya (misal refresh tab), tutup koneksi lama
			if existing, ok := h.clients[client.Username]; ok {
				close(existing.Send)
				existing.Conn.Close()
			}
			h.clients[client.Username] = client
			h.mutex.Unlock()

			log.Printf("[WebSocket] Pemain online: %s (Total: %d)", client.Username, len(h.clients))
			h.BroadcastOnlinePlayers()

		case client := <-h.unregister:
			h.mutex.Lock()
			if existing, ok := h.clients[client.Username]; ok && existing == client {
				delete(h.clients, client.Username)
				close(client.Send)
			}
			h.mutex.Unlock()

			log.Printf("[WebSocket] Pemain offline: %s (Total: %d)", client.Username, len(h.clients))
			h.BroadcastOnlinePlayers()
		}
	}
}

// BroadcastOnlinePlayers mengirimkan daftar pemain online terkini ke semua client
func (h *TournamentHub) BroadcastOnlinePlayers() {
	h.mutex.RLock()
	players := make([]string, 0, len(h.clients))
	for username := range h.clients {
		players = append(players, username)
	}
	h.mutex.RUnlock()

	msg := WSMessage{
		Type:    "online_players",
		Players: players,
		Count:   len(players),
	}
	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mutex.RLock()
	for _, client := range h.clients {
		select {
		case client.Send <- payload:
		default:
			// Buffer penuh, lewati
		}
	}
	h.mutex.RUnlock()
}

// SendToUser mengirimkan pesan langsung ke target pemain tertentu
func (h *TournamentHub) SendToUser(targetUsername string, msg WSMessage) bool {
	payload, err := json.Marshal(msg)
	if err != nil {
		return false
	}

	h.mutex.RLock()
	client, exists := h.clients[targetUsername]
	h.mutex.RUnlock()

	if !exists {
		return false
	}

	select {
	case client.Send <- payload:
		return true
	default:
		return false
	}
}

// BroadcastAll menyiarkan pesan ke semua client
func (h *TournamentHub) BroadcastAll(msg WSMessage) {
	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mutex.RLock()
	defer h.mutex.RUnlock()
	for _, client := range h.clients {
		select {
		case client.Send <- payload:
		default:
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Mengizinkan koneksi dari frontend
	},
}

// HandleTournamentWS endpoint WebSocket ws://localhost:8080/api/ws/tournament
func HandleTournamentWS(c *gin.Context) {
	// 1. Ekstrak token dari query param '?token=' atau header atau cookie
	tokenStr := c.Query("token")
	if tokenStr == "" {
		if cookie, err := c.Cookie("token"); err == nil {
			tokenStr = cookie
		}
	}
	if tokenStr == "" {
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token otentikasi diperlukan untuk mode turnamen"})
		return
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "tts-default-secret-key-super-secure"
	}

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode signing tidak terduga: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token tidak valid"})
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Claims tidak valid"})
		return
	}

	username, _ := claims["username"].(string)
	if username == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Username tidak ditemukan di token"})
		return
	}

	var userID uint
	if idFloat, ok := claims["user_id"].(float64); ok {
		userID = uint(idFloat)
	}

	// 2. Upgrade HTTP ke WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Gagal upgrade websocket untuk %s: %v", username, err)
		return
	}

	client := &TournamentClient{
		Username: username,
		UserID:   userID,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Hub:      Hub,
	}

	Hub.register <- client

	// Jalankan reader dan writer goroutine
	go client.writePump()
	go client.readPump()
}

// readPump membaca pesan masuk dari client WebSocket
func (c *TournamentClient) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(4096)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var req WSMessage
		if err := json.Unmarshal(message, &req); err != nil {
			continue
		}

		// Tangani aksi lempar item
		if req.Action == "throw_item" {
			target := strings.TrimSpace(req.TargetUser)
			itemType := strings.ToLower(strings.TrimSpace(req.ItemType))

			if itemType != "bomb" && itemType != "freeze" {
				c.Send <- mustMarshal(WSMessage{
					Type:    "attack_error",
					Message: "Jenis item tidak valid. Hanya Bom dan Freeze yang didukung.",
				})
				continue
			}

			if target == "" || strings.EqualFold(target, c.Username) {
				c.Send <- mustMarshal(WSMessage{
					Type:    "attack_error",
					Message: "Target tidak valid (tidak bisa menyerang diri sendiri).",
				})
				continue
			}

			// Kirim serangan ke pemain target
			attackMsg := WSMessage{
				Type:       "attack_received",
				ItemType:   itemType,
				FromUser:   c.Username,
				Duration:   5, // 5 detik
				Timestamp:  time.Now().Unix(),
			}

			success := c.Hub.SendToUser(target, attackMsg)
			if success {
				// Konfirmasi ke penyerang
				c.Send <- mustMarshal(WSMessage{
					Type:       "attack_success",
					ItemType:   itemType,
					TargetUser: target,
					Message:    fmt.Sprintf("Berhasil menyerang %s dengan %s!", target, itemType),
				})

				// Siarkan pengumuman ke seluruh arena turnamen
				itemName := "Bom 💣"
				if itemType == "freeze" {
					itemName = "Freeze ❄️"
				}
				c.Hub.BroadcastAll(WSMessage{
					Type:    "tournament_event",
					Message: fmt.Sprintf("⚔️ %s melemparkan %s ke %s!", c.Username, itemName, target),
				})
			} else {
				c.Send <- mustMarshal(WSMessage{
					Type:    "attack_error",
					Message: fmt.Sprintf("Pemain %s saat ini sedang offline.", target),
				})
			}
		}
	}
}

// writePump mengirimkan pesan dari channel Send ke koneksi WebSocket
func (c *TournamentClient) writePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Kirim juga pesan yang masih ada di antrian
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

