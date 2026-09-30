package models

// PageMatch caches the page-matching result for an ordered pair of files
// (A = main document, B = compare document). Result holds the raw JSON
// response produced by the matcher service.
type PageMatch struct {
	GormModel
	FileAID uint   `json:"fileAId" gorm:"not null;uniqueIndex:idx_page_match_pair"`
	FileBID uint   `json:"fileBId" gorm:"not null;uniqueIndex:idx_page_match_pair"`
	Result  string `json:"result" gorm:"type:jsonb"`
}
