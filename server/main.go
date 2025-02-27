package main

import (
	"os"
	"pdfsrv/src/database"
	"pdfsrv/src/migration"
	"pdfsrv/src/routes"

	"github.com/gofiber/fiber/v2"
)

func main() {
	database.Connect()
	migration.AutoMigrate()
	app := fiber.New(fiber.Config{
		Prefork:   true,
		BodyLimit: 1024 * 1024 * 1000,
	})
	app.Static("/", "./public")
	routes.SetupRoutes(app)
	// Fallback route for SPA routing - must be defined AFTER all other routes
	app.Use(func(c *fiber.Ctx) error {
		// Don't handle API routes with this fallback
		if string(c.Request().URI().Path())[0:4] == "/api" {
			return c.Next()
		}

		// Serve index.html for all other routes to support SPA client-side routing
		return c.SendFile("./public/index.html")
	})
	app.Listen(":" + os.Getenv("APP_PORT"))
}
