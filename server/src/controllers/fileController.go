package controllers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"pdfsrv/src/database"
	"pdfsrv/src/models"
	"pdfsrv/src/services"
	"strings"

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

	filename := file.Filename
	var sourceFilename string
	size := file.Size

	// CAD files can't be viewed or matched directly — convert to PDF and
	// point the file record at the converted document. Conversion I/O runs
	// on container-local temp paths; the source is read at filePath, which
	// is still the plain SaveFile-created file.
	if services.IsCADFile(filename) {
		pdfName := strings.TrimSuffix(filename, filepath.Ext(filename)) + ".pdf"
		pdfPath := hashDir + "/" + pdfName

		tmpDir, err := os.MkdirTemp("", "dwg2pdf-")
		if err == nil {
			defer os.RemoveAll(tmpDir)
			tmpIn := filepath.Join(tmpDir, "input"+filepath.Ext(filename))
			tmpOut := filepath.Join(tmpDir, "output.pdf")
			if err = copyFile(filePath, tmpIn); err == nil {
				err = services.ConvertToPdf(c.UserContext(), tmpIn, tmpOut)
			}
			if err == nil {
				err = copyFile(tmpOut, pdfPath)
			}
		}
		if err != nil {
			os.Remove(filePath)
			os.Remove(pdfPath)
			os.Remove(hashDir)
			return c.Status(fiber.StatusUnprocessableEntity).JSON(fiber.Map{
				"error": fmt.Sprintf("DWG/DXF conversion failed: %v", err),
			})
		}

		sourceFilename, filename = filename, pdfName
		if st, err := os.Stat(pdfPath); err == nil {
			size = st.Size()
		}
	}

	// Move the uploaded file into the hash dir via copy+remove — os.Rename
	// leaves the destination un-stat'able on the bind-mounted volume until
	// its cache expires.
	if err := copyFile(filePath, newFilePath); err != nil {
		c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to move file to hash directory",
		})
		return err
	}
	os.Remove(filePath)

	database.DB.Create(&models.File{
		Filename:       filename,
		SourceFilename: sourceFilename,
		Hash:           fileHash,
		Size:           size,
	})

	return c.JSON(fiber.Map{
		"message": "File uploaded successfully",
		"file":    filename,
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
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

	// Check if the file exists before attempting to delete it
	_, err := os.Stat(filePath)
	os.IsNotExist(err)

	if err == nil {
		if err := os.Remove(filePath); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to delete file from uploads",
			})
		}
		// Remove the original CAD file kept next to the converted PDF
		if file.SourceFilename != "" {
			os.Remove(hashDir + "/" + file.SourceFilename)
		}
		// Try to remove the directory if it's empty
		os.Remove(hashDir) // Ignore error if directory is not empty
	}

	// Delete the file record and any cached page matches involving it
	database.DB.Delete(&file)
	database.DB.
		Where("file_a_id = ? OR file_b_id = ?", file.ID, file.ID).
		Delete(&models.PageMatch{})

	return c.JSON(fiber.Map{
		"message": "File deleted successfully",
	})

}

func DownloadFile(c *fiber.Ctx) error {
	id := c.Params("id")
	var file models.File
	database.DB.First(&file, id)

	filePath := "./uploads/" + file.Hash + "/" + file.Filename
	return c.Download(filePath, file.Filename)
}
