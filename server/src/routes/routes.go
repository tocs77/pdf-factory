package routes

import (
	"pdfsrv/src/controllers"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")
	app.Get("/", controllers.TestController)
	api.Post("/upload", controllers.UploadFile)
	api.Get("/files", controllers.GetFilesList)
	api.Delete("/files/:id", controllers.DeleteFile)
	api.Get("/files/:id/download", controllers.DownloadFile)
}
