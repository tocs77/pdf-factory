package models

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// BoundingBox represents the boundary of a drawing
type BoundingBox struct {
	Top    float64 `json:"top"`
	Left   float64 `json:"left"`
	Right  float64 `json:"right"`
	Bottom float64 `json:"bottom"`
}

// Drawing is the base model for all drawings
type Drawing struct {
	GormModel
	FileID      uint        `json:"fileId" gorm:"foreignKey:FileID;constraint:OnDelete:CASCADE"`
	Type        string      `json:"type" gorm:"not null"`
	PageNumber  int         `json:"pageNumber" gorm:"not null"`
	Image       string      `json:"image,omitempty" gorm:"type:text"`
	BoundingBox BoundingBox `json:"boundingBox" gorm:"embedded"`

	Data string `json:"data" gorm:"type:text"`
}

// Custom unmarshaler to handle string IDs
type drawingJSON struct {
	ID          interface{} `json:"id"`
	FileID      interface{} `json:"fileId"`
	Type        string      `json:"type"`
	PageNumber  interface{} `json:"pageNumber"`
	Image       string      `json:"image,omitempty"`
	BoundingBox BoundingBox `json:"boundingBox"`
	Data        string      `json:"data"`
	CreatedAt   string      `json:"createdAt,omitempty"`
	UpdatedAt   string      `json:"updatedAt,omitempty"`
	DeletedAt   string      `json:"deletedAt,omitempty"`
}

// UnmarshalJSON implements custom JSON unmarshaling for Drawing model
func (d *Drawing) UnmarshalJSON(data []byte) error {
	var temp drawingJSON
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// Handle ID field which could be string or number
	if temp.ID != nil {
		switch v := temp.ID.(type) {
		case float64:
			d.ID = uint(v)
		case string:
			if v != "" {
				id, err := strconv.ParseUint(v, 10, 32)
				if err == nil {
					d.ID = uint(id)
				}
			}
		}
	}

	// Handle FileID field which could be string or number
	if temp.FileID != nil {
		switch v := temp.FileID.(type) {
		case float64:
			d.FileID = uint(v)
		case string:
			if v != "" {
				id, err := strconv.ParseUint(v, 10, 32)
				if err != nil {
					return fmt.Errorf("invalid fileId format: %v", err)
				}
				d.FileID = uint(id)
			}
		default:
			return fmt.Errorf("unhandled fileId type: %T", v)
		}
	}

	// Handle PageNumber field which could be string or number
	if temp.PageNumber != nil {
		switch v := temp.PageNumber.(type) {
		case float64:
			d.PageNumber = int(v)
		case string:
			if v != "" {
				num, err := strconv.Atoi(v)
				if err != nil {
					return fmt.Errorf("invalid pageNumber format: %v", err)
				}
				d.PageNumber = num
			}
		default:
			return fmt.Errorf("unhandled pageNumber type: %T", v)
		}
	}

	// Copy the rest of the fields
	d.Type = temp.Type
	d.Image = temp.Image
	d.BoundingBox = temp.BoundingBox
	d.Data = temp.Data

	return nil
}
