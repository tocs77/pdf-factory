package controllers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"pdfsrv/src/database"
	"pdfsrv/src/models"

	"github.com/gofiber/fiber/v2"
)

func UploadFile(c *fiber.Ctx) error {
	fmt.Println("UploadFile")
	file, err := c.FormFile("file")
	if err != nil {
		c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to upload file",
		})
		return err
	}

	filePath := "./uploads/" + file.Filename
	if err := c.SaveFile(file, filePath); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to save file",
		})
		return err
	}

	// Calculate hash for the saved file
	fileContent, err := os.Open(filePath)
	if err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to read file for hashing",
		})
		return err
	}
	defer fileContent.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, fileContent); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to calculate file hash",
		})
		return err
	}
	// Create a directory with the hash as its name
	fileHash := fmt.Sprintf("%x", hasher.Sum(nil))
	hashDir := "./uploads/" + fileHash

	// Create the directory if it doesn't exist
	if err := os.MkdirAll(hashDir, 0755); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create directory for file",
		})
		return err
	}

	// New path for the file in the hash-named directory
	newFilePath := hashDir + "/" + file.Filename

	// Move the file to the new directory
	if err := os.Rename(filePath, newFilePath); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to move file to hash directory",
		})
		return err
	}

	database.DB.Create(&models.File{
		Filename: file.Filename,
		Hash:     fileHash,
	})

	return c.JSON(fiber.Map{
		"message": "File uploaded successfully",
		"file":    file.Filename,
	})
}

func GetFilesList(c *fiber.Ctx) error {
	var files []models.File
	database.DB.Find(&files)
	return c.JSON(files)
}

func DeleteFile(c *fiber.Ctx) error {
	id := c.Params("id")

	// Find the file in the database first
	var file models.File
	result := database.DB.First(&file, id)
	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "File not found",
		})
	}

	// Delete the file from the uploads directory
	hashDir := "./uploads/" + file.Hash
	filePath := hashDir + "/" + file.Filename
	if err := os.Remove(filePath); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete file from uploads",
		})
	}

	// Try to remove the directory if it's empty
	os.Remove(hashDir) // Ignore error if directory is not empty

	// Delete the file record from the database
	database.DB.Delete(&file)

	return c.JSON(fiber.Map{
		"message": "File deleted successfully",
	})

}

func DownloadFile(c *fiber.Ctx) error {
	id := c.Params("id")
	var file models.File
	database.DB.First(&file, id)

	filePath := "./uploads/" + file.Hash + "/" + file.Filename
	return c.Download(filePath)
}
