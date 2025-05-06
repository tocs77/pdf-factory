package controllers

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/gofiber/fiber/v2"

	"pdfsrv/src/database"
	"pdfsrv/src/models"
)

// CreateDrawing - Create a new drawing
func CreateDrawing(c *fiber.Ctx) error {
	fmt.Println("CreateDrawing")

	var drawing models.Drawing

	// Parse the request body
	if err := c.BodyParser(&drawing); err != nil {
		fmt.Printf("ERROR parsing drawing request: %v\n", err)
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to parse drawing data: %v", err),
		})
	}

	// If data field exists, verify it's valid JSON
	if drawing.Data != "" {
		var jsonData interface{}
		if err := json.Unmarshal([]byte(drawing.Data), &jsonData); err != nil {
			fmt.Printf("ERROR invalid JSON in data field: %v\n", err)
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Invalid JSON in data field: %v", err),
			})
		}
	}

	// Validate required fields
	if drawing.FileID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File ID is required",
		})
	}

	if drawing.PageNumber <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Valid page number is required",
		})
	}

	if drawing.Type == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Drawing type is required",
		})
	}

	// Create drawing in database
	result := database.DB.Create(&drawing)
	if result.Error != nil {
		fmt.Printf("ERROR creating drawing in database: %v\n", result.Error)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to save drawing: %v", result.Error),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(drawing)
}

// GetDrawings - Get all drawings for a file
func GetDrawings(c *fiber.Ctx) error {
	fmt.Println("GetDrawings")

	// Get file ID from query parameters
	fileIDStr := c.Query("fileId")
	if fileIDStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File ID is required",
		})
	}

	fileID, err := strconv.ParseUint(fileIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid file ID",
		})
	}

	// Get all drawings for the file
	var drawings []models.Drawing
	database.DB.Where("file_id = ?", fileID).Find(&drawings)

	return c.JSON(drawings)
}

// GetDrawing - Get a single drawing by ID
func GetDrawing(c *fiber.Ctx) error {
	fmt.Println("GetDrawing")
	id := c.Params("id")

	var drawing models.Drawing
	result := database.DB.First(&drawing, id)

	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Drawing not found",
		})
	}

	return c.JSON(drawing)
}

// UpdateDrawing - Update an existing drawing
func UpdateDrawing(c *fiber.Ctx) error {
	fmt.Println("UpdateDrawing")
	id := c.Params("id")

	// Check if drawing exists
	var drawing models.Drawing
	result := database.DB.First(&drawing, id)

	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Drawing not found",
		})
	}

	// Parse new data
	var updatedDrawing models.Drawing
	if err := c.BodyParser(&updatedDrawing); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to parse drawing data",
		})
	}

	// Validate the data field
	if updatedDrawing.Data != "" {
		// Verify it's valid JSON
		var jsonData interface{}
		if err := json.Unmarshal([]byte(updatedDrawing.Data), &jsonData); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid JSON in data field",
			})
		}
	}

	// Ensure ID is preserved
	updatedDrawing.ID = drawing.ID

	// Update the drawing
	database.DB.Save(&updatedDrawing)

	return c.JSON(updatedDrawing)
}

// DeleteDrawing - Delete a drawing
func DeleteDrawing(c *fiber.Ctx) error {
	fmt.Println("DeleteDrawing")
	id := c.Params("id")

	// Check if drawing exists
	var drawing models.Drawing
	result := database.DB.First(&drawing, id)

	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Drawing not found",
		})
	}

	// Delete the drawing
	database.DB.Delete(&drawing)

	return c.JSON(fiber.Map{
		"message": "Drawing deleted successfully",
	})
}

// DeleteDrawingsByFile - Delete all drawings for a file
func DeleteDrawingsByFile(c *fiber.Ctx) error {
	fmt.Println("DeleteDrawingsByFile")

	// Get file ID
	fileIDStr := c.Query("fileId")
	if fileIDStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File ID is required",
		})
	}

	fileID, err := strconv.ParseUint(fileIDStr, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid file ID",
		})
	}

	// Delete all drawings for this file
	database.DB.Where("file_id = ?", fileID).Delete(&models.Drawing{})

	return c.JSON(fiber.Map{
		"message": "All drawings for file deleted successfully",
	})
}

// BulkCreateDrawings - Create multiple drawings in a single request
func BulkCreateDrawings(c *fiber.Ctx) error {
	fmt.Println("BulkCreateDrawings")

	var drawings []models.Drawing

	// Parse the request body
	if err := c.BodyParser(&drawings); err != nil {
		fmt.Printf("ERROR parsing bulk drawings request: %v\n", err)

		// Check if client sent a single drawing instead of an array
		var singleDrawing models.Drawing
		if err2 := c.BodyParser(&singleDrawing); err2 == nil && singleDrawing.FileID > 0 {
			drawings = []models.Drawing{singleDrawing}
		} else {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Failed to parse drawings data: %v", err),
			})
		}
	}

	if len(drawings) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No drawings provided",
		})
	}

	// Validate each drawing
	for i, drawing := range drawings {
		if drawing.FileID == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Drawing at index %d is missing File ID", i),
			})
		}

		if drawing.PageNumber <= 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Drawing at index %d has invalid page number", i),
			})
		}

		if drawing.Type == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fmt.Sprintf("Drawing at index %d is missing type", i),
			})
		}

		// Validate JSON in data field
		if drawing.Data != "" {
			var jsonData interface{}
			if err := json.Unmarshal([]byte(drawing.Data), &jsonData); err != nil {
				fmt.Printf("ERROR: Invalid JSON in data field for drawing at index %d: %v\n", i, err)
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": fmt.Sprintf("Drawing at index %d has invalid JSON in data field: %v", i, err),
				})
			}
		}
	}

	// Create all drawings
	result := database.DB.Create(&drawings)
	if result.Error != nil {
		fmt.Printf("ERROR creating bulk drawings in database: %v\n", result.Error)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to save drawings: %v", result.Error),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(drawings)
}
