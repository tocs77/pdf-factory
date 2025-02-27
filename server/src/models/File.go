package models

import "gorm.io/gorm"

type File struct {
	gorm.Model
	Filename string `gorm:"not null"`
	Hash     string `gorm:"not null"`
}
