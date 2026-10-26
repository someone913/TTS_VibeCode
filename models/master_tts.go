package models

// Board merepresentasikan tabel tts_boards
type Board struct {
	ID         string      `gorm:"primaryKey;column:id" json:"id"`
	GridHeight int         `gorm:"column:grid_height" json:"grid_height"`
	GridWidth  int         `gorm:"column:grid_width" json:"grid_width"`
	TotalWords int         `gorm:"column:total_words" json:"total_words"`
	Active     bool        `gorm:"column:active" json:"active"`
	Words      []BoardWord `gorm:"foreignKey:BoardID;references:ID" json:"words"`
}

func (Board) TableName() string {
	return "tts_boards"
}

// Question merepresentasikan tabel tts_questions
type Question struct {
	ID         string `gorm:"primaryKey;column:id" json:"id"`
	Answer     string `gorm:"column:answer" json:"answer"`
	Clue       string `gorm:"column:clue" json:"clue"`
	Category   string `gorm:"column:category" json:"category"`
	Difficulty string `gorm:"column:difficulty" json:"difficulty"`
}

func (Question) TableName() string {
	return "tts_questions"
}

// BoardWord merepresentasikan tabel tts_board_words
type BoardWord struct {
	BoardID      string   `gorm:"primaryKey;column:board_id" json:"board_id"`
	QuestionID   string   `gorm:"column:question_id" json:"question_id"`
	ClueNo       int      `gorm:"column:clue_no" json:"clue_no"`
	Direction    string   `gorm:"column:direction" json:"direction"`
	StartRow     int      `gorm:"column:start_row" json:"start_row"`
	StartCol     int      `gorm:"column:start_col" json:"start_col"`
	Length       int      `gorm:"column:length" json:"length"`
	RevealRow    *int     `gorm:"column:reveal_row" json:"reveal_row"`
	RevealCol    *int     `gorm:"column:reveal_col" json:"reveal_col"`
	RevealLetter *string  `gorm:"column:reveal_letter" json:"reveal_letter"`
	Question     Question `gorm:"foreignKey:QuestionID;references:ID" json:"question"`
}

func (BoardWord) TableName() string {
	return "tts_board_words"
}
