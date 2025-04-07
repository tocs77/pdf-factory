package models

type File struct {
	GormModel
	Filename string `json:"filename" gorm:"not null"`
	Hash     string `json:"hash" gorm:"not null"`
	Size     int64  `json:"size"`
}
