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
