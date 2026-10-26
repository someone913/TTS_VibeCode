package models

import "time"

type User struct {
	ID              uint      `gorm:"primaryKey;column:id" json:"id"`
	Username        string    `gorm:"unique;not null;column:username" json:"username"`
	Password        string    `gorm:"not null;column:password" json:"-"`
	Score           int       `gorm:"default:0;column:score" json:"score"`
	BoardsCompleted int       `gorm:"default:0;column:boards_completed" json:"boards_completed"`
	WordsSolved     int       `gorm:"default:0;column:words_solved" json:"words_solved"`
	HintsUsed       int       `gorm:"default:0;column:hints_used" json:"hints_used"`
	IsAdmin         bool      `gorm:"default:false;column:is_admin" json:"is_admin"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"created_at"`
}

func (User) TableName() string {
	return "web_users"
}
