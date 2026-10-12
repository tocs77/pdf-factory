package models

type File struct {
	GormModel
	Filename string `json:"filename" gorm:"not null"`
	// SourceFilename holds the original CAD file name (DWG/DXF) when Filename
	// points at the PDF produced by the upload-time conversion.
	SourceFilename string `json:"sourceFilename,omitempty"`
	Hash           string `json:"hash" gorm:"not null"`
	Size           int64  `json:"size"`
}
