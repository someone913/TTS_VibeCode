package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"go_vibe/config"
	"go_vibe/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// TournamentClient merepresentasikan koneksi WebSocket dari pemain
type TournamentClient struct {
	Username string
	UserID   uint
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *TournamentHub
}

// RoomPlayer detail progres pemain di dalam room turnamen
type RoomPlayer struct {
	Username    string `json:"username"`
	WordsSolved int    `json:"words_solved"`
	TotalWords  int    `json:"total_words"`
	IsReady     bool   `json:"is_ready"`
	IsWinner    bool   `json:"is_winner"`
}

// TournamentRoom kamar duel atau mabar bersama (1 papan sama, 2 - 5 pemain)
type TournamentRoom struct {
	ID         string                 `json:"id"`
	Name       string                 `json:"name"`
	BoardID    string                 `json:"board_id"`
	Host       string                 `json:"host"`
	MaxPlayers int                    `json:"max_players"`
	Status     string                 `json:"status"` // "waiting", "playing", "finished"
	Players    map[string]*RoomPlayer `json:"players"`
	Winner     string                 `json:"winner,omitempty"`
	CreatedAt  int64                  `json:"created_at"`
}

// WSMessage format pertukaran pesan WebSocket
type WSMessage struct {
	Type         string            `json:"type,omitempty"`
	Action       string            `json:"action,omitempty"`
	ItemType     string            `json:"item_type,omitempty"`
	TargetUser   string            `json:"target_user,omitempty"`
	FromUser     string            `json:"from_user,omitempty"`
	Duration     int               `json:"duration,omitempty"`
	Message      string            `json:"message,omitempty"`
	Players      []string          `json:"players,omitempty"`
	Count        int               `json:"count,omitempty"`
	Status       string            `json:"status,omitempty"`
	BoardID      string            `json:"board_id,omitempty"`
	RoomID       string            `json:"room_id,omitempty"`
	RoomName     string            `json:"room_name,omitempty"`
	MaxPlayers   int               `json:"max_players,omitempty"`
	Room         *TournamentRoom   `json:"room,omitempty"`
	Rooms        []*TournamentRoom `json:"rooms,omitempty"`
	WordsSolved  int               `json:"words_solved,omitempty"`
	TotalWords   int               `json:"total_words,omitempty"`
	RoomPlayers  []*RoomPlayer     `json:"room_players,omitempty"`
	Winner       string            `json:"winner,omitempty"`
	Timestamp    int64             `json:"timestamp,omitempty"`
}

// TournamentHub mengelola seluruh koneksi pemain, duel 1v1, dan room mabar
type TournamentHub struct {
	clients    map[string]*TournamentClient // username -> client
	rooms      map[string]*TournamentRoom   // room_id -> room
	userRooms  map[string]string            // username -> room_id
	register   chan *TournamentClient
	unregister chan *TournamentClient
	mutex      sync.RWMutex
}

var Hub = &TournamentHub{
	clients:    make(map[string]*TournamentClient),
	rooms:      make(map[string]*TournamentRoom),
	userRooms:  make(map[string]string),
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
			if existing, ok := h.clients[client.Username]; ok {
				close(existing.Send)
				existing.Conn.Close()
			}
			h.clients[client.Username] = client
			h.mutex.Unlock()

			log.Printf("[WebSocket] Pemain online: %s (Total: %d)", client.Username, len(h.clients))
			h.BroadcastOnlineState()

		case client := <-h.unregister:
			h.mutex.Lock()
			if existing, ok := h.clients[client.Username]; ok && existing == client {
				delete(h.clients, client.Username)
				close(client.Send)

				// Keluarkan dari room jika sedang bergabung
				if roomID, inRoom := h.userRooms[client.Username]; inRoom {
					delete(h.userRooms, client.Username)
					if room, rExists := h.rooms[roomID]; rExists {
						delete(room.Players, client.Username)
						if len(room.Players) == 0 {
							delete(h.rooms, roomID)
						}
					}
				}
			}
			h.mutex.Unlock()

			log.Printf("[WebSocket] Pemain offline: %s (Total: %d)", client.Username, len(h.clients))
			h.BroadcastOnlineState()
		}
	}
}

// GetRandomBoardID mengambil 1 ID papan acak dari database
func GetRandomBoardID() string {
	var board models.Board
	if err := config.DB.Where("active = ?", true).Order("RANDOM()").First(&board).Error; err == nil && board.ID != "" {
		return board.ID
	}
	if err := config.DB.Order("RANDOM()").First(&board).Error; err == nil && board.ID != "" {
		return board.ID
	}
	return "P01"
}

// BroadcastOnlineState menyiarkan daftar pemain online dan room aktif ke semua client
func (h *TournamentHub) BroadcastOnlineState() {
	h.mutex.RLock()
	players := make([]string, 0, len(h.clients))
	for username := range h.clients {
		players = append(players, username)
	}

	roomList := make([]*TournamentRoom, 0, len(h.rooms))
	for _, room := range h.rooms {
		roomList = append(roomList, room)
	}
	h.mutex.RUnlock()

	msg := WSMessage{
		Type:    "online_players",
		Players: players,
		Count:   len(players),
		Rooms:   roomList,
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
		}
	}
	h.mutex.RUnlock()
}

// SendToUser mengirimkan pesan langsung ke pemain target
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

// BroadcastToRoom mengirimkan pesan ke seluruh anggota di room tertentu
func (h *TournamentHub) BroadcastToRoom(roomID string, msg WSMessage) {
	h.mutex.RLock()
	room, exists := h.rooms[roomID]
	if !exists {
		h.mutex.RUnlock()
		return
	}

	clientsToSend := make([]*TournamentClient, 0, len(room.Players))
	for uname := range room.Players {
		if c, cExists := h.clients[uname]; cExists {
			clientsToSend = append(clientsToSend, c)
		}
	}
	h.mutex.RUnlock()

	payload, err := json.Marshal(msg)
	if err != nil {
		return
	}

	for _, client := range clientsToSend {
		select {
		case client.Send <- payload:
		default:
		}
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
		return true // Mengizinkan semua origin
	},
}

// HandleTournamentWS endpoint WebSocket ws://localhost:8080/api/ws/tournament
func HandleTournamentWS(c *gin.Context) {
	// 1. Ekstrak token dari query param '?token=' atau cookie atau header
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
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token otentikasi diperlukan"})
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

	// Upgrade HTTP ke WebSocket
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

		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		// Heartbeat ping
		if req.Action == "ping" {
			c.Send <- mustMarshal(WSMessage{Type: "pong"})
			continue
		}

		// 1. TANTANG DUEL (User A menantang User B secara langsung)
		if req.Action == "challenge_player" {
			target := strings.TrimSpace(req.TargetUser)
			if target == "" || strings.EqualFold(target, c.Username) {
				c.Send <- mustMarshal(WSMessage{
					Type:    "challenge_error",
					Message: "Target tantangan tidak valid.",
				})
				continue
			}

			boardID := req.BoardID
			if boardID == "" {
				boardID = GetRandomBoardID()
			}

			// Kirim undangan tantangan ke target
			success := c.Hub.SendToUser(target, WSMessage{
				Type:     "challenge_received",
				FromUser: c.Username,
				BoardID:  boardID,
				Message:  fmt.Sprintf("⚔️ %s menantang Anda duel teka-teki silang di Papan %s! Mau terima?", c.Username, boardID),
			})

			if success {
				c.Send <- mustMarshal(WSMessage{
					Type:       "challenge_sent",
					TargetUser: target,
					Message:    fmt.Sprintf("Tantangan berhasil dikirim ke %s. Menunggu jawaban...", target),
				})
			} else {
				c.Send <- mustMarshal(WSMessage{
					Type:    "challenge_error",
					Message: fmt.Sprintf("Pemain %s sedang tidak online.", target),
				})
			}
			continue
		}

		// 2. MENERIMA TANTANGAN DUEL (Otomatis buat duel room dengan 1 papan yang sama)
		if req.Action == "accept_challenge" {
			challenger := strings.TrimSpace(req.FromUser)
			boardID := req.BoardID
			if boardID == "" {
				boardID = GetRandomBoardID()
			}

			roomID := fmt.Sprintf("duel-%d", rand.Intn(90000)+10000)
			room := &TournamentRoom{
				ID:         roomID,
				Name:       fmt.Sprintf("Duel: %s vs %s", challenger, c.Username),
				BoardID:    boardID,
				Host:       challenger,
				MaxPlayers: 2,
				Status:     "playing", // Langsung tanding
				Players:    make(map[string]*RoomPlayer),
				CreatedAt:  time.Now().Unix(),
			}

			room.Players[challenger] = &RoomPlayer{Username: challenger, TotalWords: 10}
			room.Players[c.Username] = &RoomPlayer{Username: c.Username, TotalWords: 10}

			c.Hub.mutex.Lock()
			c.Hub.rooms[roomID] = room
			c.Hub.userRooms[challenger] = roomID
			c.Hub.userRooms[c.Username] = roomID
			c.Hub.mutex.Unlock()

			// Beritahu kedua pemain bahwa duel dimulai di papan yang sama persis!
			startMsg := WSMessage{
				Type:    "match_start",
				RoomID:  roomID,
				BoardID: boardID,
				Room:    room,
				Message: fmt.Sprintf("⚔️ Duel dimulai di Papan %s! Siapa yang tercepat dialah pemenangnya!", boardID),
			}

			c.Hub.SendToUser(challenger, startMsg)
			c.Hub.SendToUser(c.Username, startMsg)

			c.Hub.BroadcastAll(WSMessage{
				Type:    "tournament_event",
				Message: fmt.Sprintf("⚔️ Duel dimulai: %s VS %s di Papan %s!", challenger, c.Username, boardID),
			})

			c.Hub.BroadcastOnlineState()
			continue
		}

		// 3. MENOLAK TANTANGAN DUEL
		if req.Action == "reject_challenge" {
			challenger := strings.TrimSpace(req.FromUser)
			c.Hub.SendToUser(challenger, WSMessage{
				Type:    "challenge_rejected",
				Message: fmt.Sprintf("Pemain %s menolak tantangan duel Anda.", c.Username),
			})
			continue
		}

		// 4. BUAT ROOM TURNAMEN (Bisa Duel 2 Pemain atau Mabar hingga 5 Pemain)
		if req.Action == "create_room" {
			maxPlayers := req.MaxPlayers
			if maxPlayers <= 1 || maxPlayers > 5 {
				maxPlayers = 5
			}

			boardID := req.BoardID
			if boardID == "" {
				boardID = GetRandomBoardID()
			}

			roomName := strings.TrimSpace(req.RoomName)
			if roomName == "" {
				roomName = fmt.Sprintf("Room %s (%d Pemain)", c.Username, maxPlayers)
			}

			roomID := fmt.Sprintf("room-%d", rand.Intn(90000)+10000)
			room := &TournamentRoom{
				ID:         roomID,
				Name:       roomName,
				BoardID:    boardID,
				Host:       c.Username,
				MaxPlayers: maxPlayers,
				Status:     "waiting",
				Players:    make(map[string]*RoomPlayer),
				CreatedAt:  time.Now().Unix(),
			}

			room.Players[c.Username] = &RoomPlayer{Username: c.Username, TotalWords: 10, IsReady: true}

			c.Hub.mutex.Lock()
			c.Hub.rooms[roomID] = room
			c.Hub.userRooms[c.Username] = roomID
			c.Hub.mutex.Unlock()

			c.Send <- mustMarshal(WSMessage{
				Type:    "room_created",
				Room:    room,
				Message: "Room berhasil dibuat! Menunggu pemain lain bergabung.",
			})

			c.Hub.BroadcastOnlineState()
			continue
		}

		// 5. GABUNG ROOM
		if req.Action == "join_room" {
			roomID := strings.TrimSpace(req.RoomID)

			c.Hub.mutex.Lock()
			room, exists := c.Hub.rooms[roomID]
			if !exists {
				c.Hub.mutex.Unlock()
				c.Send <- mustMarshal(WSMessage{Type: "room_error", Message: "Room tidak ditemukan."})
				continue
			}

			if len(room.Players) >= room.MaxPlayers {
				c.Hub.mutex.Unlock()
				c.Send <- mustMarshal(WSMessage{Type: "room_error", Message: "Room sudah penuh!"})
				continue
			}

			room.Players[c.Username] = &RoomPlayer{Username: c.Username, TotalWords: 10, IsReady: true}
			c.Hub.userRooms[c.Username] = roomID
			c.Hub.mutex.Unlock()

			// Beritahu pemain yang bergabung
			c.Send <- mustMarshal(WSMessage{
				Type:    "room_joined",
				Room:    room,
				Message: fmt.Sprintf("Berhasil bergabung ke %s!", room.Name),
			})

			// Beritahu anggota room lain
			c.Hub.BroadcastToRoom(roomID, WSMessage{
				Type:    "room_updated",
				Room:    room,
				Message: fmt.Sprintf("👤 %s telah bergabung ke dalam room!", c.Username),
			})

			c.Hub.BroadcastOnlineState()
			continue
		}

		// 6. MULAI PERTANDINGAN ROOM OLEH HOST
		if req.Action == "start_room_match" {
			roomID := strings.TrimSpace(req.RoomID)

			c.Hub.mutex.Lock()
			room, exists := c.Hub.rooms[roomID]
			if !exists || room.Host != c.Username {
				c.Hub.mutex.Unlock()
				continue
			}
			room.Status = "playing"
			c.Hub.mutex.Unlock()

			// Mulai pertandingan untuk semua pemain di room
			c.Hub.BroadcastToRoom(roomID, WSMessage{
				Type:    "match_start",
				RoomID:  roomID,
				BoardID: room.BoardID,
				Room:    room,
				Message: fmt.Sprintf("🔥 Pertandingan dimulai di Papan %s! Berlomba pecahkan seluruh kata!", room.BoardID),
			})
			continue
		}

		// 7. PEMBARUAN PROGRES PERMAINAN DI ROOM
		if req.Action == "progress_update" {
			c.Hub.mutex.Lock()
			roomID, inRoom := c.Hub.userRooms[c.Username]
			if inRoom {
				if room, rExists := c.Hub.rooms[roomID]; rExists {
					if p, pExists := room.Players[c.Username]; pExists {
						p.WordsSolved = req.WordsSolved
						p.TotalWords = req.TotalWords
					}
				}
			}
			c.Hub.mutex.Unlock()

			if inRoom {
				c.Hub.BroadcastToRoom(roomID, WSMessage{
					Type:        "progress_broadcast",
					FromUser:    c.Username,
					WordsSolved: req.WordsSolved,
					TotalWords:  req.TotalWords,
					RoomID:      roomID,
				})
			}
			continue
		}

		// 8. KEMENANGAN PERTANDINGAN (Siapa yang selesai duluan di room)
		if req.Action == "match_finished" {
			c.Hub.mutex.Lock()
			roomID, inRoom := c.Hub.userRooms[c.Username]
			var room *TournamentRoom
			if inRoom {
				room = c.Hub.rooms[roomID]
				if room != nil && room.Status == "playing" {
					room.Status = "finished"
					room.Winner = c.Username
				}
			}
			c.Hub.mutex.Unlock()

			if inRoom && room != nil {
				c.Hub.BroadcastToRoom(roomID, WSMessage{
					Type:       "match_over",
					RoomID:     roomID,
					Winner:     c.Username,
					TargetUser: c.Username,
					Message:    fmt.Sprintf("👑 %s berhasil menyelesaikan seluruh kata dan menjadi JUARA!", c.Username),
				})
			}
			continue
		}

		// 9. KELUAR DARI ROOM
		if req.Action == "leave_room" {
			c.Hub.mutex.Lock()
			if roomID, inRoom := c.Hub.userRooms[c.Username]; inRoom {
				delete(c.Hub.userRooms, c.Username)
				if room, rExists := c.Hub.rooms[roomID]; rExists {
					delete(room.Players, c.Username)
					if len(room.Players) == 0 {
						delete(c.Hub.rooms, roomID)
					} else {
						c.Hub.BroadcastToRoom(roomID, WSMessage{
							Type:    "room_updated",
							Room:    room,
							Message: fmt.Sprintf("%s telah keluar dari room.", c.Username),
						})
					}
				}
			}
			c.Hub.mutex.Unlock()
			c.Hub.BroadcastOnlineState()
			continue
		}

		// 10. LEMPAR AMUNISI (BOM 💣 / FREEZE ❄️)
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
					Message: "Tidak bisa menyerang diri sendiri.",
				})
				continue
			}

			attackMsg := WSMessage{
				Type:      "attack_received",
				ItemType:  itemType,
				FromUser:  c.Username,
				Duration:  5,
				Timestamp: time.Now().Unix(),
			}

			success := c.Hub.SendToUser(target, attackMsg)
			if success {
				c.Send <- mustMarshal(WSMessage{
					Type:       "attack_success",
					ItemType:   itemType,
					TargetUser: target,
					Message:    fmt.Sprintf("Berhasil menyerang %s dengan %s!", target, itemType),
				})

				itemName := "Bom 💣"
				if itemType == "freeze" {
					itemName = "Freeze ❄️"
				}

				// Jika di dalam room, siarkan ke room
				c.Hub.mutex.RLock()
				roomID, inRoom := c.Hub.userRooms[c.Username]
				c.Hub.mutex.RUnlock()

				if inRoom {
					c.Hub.BroadcastToRoom(roomID, WSMessage{
						Type:    "tournament_event",
						Message: fmt.Sprintf("⚔️ %s melemparkan %s ke %s!", c.Username, itemName, target),
					})
				} else {
					c.Hub.BroadcastAll(WSMessage{
						Type:    "tournament_event",
						Message: fmt.Sprintf("⚔️ %s melemparkan %s ke %s!", c.Username, itemName, target),
					})
				}
			} else {
				c.Send <- mustMarshal(WSMessage{
					Type:    "attack_error",
					Message: fmt.Sprintf("Pemain %s sedang tidak online.", target),
				})
			}
		}
	}
}

// writePump mengirimkan pesan tunggal per frame tanpa penggabungan \n
func (c *TournamentClient) writePump() {
	ticker := time.NewTicker(20 * time.Second)
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

			// Tulis pesan tunggal per frame WebSocket agar JSON.parse selalu valid
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
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

// GetOnlineTournamentStatus endpoint REST HTTP untuk fallback status turnamen
func GetOnlineTournamentStatus(c *gin.Context) {
	Hub.mutex.RLock()
	players := make([]string, 0, len(Hub.clients))
	for username := range Hub.clients {
		players = append(players, username)
	}

	rooms := make([]*TournamentRoom, 0, len(Hub.rooms))
	for _, room := range Hub.rooms {
		rooms = append(rooms, room)
	}
	Hub.mutex.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"online_players": players,
		"count":          len(players),
		"rooms":          rooms,
	})
}

func mustMarshal(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}
