package routes

import (
	"pdfsrv/src/controllers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// File routes
	api.Post("/upload", controllers.UploadFile)
	api.Get("/files", controllers.GetFilesList)
	api.Delete("/files/:id", controllers.DeleteFile)
	api.Get("/files/:id/download", controllers.DownloadFile)

	// Drawing routes
	api.Post("/drawings", controllers.CreateDrawing)
	api.Get("/drawings", controllers.GetDrawings) // With query param ?fileId=X
	api.Get("/drawings/:id", controllers.GetDrawing)
	api.Put("/drawings/:id", controllers.UpdateDrawing)
	api.Delete("/drawings/file", controllers.DeleteDrawingsByFile) // With query param ?fileId=X
	api.Delete("/drawings/:id", controllers.DeleteDrawing)
	api.Post("/drawings/bulk", controllers.BulkCreateDrawings)
}
