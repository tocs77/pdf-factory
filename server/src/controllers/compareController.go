package controllers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"pdfsrv/src/database"
	"pdfsrv/src/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

type matchPagesRequest struct {
	FileIdA string `json:"file_id_a"`
	FileIdB string `json:"file_id_b"`
}

// MatchPages proxies a page-matching request to the matcher service.
// The matcher container mounts ./uploads at /app/uploads, so paths are
// sent in the matcher's filesystem layout.
func MatchPages(c *fiber.Ctx) error {
	var req matchPagesRequest
	if err := c.BodyParser(&req); err != nil || req.FileIdA == "" || req.FileIdB == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "file_id_a and file_id_b are required",
		})
	}

	var fileA, fileB models.File
	if err := database.DB.First(&fileA, req.FileIdA).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "file A not found",
		})
	}
	if err := database.DB.First(&fileB, req.FileIdB).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "file B not found",
		})
	}

	matcherURL := os.Getenv("MATCHER_URL")
	if matcherURL == "" {
		matcherURL = "http://localhost:8000"
	}

	payload, err := json.Marshal(map[string]string{
		"path_a": "/app/uploads/" + fileA.Hash + "/" + fileA.Filename,
		"path_b": "/app/uploads/" + fileB.Hash + "/" + fileB.Filename,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to build matcher request",
		})
	}

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Post(matcherURL+"/match", "application/json", bytes.NewReader(payload))
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Failed to reach matcher service",
		})
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Failed to read matcher response",
		})
	}

	if resp.StatusCode != http.StatusOK {
		return c.Status(resp.StatusCode).Send(body)
	}

	c.Set("Content-Type", "application/json")
	return c.Send(body)
}
